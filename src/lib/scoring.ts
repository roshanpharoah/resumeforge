import {
  type AnalysisIssue,
  type AnalysisMeta,
  type AnalysisResult,
  type DesignTokens,
  type ExtractedJd,
  type ParseRisk,
  type ResumeData,
  type ScoreDimension,
  type Severity,
  resumeToPlainText,
  standardHeadings,
} from "@/lib/types";
import {
  BUZZWORDS,
  CLICHES,
  PASSIVE_RX,
  STRONG_VERB_SUGGESTIONS,
  WEAK_OPENERS,
  bulletLines,
  clamp,
  countWords,
  findBannedLanguage,
  findMisspellings,
  firstVerb,
  fleschReadingEase,
  formatMonth,
  hasQuantifiedImpact,
  monthsBetween,
  parseResumeDate,
  readingGrade,
  sanitizeProse,
  startsWithActionVerb,
  titleCase,
  detectGrammarIssues,
  normalize,
} from "@/lib/text";
import { analyzeKeywords, extractJd } from "@/lib/keywords";

const WEIGHTS = {
  keywords: 30,
  sections: 15,
  format: 14,
  contact: 8,
  bullets: 15,
  readability: 7,
  spelling: 3,
  timeline: 8,
} as const;

export interface ScoreInput {
  resume: ResumeData;
  rawText?: string;
  jdText?: string;
  jd?: ExtractedJd | null;
  design?: DesignTokens;
  parseRisks?: ParseRisk[];
}

interface BulletRef {
  text: string;
  path: string;
  location: string;
  current: boolean;
  section: string;
}

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function addIssue(issues: AnalysisIssue[], issue: Omit<AnalysisIssue, "id">) {
  const id = `i_${hash(`${issue.category}|${issue.title}|${issue.location}`)}`;
  if (issues.some((i) => i.id === id)) return;
  issues.push({ ...issue, id });
}

function severityRank(s: Severity): number {
  return s === "critical" ? 0 : s === "warning" ? 1 : 2;
}

function allBullets(resume: ResumeData): BulletRef[] {
  const out: BulletRef[] = [];
  resume.experience.forEach((exp, i) => {
    exp.bullets.forEach((b, j) => {
      out.push({
        text: b.text,
        path: `experience.${i}.bullets.${j}.text`,
        location: `${exp.title || "Role"} at ${exp.company || "company"}, bullet ${j + 1}`,
        current: exp.current,
        section: `experience.${i}`,
      });
    });
  });
  resume.projects.forEach((p, i) => {
    p.bullets.forEach((b, j) => {
      out.push({
        text: b.text,
        path: `projects.${i}.bullets.${j}.text`,
        location: `${p.name || "Project"}, bullet ${j + 1}`,
        current: true,
        section: `projects.${i}`,
      });
    });
  });
  return out;
}

function isPastTense(word: string): boolean {
  return /(?:ed|ied)$/.test(word) || ["led", "built", "drove", "grew", "won", "ran", "wrote", "made", "cut", "shipped", "taught", "spent", "began", "set", "sold", "met"].includes(word);
}

function isPresentTense(word: string): boolean {
  return /(?:s|es)$/.test(word) || ["lead", "build", "drive", "grow", "win", "run", "write", "make", "cut", "ship", "teach", "spend", "begin", "set", "sell", "meet", "own", "manage"].includes(word);
}

const VAGUE_QUANTITIES = /\b(?:several|many|various|numerous|a lot of|some)\b/i;

function detectHeadings(rawText: string): { found: string[]; unknown: string[] } {
  const found: string[] = [];
  const unknown: string[] = [];
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 40);
  for (const line of lines) {
    const cleaned = normalize(line.replace(/[:•|]+$/g, ""));
    if (standardHeadings.includes(cleaned)) {
      if (!found.includes(cleaned)) found.push(cleaned);
      continue;
    }
    if (/^(work history|employment history|career history|professional background|experience & skills|qualifications|core competencies|accomplishments|interests|references|volunteer|volunteering)$/i.test(cleaned)) {
      unknown.push(line);
    }
  }
  return { found, unknown };
}

function yearsOfExperience(resume: ResumeData): number {
  const now = new Date();
  let earliest = Infinity;
  let latest = 0;
  for (const exp of resume.experience) {
    const start = parseResumeDate(exp.startDate);
    const end = exp.current ? { year: now.getFullYear(), month: now.getMonth() + 1 } : parseResumeDate(exp.endDate);
    if (start) earliest = Math.min(earliest, start.year + (start.month - 1) / 12);
    if (end) latest = Math.max(latest, end.year + (end.month - 1) / 12);
  }
  if (!Number.isFinite(earliest) || !latest) {
    return resume.experience.length ? Math.min(2, resume.experience.length * 0.6) : 0;
  }
  return Math.max(0, Math.round((latest - earliest) * 10) / 10);
}

function experienceLevel(years: number, resume: ResumeData): AnalysisMeta["experienceLevel"] {
  const seniorTitle = resume.experience.some((e) => /\b(?:senior|staff|principal|lead|director|head|vp|manager)\b/i.test(e.title));
  if (years >= 12 || (years >= 8 && seniorTitle)) return "lead";
  if (years >= 7) return "senior";
  if (years >= 3) return "mid";
  if (years >= 1 || resume.experience.length > 0) return "early";
  return "fresher";
}

function expectedWordBudget(level: AnalysisMeta["experienceLevel"]): number {
  return level === "fresher" ? 560 : level === "early" ? 680 : level === "mid" ? 900 : 1150;
}

/* ------------------------------------------------------------------ */
/* Dimension: sections                                                 */
/* ------------------------------------------------------------------ */

