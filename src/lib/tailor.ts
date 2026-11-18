import {
  type Bullet,
  type ExtractedJd,
  type ResumeData,
  type SectionKey,
  type TailorChange,
  type TailorResult,
  resumeDataSchema,
  resumeToPlainText,
  sectionKeys,
  sectionLabels,
} from "@/lib/types";
import { analyzeResume } from "@/lib/scoring";
import { presentKeywords, matchKeyword, skillTaxonomy } from "@/lib/keywords";
import {
  BUZZWORDS,
  CLICHES,
  STRONG_VERB_SUGGESTIONS,
  WEAK_OPENERS,
  countWords,
  findBannedLanguage,
  hasQuantifiedImpact,
  normalize,
  sanitizeProse,
  truncate,
} from "@/lib/text";
import { factCheckResume, type FactCheckInput } from "@/lib/fact-check";
import type { LlmTailorOutput } from "@/prompts/schemas";
import { writingRuleViolations } from "@/lib/text";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function changeId(kind: string, target: string, index: number): string {
  return `chg_${kind}_${target}_${index}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
}

function lowerFirst(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

function upperFirst(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function listSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function sourceCorpusFor(base: ResumeData, answers: string[] = []): string {
  const quotes = [
    ...base.experience.flatMap((e) => e.bullets.map((b) => b.source.quote ?? "")),
    ...base.projects.flatMap((p) => p.bullets.map((b) => b.source.quote ?? "")),
    base.summarySource.quote ?? "",
    ...answers,
  ].filter(Boolean);
  return [resumeToPlainText(base), ...quotes].join("\n");
}

/* ------------------------------------------------------------------ */
/* Fact-safe single-change validation                                  */
/* ------------------------------------------------------------------ */

export function validateTailorChange(
  base: ResumeData,
  change: TailorChange,
  context: { answers?: string[]; allowedEntities?: string[] } = {},
): { ok: boolean; reason?: string } {
  const beforeCheck = factCheckResume({
    data: base,
    base,
    sourceText: sourceCorpusFor(base, context.answers),
    answers: context.answers,
    allowedEntities: context.allowedEntities,
  });
  const existingBlocking = new Set(beforeCheck.findings.filter((f) => f.blocking).map((f) => f.fingerprint));
  const candidate = applyTailorChanges(base, [{ ...change }]);
  const afterCheck = factCheckResume({
    data: candidate,
    base,
    sourceText: sourceCorpusFor(base, context.answers),
    answers: context.answers,
    allowedEntities: context.allowedEntities,
  });
  const newlyBlocking = afterCheck.findings.filter((f) => f.blocking && !existingBlocking.has(f.fingerprint));
  if (newlyBlocking.length) {
    return { ok: false, reason: newlyBlocking[0].reason };
  }
  if (change.after.length > 1200 || /\[[^\]]{1,60}\]/.test(change.after)) {
    return { ok: false, reason: "The change contains an unresolved placeholder." };
  }
  if (writingRuleViolations(change.after).length) {
    return { ok: false, reason: "The change violates the writing quality rules." };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Deterministic tailoring                                             */
/* ------------------------------------------------------------------ */

function buildRulesSummary(base: ResumeData, jd: ExtractedJd, meta: ReturnType<typeof analyzeResume>["meta"]): string {
  const matchedSkills = presentKeywords(jd, resumeToPlainText(base))
    .filter((k) => !/^(?:communication|leadership|collaboration|problem solving|teamwork|adaptability|time management)$/i.test(k))
    .slice(0, 3);

  const primary = base.experience[0];
  const allBullets = base.experience.flatMap((e) => e.bullets.map((b) => ({ bullet: b.text, company: e.company })));
  const impact = allBullets.find((b) => hasQuantifiedImpact(b.bullet) && countWords(b.bullet) <= 30)?.bullet ?? allBullets.find((b) => countWords(b.bullet) <= 24)?.bullet ?? "";
  const impactText = impact ? sanitizeProse(impact).replace(/\.$/, "") : "";

  const years = Math.floor(meta.experienceYears);
  const experiencePhrase =
    primary && years >= 1
      ? `${primary.title} with ${years} ${years === 1 ? "year" : "years"} of experience`
      : primary
        ? primary.title
        : base.education.length
          ? `${base.education[0].degree || "Graduate"}${base.education[0].field ? ` in ${base.education[0].field}` : ""}`
          : "";

  const skillsPhrase = matchedSkills.length ? ` across ${listSentence(matchedSkills)}` : "";
  const sentences: string[] = [];
  if (experiencePhrase) sentences.push(`${experiencePhrase}${skillsPhrase}.`);
  if (impactText) sentences.push(`${upperFirst(impactText)}.`);
  const target = jd.company ? `${jd.role} at ${jd.company}` : jd.role;
  if (target) sentences.push(`Targeting ${target}.`);

  let summary = sentences.join(" ").replace(/\s+/g, " ").trim();
  if (countWords(summary) > 85) summary = truncate(summary, 560);
  return sanitizeProse(summary);
}

const ALIAS_LOOKUP = new Map<string, { canonical: string; entry: string }>();
for (const entry of skillTaxonomy) {
  for (const alias of [entry.canonical, ...entry.aliases]) {
    const key = normalize(alias);
    if (!ALIAS_LOOKUP.has(key)) ALIAS_LOOKUP.set(key, { canonical: entry.canonical, entry: entry.canonical });
  }
}

/** Replace a synonym with the exact term used by the JD when both are the same concept. */
export function alignKeywordsToJd(text: string, jd: ExtractedJd): string {
  let out = text;
  const canonicalByEntry = new Map<string, string>();
  for (const keyword of jd.keywords) {
    const direct = skillTaxonomy.find((e) => normalize(e.canonical) === normalize(keyword.keyword));
    if (direct) {
      canonicalByEntry.set(normalize(direct.canonical), keyword.keyword);
      for (const alias of direct.aliases) canonicalByEntry.set(normalize(alias), keyword.keyword);
    } else {
      canonicalByEntry.set(normalize(keyword.keyword), keyword.keyword);
    }
  }

  for (const [normalizedAlias, canonical] of canonicalByEntry) {
    if (!normalizedAlias || normalizedAlias === normalize(canonical)) continue;
    if (out.toLowerCase().includes(canonical.toLowerCase())) continue;
    if (normalizedAlias.length < 2) continue;
    const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "gi");
    if (rx.test(out)) {
      out = out.replace(rx, (_m, pre: string, post: string) => `${pre}${canonical}${post}`);
    }
  }
  return out;
}

function strengthenBullet(text: string, jd: ExtractedJd): string {
  let out = sanitizeProse(text);
  const lower = normalize(out);
  for (const opener of WEAK_OPENERS) {
    if (lower.startsWith(opener)) {
      const replacement = STRONG_VERB_SUGGESTIONS[opener] ?? "Owned";
      out = `${replacement} ${out.slice(opener.length).trim()}`;
      break;
    }
  }
  out = alignKeywordsToJd(out, jd);
  out = out.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  out = upperFirst(out);
  if (!/[.!?]$/.test(out)) out = out.replace(/[.,;:]$/, "");
  return out;
}

function relevanceScore(text: string, jd: ExtractedJd): number {
  let score = 0;
  for (const keyword of jd.keywords) {
    const hit = matchKeyword(keyword.keyword, text, keyword.type, keyword.importance);
    if (hit.matchType !== "missing") score += keyword.importance === "must" ? 2 : 1;
  }
  return score;
}

export function rulesTailor(base: ResumeData, jd: ExtractedJd): TailorResult {
  const changes: TailorChange[] = [];
  const sourceText = resumeToPlainText(base);
  const beforeAnalysis = analyzeResume({ resume: base, jd, rawText: sourceText });
  const answers: string[] = [];
  let index = 0;

  // 1. Summary
  if (base.experience.length || base.education.length || base.projects.length) {
    const before = base.summary;
    const after = buildRulesSummary(base, jd, beforeAnalysis.meta);
    if (after && after !== before && countWords(after) >= 18) {
      changes.push({
        id: changeId("summary", "summary", index++),
        kind: "summary",
        section: "Summary",
        targetId: "summary",
        targetPath: "summary",
        before,
        after,
        rationale: `Reframes the summary for ${jd.company ? `${jd.role} at ${jd.company}` : jd.role} using only skills and results already in the resume.`,
        source: base.summary || "Existing roles, skills and achievement bullets",
        risk: "low",
      });
    }
  }

  // 2. Bullet rewrites: synonym alignment to JD language and weak opener cleanup
  for (const exp of base.experience) {
    for (const bullet of exp.bullets) {
      if (changes.length >= 14) break;
      const after = strengthenBullet(bullet.text, jd);
      if (after === bullet.text) continue;
      const banned = findBannedLanguage(after);
      if (banned.length) continue;
      changes.push({
        id: changeId("bullet", bullet.id, index++),
        kind: "bullet_rewrite",
        section: "Experience",
        targetId: bullet.id,
        targetPath: `experience.${base.experience.indexOf(exp)}.bullets.${exp.bullets.indexOf(bullet)}.text`,
        before: bullet.text,
        after,
        rationale: "Uses the job description's exact term for a skill you already list and removes weak phrasing.",
        source: bullet.source.quote || bullet.text,
        risk: "low",
      });
    }
  }

  // 3. Reorder bullets within roles by JD relevance
  for (const exp of base.experience) {
    if (exp.bullets.length < 3) continue;
    const ordered = [...exp.bullets].sort((a, b) => relevanceScore(b.text, jd) - relevanceScore(a.text, jd));
    const beforeIds = exp.bullets.map((b) => b.id);
    const afterIds = ordered.map((b) => b.id);
    if (beforeIds.join("|") === afterIds.join("|")) continue;
    changes.push({
      id: changeId("bullet_order", exp.id, index++),
      kind: "bullet_reorder",
      section: "Experience",
      targetId: exp.id,
      before: exp.bullets.map((b) => b.text).join(" | "),
      after: ordered.map((b) => b.text).join(" | "),
      beforeOrder: beforeIds,
      afterOrder: afterIds,
      rationale: "Puts the bullets that match this job's requirements first, without changing any facts.",
      source: "Existing bullets",
      risk: "low",
    });
  }

  // 4. Reorder skills inside each group by JD relevance; move groups with must-have skills up
  const keywordRank = new Map<string, number>();
  jd.keywords.forEach((k, i) => keywordRank.set(normalize(k.keyword), i));
  for (const group of base.skills) {
    const ordered = [...group.skills].sort((a, b) => {
      const ra = keywordRank.get(normalize(a)) ?? 999;
      const rb = keywordRank.get(normalize(b)) ?? 999;
      return ra - rb;
    });
    if (ordered.join("|") === group.skills.join("|")) continue;
    changes.push({
      id: changeId("skills", group.id, index++),
      kind: "skills_reorder",
      section: sectionLabels.skills,
      targetId: group.id,
      before: group.skills.join(", "),
      after: ordered.join(", "),
      rationale: "Puts the skills this job asks for at the front of the group. No skills were added.",
      source: "Existing skills section",
      risk: "low",
    });
  }

  if (base.skills.length > 1) {
    const best = (group: ResumeData["skills"][number]) =>
      group.skills.reduce((sum, skill) => {
        const keyword = jd.keywords.find((k) => normalize(k.keyword) === normalize(skill));
        return sum + (keyword ? (keyword.importance === "must" ? 2 : 1) : 0);
      }, 0);
    const orderedGroups = [...base.skills].sort((a, b) => best(b) - best(a));
    if (orderedGroups.map((g) => g.id).join("|") !== base.skills.map((g) => g.id).join("|")) {
      changes.push({
        id: changeId("skill_groups", "groups", index++),
        kind: "skills_reorder",
        section: sectionLabels.skills,
        targetId: "groups",
        before: base.skills.map((g) => g.name).join(", "),
        after: orderedGroups.map((g) => g.name).join(", "),
        beforeOrder: base.skills.map((g) => g.id),
        afterOrder: orderedGroups.map((g) => g.id),
        rationale: "Leads with the skill group most relevant to this job.",
        source: "Existing skills groups",
        risk: "low",
      });
    }
  }

  // 5. Move skills section up when the role is skills-heavy
  const presentSections = base.sectionOrder.filter((s) => hasSection(base, s));
  if (presentSections.includes("skills") && presentSections.indexOf("skills") > 1) {
    const preferred: SectionKey[] = [];
    const add = (key: SectionKey) => {
      if (presentSections.includes(key) && !preferred.includes(key)) preferred.push(key);
    };
    add("summary");
    add("skills");
    for (const key of presentSections) if (!preferred.includes(key)) preferred.push(key);
    if (preferred.join("|") !== base.sectionOrder.join("|")) {
      changes.push({
        id: changeId("section_order", "sections", index++),
        kind: "section_reorder",
        section: "Section order",
        targetId: "sectionOrder",
        before: base.sectionOrder.map((s) => sectionLabels[s]).join(", "),
        after: preferred.map((s) => sectionLabels[s]).join(", "),
        beforeOrder: base.sectionOrder,
        afterOrder: preferred,
        rationale: "Moves Skills directly below the summary so the recruiter sees job-relevant tools immediately.",
        source: "Existing section order",
        risk: "low",
      });
    }
  }

  const tailored = applyTailorChanges(base, changes);
  const afterAnalysis = analyzeResume({ resume: tailored, jd, rawText: resumeToPlainText(tailored) });
  const afterText = resumeToPlainText(tailored);
  const covered = jd.keywords.filter((k) => matchKeyword(k.keyword, afterText, k.type, k.importance).matchType !== "missing").map((k) => k.keyword);
  const uncovered = jd.keywords.filter((k) => !covered.includes(k.keyword)).map((k) => k.keyword);

  const warnings: string[] = [];
  if (uncovered.length) {
    warnings.push(`${uncovered.length} target keyword${uncovered.length === 1 ? "" : "s"} remain uncovered. Use the skill gap workflow rather than adding claims you cannot support.`);
  }
  if (!changes.length) warnings.push("The resume is already using the job description's language closely. No safe automatic changes were found.");

  return {
    job: jd,
    changes,
    tailored,
    scoreBefore: beforeAnalysis.score,
    scoreAfter: afterAnalysis.score,
    coveredKeywords: covered,
    uncoveredKeywords: uncovered,
    warnings,
    generatedBy: "rules",
  };
}

function hasSection(resume: ResumeData, section: SectionKey): boolean {
  switch (section) {
    case "summary":
      return Boolean(resume.summary);
    case "experience":
      return resume.experience.length > 0;
    case "education":
      return resume.education.length > 0;
    case "skills":
      return resume.skills.some((g) => g.skills.length > 0);
    case "projects":
      return resume.projects.length > 0;
    case "certifications":
      return resume.certifications.length > 0;
    case "awards":
      return resume.awards.length > 0;
    case "custom":
      return resume.custom.length > 0;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Applying changes                                                    */
/* ------------------------------------------------------------------ */

export function applyTailorChanges(base: ResumeData, changes: TailorChange[]): ResumeData {
  const data = clone(base);
  for (const change of changes) {
    switch (change.kind) {
      case "summary": {
        data.summary = change.after;
        data.summarySource = { type: "user_text", ref: "tailored from existing summary and experience", quote: change.source || base.summary };
        break;
      }
      case "bullet_rewrite": {
        const found = findBullet(data, change.targetId ?? "");
        if (found) {
          found.text = change.after;
          found.source = { type: "user_text", ref: "tailored from original bullet", quote: change.source || change.before };
          found.verified = true;
        }
        break;
      }
      case "bullet_reorder": {
        const exp = data.experience.find((e) => e.id === change.targetId);
        if (!exp || !change.afterOrder) break;
        const map = new Map(exp.bullets.map((b) => [b.id, b]));
        const ordered = change.afterOrder.map((id) => map.get(id)).filter(Boolean) as typeof exp.bullets;
        for (const bullet of exp.bullets) if (!ordered.some((b) => b.id === bullet.id)) ordered.push(bullet);
        exp.bullets = ordered;
        break;
      }
      case "experience_reorder": {
        if (!change.afterOrder) break;
        const map = new Map(data.experience.map((e) => [e.id, e]));
        const ordered = change.afterOrder.map((id) => map.get(id)).filter(Boolean) as typeof data.experience;
        for (const exp of data.experience) if (!ordered.some((e) => e.id === exp.id)) ordered.push(exp);
        data.experience = ordered;
        break;
      }
      case "section_reorder": {
        let order: unknown = change.afterOrder;
        if (!order) {
          try {
            order = JSON.parse(change.after);
          } catch {
            order = change.after.split(",").map((s) => s.trim().toLowerCase());
          }
        }
        if (!Array.isArray(order)) break;
        const valid = (order as string[]).filter((key): key is SectionKey => (sectionKeys as readonly string[]).includes(key));
        for (const key of base.sectionOrder) if (!valid.includes(key)) valid.push(key);
        data.sectionOrder = valid;
        break;
      }
      case "skills_reorder": {
        if (change.targetId === "groups" && change.afterOrder) {
          const map = new Map(data.skills.map((g) => [g.id, g]));
          const ordered = change.afterOrder.map((id) => map.get(id)).filter(Boolean) as typeof data.skills;
          for (const group of data.skills) if (!ordered.some((g) => g.id === group.id)) ordered.push(group);
          data.skills = ordered;
          break;
        }
        const group = data.skills.find((g) => g.id === change.targetId);
        if (!group) break;
        const existing = new Set(group.skills.map((s) => s.toLowerCase()));
        let after: string[] = [];
        if (change.afterOrder) after = change.afterOrder;
        else if (change.after.trim().startsWith("[")) {
          try {
            after = JSON.parse(change.after);
          } catch {
            after = change.after.split(",");
          }
        } else after = change.after.split(",");
        const ordered = after.map((s) => s.trim()).filter((s) => existing.has(s.toLowerCase()));
        for (const skill of group.skills) if (!ordered.some((s) => s.toLowerCase() === skill.toLowerCase())) ordered.push(skill);
        group.skills = ordered;
        break;
      }
      default:
        break;
    }
  }
  if (!data.sectionOrder.includes("summary") && data.summary) data.sectionOrder.unshift("summary");
  return resumeDataSchema.parse(data);
}

function findBullet(data: ResumeData, id: string): Bullet | null {
  for (const exp of data.experience) {
    const bullet = exp.bullets.find((b) => b.id === id);
    if (bullet) return bullet;
  }
  for (const project of data.projects) {
    const bullet = project.bullets.find((b) => b.id === id);
    if (bullet) return bullet;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* LLM merge and validation                                            */
/* ------------------------------------------------------------------ */

export interface MergeContext {
  answers?: string[];
  baseAnalysisScore?: number;
}

export function mergeLlmChanges(
  base: ResumeData,
  jd: ExtractedJd,
  rulesResult: TailorResult,
  llm: LlmTailorOutput,
  context: MergeContext = {},
): { changes: TailorChange[]; warnings: string[] } {
  const warnings: string[] = [];
  const sourceText = sourceCorpusFor(base, context.answers);
  const canonicalSource = normalize(sourceText);
  const merged = new Map<string, TailorChange>();
  for (const change of rulesResult.changes) merged.set(`${change.kind}|${change.targetId ?? ""}`, change);

  let index = 1000;
  for (const raw of llm.changes.slice(0, 24)) {
    if (raw.kind === "keyword_insert") {
      warnings.push(`Rejected a keyword insertion for "${raw.before}". Skills cannot be added without evidence.`);
      continue;
    }
    if (raw.after.length > 800) continue;

    const id = changeId(raw.kind, raw.targetId || raw.section, index++);
    const change: TailorChange = {
      id,
      kind: raw.kind,
      section: raw.section,
      targetId: raw.targetId,
      before: raw.before,
      after: raw.after,
      rationale: raw.rationale,
      source: raw.sourceQuote,
      risk: raw.risk,
    };

    if (raw.kind === "summary") {
      if (countWords(raw.after) < 15) continue;
      change.targetId = "summary";
      change.targetPath = "summary";
    }

    if (raw.kind === "bullet_rewrite") {
      const found = findBullet(base, raw.targetId);
      if (!found) {
        warnings.push("Rejected a bullet rewrite because the target bullet no longer exists.");
        continue;
      }
      if (normalize(found.text) !== normalize(raw.before)) {
        warnings.push(`Rejected a rewrite that did not match the original bullet: "${truncate(raw.before, 60)}".`);
        continue;
      }
      if (countWords(raw.after) < 4) continue;
      const sourceOk =
        normalize(raw.sourceQuote) === normalize(found.text) ||
        normalize(raw.sourceQuote) === normalize(found.source.quote ?? "") ||
        (raw.sourceQuote.length > 12 && canonicalSource.includes(normalize(raw.sourceQuote)));
      if (!sourceOk) {
        warnings.push(`Rejected a rewrite without a traceable source quote: "${truncate(raw.before, 60)}".`);
        continue;
      }
    }

    if (raw.kind === "bullet_reorder") {
      const exp = base.experience.find((e) => e.id === raw.targetId);
      let order: string[] = [];
      try {
        order = JSON.parse(raw.after);
      } catch {
        order = raw.after.split(",").map((s) => s.trim());
      }
      if (!exp || !Array.isArray(order) || order.length !== exp.bullets.length || order.some((id) => !exp.bullets.some((b) => b.id === id))) {
        warnings.push("Rejected a bullet reorder with an invalid target or order.");
        continue;
      }
      change.afterOrder = order;
      change.beforeOrder = exp.bullets.map((b) => b.id);
    }

    if (raw.kind === "experience_reorder") {
      let order: string[] = [];
      try {
        order = JSON.parse(raw.after);
      } catch {
        order = raw.after.split(",").map((s) => s.trim());
      }
      if (!Array.isArray(order) || order.length !== base.experience.length || order.some((id) => !base.experience.some((e) => e.id === id))) {
        warnings.push("Rejected an experience reorder with an invalid target or order.");
        continue;
      }
      change.afterOrder = order;
      change.beforeOrder = base.experience.map((e) => e.id);
    }

    if (raw.kind === "skills_reorder") {
      if (raw.targetId === "groups") {
        let order: string[] = [];
        try {
          order = JSON.parse(raw.after);
        } catch {
          order = raw.after.split(",").map((s) => s.trim());
        }
        if (!Array.isArray(order) || order.some((id) => !base.skills.some((g) => g.id === id))) {
          warnings.push("Rejected a skill group reorder with an invalid target.");
          continue;
        }
        change.afterOrder = order;
      } else {
        const group = base.skills.find((g) => g.id === raw.targetId);
        if (!group) {
          warnings.push("Rejected a skill reorder because the group was not found.");
          continue;
        }
        const after = raw.after.split(",").map((s) => s.trim()).filter(Boolean);
        const existing = new Set(group.skills.map((s) => s.toLowerCase()));
        if (after.some((s) => !existing.has(s.toLowerCase()))) {
          warnings.push("Rejected a skill reorder that tried to add a skill not present in the resume.");
          continue;
        }
        change.afterOrder = after;
        change.beforeOrder = group.skills;
      }
    }

    if (raw.kind === "section_reorder") {
      let order: string[] = [];
      try {
        order = JSON.parse(raw.after);
      } catch {
        order = raw.after.split(",").map((s) => s.trim());
      }
      if (!Array.isArray(order) || order.some((key) => !(sectionKeys as readonly string[]).includes(key))) {
        warnings.push("Rejected a section reorder with an unknown section key.");
        continue;
      }
      change.afterOrder = order;
      change.beforeOrder = base.sectionOrder;
    }

    const validation = validateTailorChange(base, change, {
      answers: context.answers,
      allowedEntities: raw.kind === "summary" ? [jd.company, jd.role].filter(Boolean) : [],
    });
    if (!validation.ok) {
      warnings.push(`Rejected "${truncate(raw.before, 50)}": ${validation.reason ?? "unsupported claim"}.`);
      continue;
    }

    const key = `${raw.kind}|${change.targetId ?? ""}`;
    // LLM changes replace a deterministic change for the same target, since they tend to read better.
    merged.set(key, change);
  }

  const changes = [...merged.values()].filter((change) => change.kind !== "experience_reorder" || true).slice(0, 24);
  return { changes, warnings };
}

/* ------------------------------------------------------------------ */
/* Finalize                                                            */
/* ------------------------------------------------------------------ */

export function finalizeTailorResult(
  base: ResumeData,
  jd: ExtractedJd,
  changes: TailorChange[],
  generatedBy: "rules" | "llm",
  extraWarnings: string[] = [],
): TailorResult {
  const tailored = applyTailorChanges(base, changes);
  const sourceText = resumeToPlainText(base);
  const tailoredText = resumeToPlainText(tailored);
  const before = analyzeResume({ resume: base, jd, rawText: sourceText });
  const after = analyzeResume({ resume: tailored, jd, rawText: tailoredText });
  const covered = jd.keywords
    .filter((k) => matchKeyword(k.keyword, tailoredText, k.type, k.importance).matchType !== "missing")
    .map((k) => k.keyword);
  const uncovered = jd.keywords.filter((k) => !covered.includes(k.keyword)).map((k) => k.keyword);
  const warnings = [...extraWarnings];
  const mustMissing = jd.keywords.filter((k) => k.importance === "must" && !covered.includes(k.keyword));
  if (mustMissing.length) warnings.push(`${mustMissing.length} must-have keyword${mustMissing.length === 1 ? "" : "s"} still missing: ${mustMissing.slice(0, 8).map((k) => k.keyword).join(", ")}. Do not add them unless the experience is real.`);
  if (!changes.length) warnings.push("No safe automatic changes were found. Use the gap workflow for missing requirements.");

  return {
    job: jd,
    changes,
    tailored,
    scoreBefore: before.score,
    scoreAfter: after.score,
    coveredKeywords: covered,
    uncoveredKeywords: uncovered,
    warnings: [...new Set(warnings)],
    generatedBy,
  };
}

export const __tailorInternals = { buildRulesSummary, strengthenBullet, alignKeywordsToJd, sourceCorpusFor, relevanceScore };