function scoreSections(resume: ResumeData, rawText: string, level: AnalysisMeta["experienceLevel"], issues: AnalysisIssue[]): ScoreDimension {
  const details: string[] = [];
  let score = 0;
  const hasExperience = resume.experience.length > 0;
  const hasProjects = resume.projects.length > 0;
  const skillCount = resume.skills.reduce((n, g) => n + g.skills.length, 0);

  if (resume.summary.trim().length >= 25) {
    score += 2;
    details.push("Summary present and specific.");
  } else {
    details.push("Summary is missing or too short.");
    addIssue(issues, {
      severity: "warning",
      category: "sections",
      title: "Add a focused summary",
      location: "Summary",
      why: "Recruiters use the top third of the page to decide whether to keep reading. A 2 to 3 sentence summary gives them a reason.",
      fix: { kind: "ask", label: "Generate a summary", patch: { op: "open_tool", tool: "summary" } },
    });
  }

  if (hasExperience) {
    score += 4;
    details.push(`${resume.experience.length} experience ${resume.experience.length === 1 ? "entry" : "entries"}.`);
  } else if (level === "fresher" && hasProjects) {
    score += 4;
    details.push("Projects used in place of work experience for an early-career profile.");
  } else {
    details.push("No experience entries found.");
    addIssue(issues, {
      severity: level === "fresher" ? "warning" : "critical",
      category: "sections",
      title: level === "fresher" ? "Add academic or internship projects" : "Add work experience",
      location: "Experience",
      why: "Experience is the section most ATS parsers use to build your work history. Without it, the resume reads as incomplete.",
      fix: { kind: "review", label: "Add experience", patch: { op: "add_section", section: "experience" } },
    });
  }

  if (resume.education.length) {
    score += 3;
    details.push("Education section present.");
  } else {
    details.push("No education found.");
    addIssue(issues, {
      severity: "warning",
      category: "sections",
      title: "Add education",
      location: "Education",
      why: "Many ATS forms require degree and institution fields. A missing education section often reads as an omission.",
      fix: { kind: "review", label: "Add education", patch: { op: "add_section", section: "education" } },
    });
  }

  if (skillCount >= 5) {
    score += 3;
    details.push(`${skillCount} skills listed.`);
  } else {
    details.push(`Only ${skillCount} skills listed.`);
    addIssue(issues, {
      severity: "warning",
      category: "sections",
      title: "List the tools you actually use",
      location: "Skills",
      why: "ATS keyword matching depends on a concrete skills section. Group tools by category so both people and parsers can scan them.",
      fix: { kind: "review", label: "Add skills", patch: { op: "add_section", section: "skills" } },
    });
  }

  if (hasProjects) {
    score += 1;
    details.push("Projects add evidence beyond job duties.");
  } else {
    details.push("No projects section.");
  }

  if (resume.certifications.length || resume.awards.length) {
    score += 1;
    details.push("Certifications or awards present.");
  } else {
    details.push("No certifications or awards.");
  }

  const headings = detectHeadings(rawText);
  const requiredHeadings = ["experience", "education", "skills"];
  const foundRequired = requiredHeadings.filter((h) => headings.found.some((f) => f.includes(h)));
  if (headings.unknown.length) {
    addIssue(issues, {
      severity: "warning",
      category: "sections",
      title: "Use standard section headings",
      location: headings.unknown[0],
      why: "ATS software maps sections by heading. Creative labels such as Work History or Core Competencies can be skipped or misfiled.",
      fix: { kind: "review", label: "Rename heading", patch: { op: "set_heading", value: standardHeadings[0] } },
    });
  }
  if (foundRequired.length >= 2 || (level === "fresher" && headings.found.length >= 2)) {
    score += 1;
    details.push("Standard headings detected.");
  } else {
    details.push("Few standard headings detected in the plain-text parse.");
    addIssue(issues, {
      severity: "warning",
      category: "sections",
      title: "Standard headings are hard to detect",
      location: "Section headings",
      why: "If headings are not plain text lines, the ATS may merge sections or drop them from the structured profile.",
      fix: { kind: "review", label: "Fix headings", patch: { op: "open_tool", tool: "editor" } },
    });
  }

  return {
    key: "sections",
    label: "Sections and headings",
    score: clamp(score, 0, WEIGHTS.sections),
    max: WEIGHTS.sections,
    summary: `${Math.round((score / WEIGHTS.sections) * 100)}% complete`,
    details,
  };
}

/* ------------------------------------------------------------------ */
/* Dimension: contact                                                  */
/* ------------------------------------------------------------------ */

function scoreContact(resume: ResumeData, issues: AnalysisIssue[]): ScoreDimension {
  const c = resume.contact;
  const details: string[] = [];
  let score = 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(c.email.trim());
  const phoneDigits = (c.phone ?? "").replace(/\D/g, "");

  if (c.fullName.trim().split(/\s+/).filter(Boolean).length >= 2) {
    score += 1.5;
    details.push("Full name present.");
  } else {
    details.push("Full name is missing or incomplete.");
    addIssue(issues, {
      severity: "critical",
      category: "contact",
      title: "Add your full name",
      location: "Contact",
      why: "ATS profiles are keyed to a candidate name. A missing or split name can create a duplicate profile.",
      fix: { kind: "none", label: "Edit contact details" },
    });
  }

  if (emailValid) {
    score += 2.5;
    details.push("Email format is valid.");
  } else {
    details.push("Email is missing or invalid.");
    addIssue(issues, {
      severity: "critical",
      category: "contact",
      title: "Add a valid email address",
      location: "Contact",
      why: "Recruiters and ATS confirmation emails need a working address. A malformed address can void the application.",
      fix: { kind: "none", label: "Edit contact details" },
    });
  }

  if (phoneDigits.length >= 7 && phoneDigits.length <= 15) {
    score += 1.5;
    details.push("Phone number is parseable.");
  } else {
    details.push("Phone number is missing or incomplete.");
    addIssue(issues, {
      severity: "warning",
      category: "contact",
      title: "Add a reachable phone number",
      location: "Contact",
      why: "Some recruiters still call first. A missing number also weakens the ATS contact block.",
      fix: { kind: "none", label: "Edit contact details" },
    });
  }

  if (c.location?.trim()) {
    score += 1;
    details.push("Location present.");
  } else {
    details.push("Location missing.");
    addIssue(issues, {
      severity: "info",
      category: "contact",
      title: "Add your city and region",
      location: "Contact",
      why: "Location helps ATS filters for onsite and hybrid roles. Use city and region, not a full street address.",
      fix: { kind: "none", label: "Edit contact details" },
    });
  }

  if (/linkedin\.com\/in\/|\/in\//i.test(c.linkedin ?? "") || (c.linkedin ?? "").trim().length > 2) {
    score += 1;
    details.push("LinkedIn present.");
  } else {
    details.push("No LinkedIn URL.");
    addIssue(issues, {
      severity: "info",
      category: "contact",
      title: "Add a LinkedIn URL",
      location: "Contact",
      why: "Most recruiters cross-check LinkedIn. Use the clean public URL so it stays clickable in the PDF.",
      fix: { kind: "none", label: "Edit contact details" },
    });
  }

  if ((c.website ?? "").trim() || (c.github ?? "").trim()) {
    score += 0.5;
    details.push("Portfolio or GitHub present.");
  } else {
    details.push("No portfolio or GitHub link.");
  }

  if (c.email && c.email !== c.email.toLowerCase()) {
    addIssue(issues, {
      severity: "info",
      category: "contact",
      title: "Check email capitalization",
      location: "Contact",
      why: "Mixed case is usually harmless, but lowercase avoids confusion when recruiters retype addresses.",
      fix: { kind: "auto", label: "Lowercase email", patch: { op: "replace_text", path: "contact.email", value: c.email.toLowerCase() } },
    });
  }

  return {
    key: "contact",
    label: "Contact details",
    score: Math.min(score, WEIGHTS.contact),
    max: WEIGHTS.contact,
    summary: emailValid && phoneDigits.length >= 7 ? "Reachable and complete" : "Needs contact cleanup",
    details,
  };
}

/* ------------------------------------------------------------------ */
/* Dimension: format                                                   */
/* ------------------------------------------------------------------ */

function scoreFormat(design: DesignTokens | undefined, parseRisks: ParseRisk[], rawText: string, issues: AnalysisIssue[]): ScoreDimension {
  let score = WEIGHTS.format;
  const details: string[] = [];
  const risks = [...parseRisks];

  if (design?.atsRisk === "low") {
    score -= 1;
    details.push("Template has a small ATS risk.");
  } else if (design?.atsRisk === "medium") {
    score -= 4;
    details.push("Template has a moderate ATS risk.");
  } else if (design?.atsRisk === "high") {
    score -= 8;
    details.push("Template has a high ATS risk.");
    addIssue(issues, {
      severity: "warning",
      category: "format",
      title: "Switch to a single-column layout",
      location: "Layout",
      why: "Multi-column and sidebar layouts are read in unpredictable order. Critical content can land in the wrong section or disappear.",
      fix: { kind: "review", label: "Open design controls", patch: { op: "open_tool", tool: "design" } },
    });
  } else {
    details.push("Single-column, standard layout.");
  }

  if (design?.columns === 2 && design.atsRisk !== "high") {
    score -= 2;
    details.push("Two columns detected.");
    addIssue(issues, {
      severity: "warning",
      category: "format",
      title: "Two columns reduce parse reliability",
      location: "Layout",
      why: "Even when the PDF looks fine, ATS text extraction often reads across columns line by line.",
      fix: { kind: "review", label: "Use one column", patch: { op: "open_tool", tool: "design" } },
    });
  }

  const severityCost: Record<Severity, number> = { critical: 3, warning: 1.5, info: 0.5 };
  const riskDeduction = Math.min(8, risks.reduce((sum, r) => sum + severityCost[r.severity], 0));
  score -= riskDeduction;
  for (const risk of risks.slice(0, 6)) {
    details.push(`${risk.label} (${risk.severity})`);
    addIssue(issues, {
      severity: risk.severity,
      category: "format",
      title: risk.label,
      location: risk.detectedIn === "pdf" ? "Uploaded PDF" : risk.detectedIn === "docx" ? "Uploaded DOCX" : "Resume",
      why: risk.detail,
      fix: { kind: "review", label: "Review formatting", patch: { op: "open_tool", tool: "design" } },
    });
  }
  if (!risks.length) details.push("No tables, text boxes or graphics detected.");

  if (!rawText.trim() || rawText.trim().length < 120) {
    score -= 6;
    details.push("Very little machine-readable text.");
    addIssue(issues, {
      severity: "critical",
      category: "format",
      title: "Resume text could not be read reliably",
      location: "Document",
      why: "If the extractor cannot read the text, neither can the ATS. Upload a text-based PDF or DOCX instead of a scan.",
      fix: { kind: "review", label: "Re-upload", patch: { op: "open_tool", tool: "upload" } },
    });
  } else {
    details.push(`${countWords(rawText)} words are machine-readable.`);
  }

  if (design?.fontBody && !/^(inter|arial|calibri|helvetica|georgia|garamond|times new roman|cambria|source sans 3|lato)$/i.test(design.fontBody)) {
    score -= 1;
    details.push(`Non-standard body font: ${design.fontBody}.`);
    addIssue(issues, {
      severity: "info",
      category: "format",
      title: "Use a standard body font",
      location: "Typography",
      why: "Decorative or licensed fonts can substitute on the recruiter's machine and shift the layout.",
      fix: { kind: "review", label: "Change font", patch: { op: "open_tool", tool: "design" } },
    });
  }

  return {
    key: "format",
    label: "Format and parseability",
    score: clamp(Math.round(score * 10) / 10, 0, WEIGHTS.format),
    max: WEIGHTS.format,
    summary: risks.length ? `${risks.length} parse risk${risks.length === 1 ? "" : "s"} found` : "Clean, parser-friendly structure",
    details,
  };
}

/* ------------------------------------------------------------------ */
/* Dimension: bullets                                                  */
/* ------------------------------------------------------------------ */

interface BulletStats {
  quality: number;
  weakOpeners: number;
  noMetrics: number;
  passive: number;
  tooLong: number;
  repeatedVerbs: number;
}

export function scoreBulletText(text: string, current = false): number {
  let q = 0;
  if (startsWithActionVerb(text)) q += 20;
  if (!WEAK_OPENERS.some((w) => normalize(text).startsWith(w))) q += 10;
  if (hasQuantifiedImpact(text)) q += 20;
  const wc = countWords(text);
  if (wc >= 8 && wc <= 32) q += 15;
  else if (wc >= 5 && wc <= 40) q += 8;
  if (!/\b(?:i|me|my|we|our)\b/i.test(text)) q += 5;
  if (!PASSIVE_RX.test(text)) q += 10;
  if (!VAGUE_QUANTITIES.test(text)) q += 5;
  if (!findBannedLanguage(text).length) q += 5;
  if (!/\[[^\]]+\]/.test(text)) q += 10;
  if (current) q += 0;
  return clamp(Math.round(q), 0, 100);
}

function scoreBullets(resume: ResumeData, level: AnalysisMeta["experienceLevel"], issues: AnalysisIssue[]): ScoreDimension & { stats: BulletStats } {
  const bullets = allBullets(resume);
  const details: string[] = [];
  const stats: BulletStats = { quality: 0, weakOpeners: 0, noMetrics: 0, passive: 0, tooLong: 0, repeatedVerbs: 0 };

  if (!bullets.length) {
    addIssue(issues, {
      severity: "critical",
      category: "bullets",
      title: "Add achievement bullets",
      location: "Experience",
      why: "Duties describe the job. Bullets describe what changed because you did the job. ATS ranking and human skimming both reward evidence.",
      fix: { kind: "ask", label: "Write my first bullet", patch: { op: "open_tool", tool: "bullet-rewrite" } },
    });
    return {
      key: "bullets",
      label: "Bullet quality",
      score: 0,
      max: WEIGHTS.bullets,
      summary: "No bullets to score",
      details: ["Add at least 3 achievement bullets to your most recent role."],
      stats,
    };
  }

  const perSection = new Map<string, string[]>();
  for (const b of bullets) {
    const arr = perSection.get(b.section) ?? [];
    arr.push(firstVerb(b.text));
    perSection.set(b.section, arr);
  }
  let repeatPenalty = 0;
  for (const [section, verbs] of perSection) {
    const counts = new Map<string, number>();
    for (const v of verbs) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    for (const [verb, count] of counts) {
      if (count > 1) {
        stats.repeatedVerbs += count - 1;
        repeatPenalty += Math.min(5, count - 1);
        addIssue(issues, {
          severity: "info",
          category: "bullets",
          title: `Repeated opening verb: "${verb}"`,
          location: section.replace(".", " "),
          why: "Repeated verbs make bullets blur together. Vary the action so each achievement reads as a distinct contribution.",
          fix: { kind: "ask", label: "Rewrite variations", patch: { op: "open_tool", tool: "bullet-rewrite" } },
        });
      }
    }
  }

  let total = 0;
  let idx = 0;
  for (const b of bullets) {
    const q = scoreBulletText(b.text, b.current);
    total += q;
    const wc = countWords(b.text);
    const lower = normalize(b.text);
    const weak = WEAK_OPENERS.find((opener) => lower.startsWith(opener));
    const noVerb = !startsWithActionVerb(b.text);
    const noMetric = !hasQuantifiedImpact(b.text);
    const passive = PASSIVE_RX.test(b.text);
    const firstPerson = /\b(?:i|me|my|we|our)\b/i.test(b.text);
    const buzz = findBannedLanguage(b.text);
    const placeholder = /\[[^\]]+\]/.test(b.text);

    if (weak) stats.weakOpeners += 1;
    if (noMetric) stats.noMetrics += 1;
    if (passive) stats.passive += 1;
    if (wc > 36) stats.tooLong += 1;

    if (idx < 12) {
      if (placeholder) {
        addIssue(issues, {
          severity: "critical",
          category: "bullets",
          title: "Placeholder blocks export",
          location: b.location,
          why: "Generated content cannot ship with an unresolved metric. Add the real number or remove the claim.",
          fix: {
            kind: "ask",
            label: "Fill the placeholder",
            patch: { op: "fill_placeholder", path: b.path, prompt: "What real number belongs here? If you do not know, remove the metric." },
          },
        });
      }
      if (weak) {
        const opener = weak;
        const replacement = STRONG_VERB_SUGGESTIONS[opener] ?? "Owned";
        const newText = sanitizeProse(
          b.text.replace(new RegExp(`^${opener.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s+`, "i"), `${replacement} `),
        );
        addIssue(issues, {
          severity: "warning",
          category: "bullets",
          title: `Weak opener: "${titleCase(opener)}"`,
          location: b.location,
          why: "Starting with a duty phrase hides the action. Lead with a verb that describes what you did.",
          fix: { kind: "auto", label: `Start with "${replacement}"`, patch: { op: "replace_text", path: b.path, value: newText } },
        });
      } else if (noVerb) {
        addIssue(issues, {
          severity: "info",
          category: "bullets",
          title: "Bullet does not start with an action verb",
          location: b.location,
          why: "Recruiters scan the first word of each bullet. A concrete verb creates momentum.",
          fix: { kind: "ask", label: "Rewrite with a strong verb", patch: { op: "open_tool", tool: "bullet-rewrite", payload: { path: b.path } } },
        });
      }
      if (noMetric) {
        addIssue(issues, {
          severity: "warning",
          category: "bullets",
          title: "No measurable outcome",
          location: b.location,
          why: "A number makes the size of the work credible. Use a real figure or remove the claim instead of guessing.",
          fix: {
            kind: "ask",
            label: "Add a real metric",
            patch: { op: "open_tool", tool: "bullet-rewrite", payload: { path: b.path, askMetric: true } },
          },
        });
      }
      if (wc > 36) {
        addIssue(issues, {
          severity: "info",
          category: "bullets",
          title: "Bullet is too long",
          location: b.location,
          why: "Long bullets hide the result and break the 6 second skim. Keep one idea in 1 to 2 lines.",
          fix: { kind: "ask", label: "Tighten it", patch: { op: "open_tool", tool: "bullet-rewrite", payload: { path: b.path } } },
        });
      }
      if (passive) {
        addIssue(issues, {
          severity: "warning",
          category: "bullets",
          title: "Passive voice",
          location: b.location,
          why: "Passive phrasing obscures who did the work. Name the action and the owner.",
          fix: { kind: "ask", label: "Make it active", patch: { op: "open_tool", tool: "bullet-rewrite", payload: { path: b.path } } },
        });
      }
      if (firstPerson) {
        addIssue(issues, {
          severity: "info",
          category: "bullets",
          title: "First-person pronoun",
          location: b.location,
          why: "Resume convention drops I, we and my. The implied subject is you.",
          fix: { kind: "ask", label: "Remove pronouns", patch: { op: "open_tool", tool: "bullet-rewrite", payload: { path: b.path } } },
        });
      }
      if (buzz.length) {
        const fallback = sanitizeProse(b.text);
        addIssue(issues, {
          severity: "warning",
          category: "bullets",
          title: `Replace "${buzz[0].phrase}"`,
          location: b.location,
          why: "This phrase appears on thousands of resumes. It signals effort without evidence.",
          fix:
            fallback !== b.text
              ? { kind: "auto", label: "Use plain wording", patch: { op: "replace_text", path: b.path, value: fallback } }
              : { kind: "ask", label: "Rewrite it", patch: { op: "open_tool", tool: "bullet-rewrite", payload: { path: b.path } } },
        });
      }
    }
    idx++;
  }

  // Tense consistency per role
  for (let i = 0; i < resume.experience.length; i++) {
    const exp = resume.experience[i];
    if (!exp.bullets.length) continue;
    const verbs = exp.bullets.map((b) => firstVerb(b.text));
    const past = verbs.filter(isPastTense).length;
    const present = verbs.filter(isPresentTense).length;
    if (exp.current && past > present + 1) {
      addIssue(issues, {
        severity: "info",
        category: "bullets",
        title: "Current role uses past tense",
        location: `${exp.title} at ${exp.company}`,
        why: "Use present tense for work you still do. It signals that the impact is ongoing.",
        fix: { kind: "ask", label: "Fix tense", patch: { op: "open_tool", tool: "proofread" } },
      });
    } else if (!exp.current && present > past + 1) {
      addIssue(issues, {
        severity: "info",
        category: "bullets",
        title: "Past role uses present tense",
        location: `${exp.title} at ${exp.company}`,
        why: "Past roles should use past tense. Mixed tense reads as careless editing.",
        fix: { kind: "ask", label: "Fix tense", patch: { op: "open_tool", tool: "proofread" } },
      });
    }
  }

  if (!level.match(/fresher/) && bullets.length < 3) {
    addIssue(issues, {
      severity: "warning",
      category: "bullets",
      title: "Too few bullets for the experience level",
      location: "Experience",
      why: "Most roles need 3 to 5 bullets to show scope, action and outcome. One bullet reads thin.",
      fix: { kind: "ask", label: "Add bullets", patch: { op: "open_tool", tool: "bullet-rewrite" } },
    });
  }

  const average = Math.round(total / bullets.length);
  stats.quality = average;
  details.push(`Average bullet quality: ${average}/100.`);
  details.push(`${bullets.length - stats.noMetrics}/${bullets.length} bullets include a measurable outcome.`);
  details.push(`${stats.weakOpeners} weak openers, ${stats.passive} passive constructions.`);
  if (stats.repeatedVerbs) details.push(`${stats.repeatedVerbs} repeated opening verbs.`);

  let dimensionScore = (average / 100) * WEIGHTS.bullets;
  dimensionScore -= Math.min(3, repeatPenalty * 0.5);
  if (!level.match(/fresher/) && bullets.length < 3) dimensionScore -= 2;

  return {
    key: "bullets",
    label: "Bullet quality",
    score: clamp(Math.round(dimensionScore * 10) / 10, 0, WEIGHTS.bullets),
    max: WEIGHTS.bullets,
    summary: `${average}/100 average strength`,
    details,
    stats,
  };
}

/* ------------------------------------------------------------------ */
/* Dimension: readability                                              */
/* ------------------------------------------------------------------ */

function scoreReadability(
  resume: ResumeData,
  rawText: string,
  wordCount: number,
  pages: number,
  level: AnalysisMeta["experienceLevel"],
  issues: AnalysisIssue[],
): ScoreDimension {
  const bodyText = [resume.summary, ...resume.experience.flatMap((e) => e.bullets.map((b) => b.text))].join(" ");
  const ease = fleschReadingEase(bodyText || rawText);
  const avgBulletWords = (() => {
    const bullets = resume.experience.flatMap((e) => e.bullets).map((b) => countWords(b.text));
    return bullets.length ? bullets.reduce((a, b) => a + b, 0) / bullets.length : 0;
  })();
  const banned = findBannedLanguage(`${resume.summary} ${rawText}`);
  const budget = expectedWordBudget(level);
  let score = WEIGHTS.readability;
  const details: string[] = [];

  if (ease >= 45) details.push(`Reading ease ${Math.round(ease)} (plain enough).`);
  else {
    score -= 1.5;
    details.push(`Reading ease ${Math.round(ease)} (dense).`);
    addIssue(issues, {
      severity: "warning",
      category: "readability",
      title: "Sentences are dense",
      location: "Summary and bullets",
      why: "Short sentences with concrete subjects are easier to skim. Aim for 12 to 20 words per bullet.",
      fix: { kind: "ask", label: "Simplify wording", patch: { op: "open_tool", tool: "proofread" } },
    });
  }

  if (avgBulletWords > 28) {
    score -= 1;
    details.push(`Average bullet length ${Math.round(avgBulletWords)} words, above the 12 to 24 target.`);
  } else if (avgBulletWords > 0) {
    details.push(`Average bullet length ${Math.round(avgBulletWords)} words.`);
  }

  if (banned.length) {
    const deduction = Math.min(1.5, banned.length * 0.2);
    score -= deduction;
    details.push(`${banned.length} buzzword or cliche occurrence${banned.length === 1 ? "" : "s"}.`);
    const unique = [...new Set(banned.map((b) => b.phrase))].slice(0, 5);
    for (const phrase of unique) {
      addIssue(issues, {
        severity: "warning",
        category: "readability",
        title: `Buzzword: "${phrase}"`,
        location: resume.summary.toLowerCase().includes(phrase) ? "Summary" : "Resume body",
        why: "Generic praise does not survive contact with a recruiter. Replace it with a specific outcome or tool.",
        fix:
          sanitizeProse(resume.summary) !== resume.summary && resume.summary.toLowerCase().includes(phrase)
            ? { kind: "auto", label: "Clean up summary", patch: { op: "replace_text", path: "summary", value: sanitizeProse(resume.summary) } }
            : { kind: "review", label: "Find in editor", patch: { op: "open_tool", tool: "proofread" } },
      });
    }
  } else {
    details.push("No common buzzwords or cliches.");
  }

  if (pages > (level === "fresher" || level === "early" ? 1 : 2)) {
    score -= 1.5;
    details.push(`${pages} pages, above the recommended length.`);
    addIssue(issues, {
      severity: "warning",
      category: "readability",
      title: "Resume is longer than expected",
      location: "Document",
      why: `For a ${level} candidate, ${level === "fresher" || level === "early" ? "one page" : "1 to 2 pages"} is usually enough. Extra pages dilute the strongest evidence.`,
      fix: { kind: "review", label: "Open one-page assistant", patch: { op: "open_tool", tool: "one-page" } },
    });
  } else {
    details.push(`${pages} page${pages === 1 ? "" : "s"} at ${wordCount} words.`);
  }

  if (wordCount > budget) {
    score -= 1;
    details.push(`${wordCount} words, above the ${budget} word budget for this level.`);
  } else if (wordCount < budget * 0.35) {
    score -= 0.5;
    details.push(`Only ${wordCount} words. There may be room for more evidence.`);
  } else {
    details.push(`Word count fits the ${level} level.`);
  }

  if (resume.summary && countWords(resume.summary) > 90) {
    score -= 0.5;
    details.push("Summary is longer than 90 words.");
  }

  return {
    key: "readability",
    label: "Readability and length",
    score: clamp(Math.round(score * 10) / 10, 0, WEIGHTS.readability),
    max: WEIGHTS.readability,
    summary: `Grade ${readingGrade(bodyText || rawText).toFixed(1)}, ${wordCount} words`,
    details,
  };
}

/* ------------------------------------------------------------------ */
/* Dimension: spelling and grammar                                     */
/* ------------------------------------------------------------------ */

interface FieldRef {
  path: string;
  value: string;
  location: string;
}

function textFields(resume: ResumeData): FieldRef[] {
  const fields: FieldRef[] = [
    { path: "summary", value: resume.summary, location: "Summary" },
    { path: "contact.headline", value: resume.contact.headline ?? "", location: "Headline" },
  ];
  resume.experience.forEach((e, i) => {
    fields.push({ path: `experience.${i}.title`, value: e.title, location: `Experience ${i + 1} title` });
    e.bullets.forEach((b, j) => fields.push({ path: `experience.${i}.bullets.${j}.text`, value: b.text, location: `Experience ${i + 1}, bullet ${j + 1}` }));
  });
  resume.projects.forEach((p, i) => {
    p.bullets.forEach((b, j) => fields.push({ path: `projects.${i}.bullets.${j}.text`, value: b.text, location: `Project ${i + 1}, bullet ${j + 1}` }));
  });
  resume.education.forEach((e, i) => {
    if (e.details) fields.push({ path: `education.${i}.details`, value: e.details, location: `Education ${i + 1}` });
  });
  resume.custom.forEach((c, i) => fields.push({ path: `custom.${i}.content`, value: c.content, location: c.title || `Additional section ${i + 1}` }));
  return fields.filter((f) => f.value?.trim());
}

function fieldContaining(fields: FieldRef[], needle: string): FieldRef | undefined {
  return fields.find((f) => f.value.toLowerCase().includes(needle.toLowerCase()));
}

function scoreSpelling(resume: ResumeData, issues: AnalysisIssue[]): ScoreDimension {
  const fields = textFields(resume);
  const combined = fields.map((f) => f.value).join("\n");
  const misspellings = findMisspellings(combined);
  const grammar = detectGrammarIssues(combined);
  let score = WEIGHTS.spelling;
  const details: string[] = [];

  if (!misspellings.length) details.push("No common misspellings found.");
  else {
    score -= Math.min(WEIGHTS.spelling, misspellings.length * 0.4);
    details.push(`${misspellings.length} likely misspelling${misspellings.length === 1 ? "" : "s"}.`);
    for (const issue of misspellings.slice(0, 8)) {
      const field = fieldContaining(fields, issue.word);
      const regex = new RegExp(`\\b${issue.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      const newValue = field?.value.replace(regex, issue.suggestion);
      addIssue(issues, {
        severity: "warning",
        category: "spelling",
        title: `"${issue.word}" looks misspelled`,
        location: field?.location ?? "Resume",
        why: `Likely correction: "${issue.suggestion}". Spelling errors are one of the fastest ways to look careless.`,
        fix:
          field && newValue
            ? { kind: "auto", label: `Replace with "${issue.suggestion}"`, patch: { op: "replace_text", path: field.path, value: newValue } }
            : { kind: "review", label: "Review spelling", patch: { op: "open_tool", tool: "proofread" } },
      });
    }
  }

  if (grammar.length) {
    score -= Math.min(1.2, grammar.length * 0.25);
    details.push(`${grammar.length} grammar issue${grammar.length === 1 ? "" : "s"}.`);
    for (const g of grammar.slice(0, 5)) {
      addIssue(issues, {
        severity: "info",
        category: "spelling",
        title: "Grammar polish",
        location: g.quote,
        why: g.message,
        fix: { kind: "review", label: "Review in editor", patch: { op: "open_tool", tool: "proofread" } },
      });
    }
  } else {
    details.push("No repeated words or spacing issues detected.");
  }

  return {
    key: "spelling",
    label: "Spelling and grammar",
    score: clamp(Math.round(score * 10) / 10, 0, WEIGHTS.spelling),
    max: WEIGHTS.spelling,
    summary: misspellings.length + grammar.length === 0 ? "Clean" : `${misspellings.length + grammar.length} item${misspellings.length + grammar.length === 1 ? "" : "s"} to review`,
    details,
  };
}

/* ------------------------------------------------------------------ */
/* Dimension: timeline                                                 */
/* ------------------------------------------------------------------ */

function scoreTimeline(resume: ResumeData, issues: AnalysisIssue[]): ScoreDimension {
  let score = WEIGHTS.timeline;
  const details: string[] = [];
  const formats = new Set<string>();
  const missingDates: string[] = [];
  const gaps: { after: string; before: string; months: number }[] = [];
  const invalid: string[] = [];
  const now = new Date();
  const current = { year: now.getFullYear(), month: now.getMonth() + 1, format: "YYYY-MM" };

  const ordered = resume.experience
    .map((exp) => {
      const start = parseResumeDate(exp.startDate);
      const end = exp.current ? current : parseResumeDate(exp.endDate);
      if (start) formats.add(start.format);
      if (!exp.current && end) formats.add(end.format);
      if (!exp.startDate || (!exp.current && !exp.endDate)) missingDates.push(`${exp.title || "Role"} at ${exp.company || "company"}`);
      if (start && end && monthsBetween(start, end) !== null && (monthsBetween(start, end) as number) < 0) invalid.push(`${exp.title || "Role"} at ${exp.company || "company"}`);
      return { exp, start, end };
    })
    .filter((x) => x.start)
    .sort((a, b) => (a.start!.year * 12 + a.start!.month) - (b.start!.year * 12 + b.start!.month));

  for (const exp of resume.experience) {
    if (exp.current && exp.endDate) {
      addIssue(issues, {
        severity: "info",
        category: "timeline",
        title: "Current role has an end date",
        location: `${exp.title} at ${exp.company}`,
        why: "Marking the role current and adding an end date tells the ATS two different things.",
        fix: { kind: "review", label: "Fix dates", patch: { op: "open_tool", tool: "editor" } },
      });
    }
    if (exp.startDate && !parseResumeDate(exp.startDate) && !/present/i.test(exp.startDate)) {
      invalid.push(`${exp.title || "Role"} start date`);
    }
  }

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const next = ordered[i];
    if (!prev.end || !next.start) continue;
    const gap = monthsBetween(prev.end, next.start);
    if (gap !== null && gap > 6) {
      gaps.push({ after: `${prev.exp.title} at ${prev.exp.company}`, before: `${next.exp.title} at ${next.exp.company}`, months: gap });
    }
  }

  if (formats.size > 1) {
    score -= 2;
    details.push(`Mixed date formats: ${[...formats].join(", ")}.`);
    addIssue(issues, {
      severity: "warning",
      category: "timeline",
      title: "Dates use more than one format",
      location: "Experience dates",
      why: "A consistent format such as Jan 2022 reduces parse errors and looks more considered.",
      fix: { kind: "review", label: "Normalize dates", patch: { op: "open_tool", tool: "proofread" } },
    });
  } else if (formats.size === 1) {
    details.push(`Dates consistently use ${[...formats][0]}.`);
  }

  if (missingDates.length) {
    score -= Math.min(2, missingDates.length * 0.5);
    details.push(`${missingDates.length} role${missingDates.length === 1 ? "" : "s"} missing a start or end date.`);
    addIssue(issues, {
      severity: "warning",
      category: "timeline",
      title: "Role is missing dates",
      location: missingDates[0],
      why: "An ATS builds tenure from dates. Missing dates usually produce a blank or zero-length entry.",
      fix: { kind: "review", label: "Add dates", patch: { op: "open_tool", tool: "editor" } },
    });
  } else if (resume.experience.length) {
    details.push("Every role has a start and end date.");
  }

  if (invalid.length) {
    score -= Math.min(4, invalid.length * 2);
    details.push(`${invalid.length} invalid or reversed date range${invalid.length === 1 ? "" : "s"}.`);
    addIssue(issues, {
      severity: "critical",
      category: "timeline",
      title: "End date precedes start date",
      location: invalid[0],
      why: "Reversed dates corrupt tenure calculations and can make the application look fabricated.",
      fix: { kind: "review", label: "Fix date range", patch: { op: "open_tool", tool: "editor" } },
    });
  }

  for (const gap of gaps.slice(0, 3)) {
    score -= 1.2;
    details.push(`${gap.months} month gap between ${gap.after} and ${gap.before}.`);
    addIssue(issues, {
      severity: gap.months >= 12 ? "warning" : "info",
      category: "timeline",
      title: `Employment gap of ${gap.months} months`,
      location: `${gap.after} to ${gap.before}`,
      why: "A gap is not a red flag by itself. A short line about caregiving, study or a planned break prevents the reader from guessing.",
      fix: { kind: "review", label: "Add a brief note", patch: { op: "open_tool", tool: "editor" } },
    });
  }
  if (!gaps.length && resume.experience.length > 1) details.push("No employment gaps longer than 6 months.");
  if (!resume.experience.length) details.push("No work history dates to assess.");

  return {
    key: "timeline",
    label: "Dates and timeline",
    score: clamp(Math.round(score * 10) / 10, 0, WEIGHTS.timeline),
    max: WEIGHTS.timeline,
    summary: gaps.length ? `${gaps.length} gap${gaps.length === 1 ? "" : "s"} flagged` : "Consistent and chronological",
    details,
  };
}

/* ------------------------------------------------------------------ */
/* Dimension: keywords                                                 */
/* ------------------------------------------------------------------ */

function scoreKeywords(
  resumeText: string,
  jd: ExtractedJd | null,
  issues: AnalysisIssue[],
): { dimension: ScoreDimension; analysis: AnalysisResult["keywords"] } {
  if (!jd) {
    return {
      dimension: {
        key: "keywords",
        label: "Keyword match",
        score: 0,
        max: 0,
        summary: "Add a job description to score keyword match",
        details: ["Keyword matching is disabled until you paste a job description or URL."],
      },
      analysis: null,
    };
  }

  const analysis = analyzeKeywords(jd, resumeText);
  const mustWeight = jd.keywords.some((k) => k.importance === "must") ? 0.7 : 0;
  const niceWeight = 1 - mustWeight;
  const coverage = (analysis.mustHaveCoverage * mustWeight + analysis.niceToHaveCoverage * niceWeight) / 100;
  const score = Math.round(coverage * WEIGHTS.keywords * 10) / 10;
  const details = [
    `${analysis.matched.length} of ${analysis.total} target keywords found.`,
    `Must-have coverage: ${analysis.mustHaveCoverage}%. Nice-to-have coverage: ${analysis.niceToHaveCoverage}%.`,
    `Hard skills: ${analysis.hardSkillCoverage}%. Soft skills: ${analysis.softSkillCoverage}%.`,
  ];

  const missingMust = analysis.missing.filter((m) => m.importance === "must").slice(0, 8);
  const missingNice = analysis.missing.filter((m) => m.importance === "nice").slice(0, 3);

  for (const hit of missingMust) {
    addIssue(issues, {
      severity: "warning",
      category: "keywords",
      title: `Missing required keyword: ${hit.keyword}`,
      location: jd.company ? `${jd.role} at ${jd.company}` : jd.role,
      why: "This term appears in the job requirements and is not visible in your resume. Add it only if you can support it with real work, coursework or a project.",
      fix: {
        kind: "review",
        label: "Review this gap",
        patch: { op: "open_tool", tool: "gap-analysis", payload: { skill: hit.keyword, importance: "must" } },
      },
    });
  }
  for (const hit of missingNice) {
    addIssue(issues, {
      severity: "info",
      category: "keywords",
      title: `Nice-to-have keyword: ${hit.keyword}`,
      location: jd.company ? `${jd.role} at ${jd.company}` : jd.role,
      why: "This is preferred rather than required. Bridge it only where you have genuine exposure.",
      fix: { kind: "review", label: "Review this gap", patch: { op: "open_tool", tool: "gap-analysis", payload: { skill: hit.keyword } } },
    });
  }

  const semanticMatches = analysis.matched.filter((m) => m.matchType === "semantic");
  if (semanticMatches.length) {
    addIssue(issues, {
      severity: "info",
      category: "keywords",
      title: "Verify semantic keyword matches",
      location: "Skills and experience",
      why: `These were counted as related, not exact: ${semanticMatches.map((s) => `${s.keyword} (${s.matchedAs})`).join(", ")}. Confirm each one is genuinely part of your experience.`,
      fix: { kind: "review", label: "Review matches", patch: { op: "open_tool", tool: "gap-analysis" } },
    });
  }

  return {
    dimension: {
      key: "keywords",
      label: "Keyword match",
      score,
      max: WEIGHTS.keywords,
      summary: `${analysis.mustHaveCoverage}% must-have coverage`,
      details,
    },
    analysis,
  };
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

export function analyzeResume(input: ScoreInput): AnalysisResult {
  const { resume, design, parseRisks = [] } = input;
  const rawText = input.rawText?.trim() ? input.rawText : resumeToPlainText(resume);
  const jd = input.jd ?? (input.jdText?.trim() ? extractJd(input.jdText) : null);
  const combinedText = [rawText, resumeToPlainText(resume)].join("\n");
  const words = countWords(rawText);
  const bullets = allBullets(resume);
  const issues: AnalysisIssue[] = [];
  const years = yearsOfExperience(resume);
  const level = experienceLevel(years, resume);
  const pages = Math.max(1, Math.round((words + 60) / 520));

  const sections = scoreSections(resume, rawText, level, issues);
  const contact = scoreContact(resume, issues);
  const format = scoreFormat(design, parseRisks, rawText, issues);
  const bulletDim = scoreBullets(resume, level, issues);
  const readability = scoreReadability(resume, rawText, words, pages, level, issues);
  const spelling = scoreSpelling(resume, issues);
  const timeline = scoreTimeline(resume, issues);
  const { dimension: keywords, analysis } = scoreKeywords(combinedText, jd, issues);

  const breakdown: ScoreDimension[] = [
    keywords,
    { ...bulletDim, stats: undefined } as ScoreDimension,
    sections,
    format,
    contact,
    readability,
    timeline,
    spelling,
  ];

  const scoredDims = breakdown.filter((b) => b.max > 0);
  const totalScore = scoredDims.reduce((sum, d) => sum + d.score, 0);
  const totalMax = scoredDims.reduce((sum, d) => sum + d.max, 0);
  const overall = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  const meta: AnalysisMeta = {
    wordCount: words,
    bulletCount: bullets.length,
    estimatedPages: pages,
    readingGrade: Math.round(readingGrade(rawText) * 10) / 10,
    experienceYears: years,
    experienceLevel: level,
    hasJd: Boolean(jd),
    parseWarnings: parseRisks.map((r) => r.label),
  };

  return {
    score: clamp(overall, 0, 100),
    breakdown,
    issues,
    keywords: analysis,
    meta,
    generatedBy: "rules",
    createdAt: new Date().toISOString(),
  };
}

/** Quick score used by live editor controls. Excludes issue construction costs. */
export function quickScore(resume: ResumeData, jd?: ExtractedJd | null): number {
  return analyzeResume({ resume, jd }).score;
}

export const scoreWeights = WEIGHTS;
