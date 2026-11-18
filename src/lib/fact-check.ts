import {
  type FactCheckFinding,
  type FactCheckResult,
  type ResumeData,
  type Severity,
  resumeToPlainText,
} from "@/lib/types";
import {
  containsPhrase,
  contentTokens,
  normalize,
  parseResumeDate,
  stem,
  writingRuleViolations,
} from "@/lib/text";
import { skillTaxonomy } from "@/lib/keywords";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface FactCheckInput {
  data: ResumeData;
  /** The known-good version the generated data was derived from. */
  base?: ResumeData | null;
  /** Original uploaded resume text. */
  sourceText?: string;
  /** Explicit answers the user gave during gap bridging or metric prompts. */
  answers?: string[];
  /** Target company / role names that may legitimately appear in a summary. */
  allowedEntities?: string[];
  /** Finding fingerprints the user explicitly confirmed. */
  confirmations?: string[];
  /** Compare employer, title, date and degree fields to the base. Defaults to true. */
  checkIdentity?: boolean;
}

export interface FactCheckProseInput {
  text: string;
  sources: string[];
  allowedEntities?: string[];
  confirmations?: string[];
  label?: string;
}

const MONTH_WORDS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  fifteen: "15",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  hundred: "100",
  thousand: "1000",
  million: "1000000",
};

const NON_ENTITY_TOKENS = new Set(
  [
    "the",
    "this",
    "that",
    "these",
    "those",
    "i",
    "we",
    "my",
    "our",
    "a",
    "an",
    "and",
    "but",
    "for",
    "with",
    "from",
    "in",
    "on",
    "at",
    "to",
    "of",
    "as",
    "by",
    "or",
    "if",
    "when",
    "after",
    "before",
    "using",
    "built",
    "led",
    "owned",
    "delivered",
    "managed",
    "created",
    "designed",
    "developed",
    "reduced",
    "increased",
    "improved",
    "launched",
    "implemented",
    "migrated",
    "automated",
    "supported",
    "partnered",
    "collaborated",
    "drove",
    "grew",
    "saved",
    "cut",
    "scaled",
    "streamlined",
    "optimized",
    "mentored",
    "trained",
    "coached",
    "presented",
    "analyzed",
    "forecasted",
    "researched",
    "negotiated",
    "coordinated",
    "documented",
    "standardized",
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
    "jan",
    "feb",
    "mar",
    "apr",
    "jun",
    "jul",
    "aug",
    "sep",
    "sept",
    "oct",
    "nov",
    "dec",
    "present",
    "current",
    "remote",
    "hybrid",
    "onsite",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "q1",
    "q2",
    "q3",
    "q4",
    "h1",
    "h2",
    "summary",
    "skills",
    "experience",
    "education",
    "projects",
    "certifications",
    "awards",
    "university",
    "college",
    "school",
    "bachelor",
    "master",
    "doctorate",
    "phd",
    "mba",
    "bs",
    "ba",
    "ms",
    "ma",
    "degree",
    "certificate",
    "certification",
    "professional",
    "engineer",
    "manager",
    "analyst",
    "developer",
    "designer",
    "specialist",
    "consultant",
    "director",
    "intern",
    "associate",
    "lead",
    "senior",
    "junior",
    "principal",
    "staff",
    "head",
    "vp",
    "product",
    "project",
    "program",
    "marketing",
    "sales",
    "finance",
    "operations",
    "customer",
    "success",
    "data",
    "software",
    "business",
    "team",
    "teams",
    "company",
    "companies",
    "client",
    "clients",
    "customers",
    "users",
    "people",
    "reports",
    "stakeholders",
    "industry",
    "sector",
    "global",
    "regional",
    "national",
    "new",
    "strong",
    "key",
    "core",
    "main",
    "additional",
    "resume",
  ].map((s) => s.toLowerCase()),
);

const METRIC_UNIT_NORMALIZE: Record<string, string> = {
  percent: "%",
  percentage: "%",
  thousand: "k",
  million: "m",
  billion: "b",
  hrs: "hours",
  hr: "hour",
  engineer: "engineers",
  person: "people",
  user: "users",
  customer: "customers",
  client: "clients",
  account: "accounts",
  report: "reports",
  project: "projects",
  dollar: "$",
  dollars: "$",
};

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(7, "0");
}

function fingerprintOf(location: string, claim: string, reason: string): string {
  return `fc_${hash(`${location}|${claim}|${reason}`)}`;
}

export function fingerprintFinding(finding: Pick<FactCheckFinding, "location" | "claim" | "reason">): string {
  return fingerprintOf(finding.location, finding.claim, finding.reason);
}

/* ------------------------------------------------------------------ */
/* Source preparation                                                  */
/* ------------------------------------------------------------------ */

function expandNumberWords(text: string): string {
  return text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million)\b/gi, (m) => ` ${NUMBER_WORDS[m.toLowerCase()]} `);
}

function sourceCorpus(input: Pick<FactCheckInput, "base" | "sourceText" | "answers">): string {
  const parts: string[] = [];
  if (input.sourceText) parts.push(input.sourceText);
  if (input.base) parts.push(resumeToPlainText(input.base));
  for (const bullet of input.base?.experience.flatMap((e) => e.bullets) ?? []) {
    if (bullet.source.quote) parts.push(bullet.source.quote);
  }
  if (input.answers?.length) parts.push(input.answers.join("\n"));
  return expandNumberWords(parts.join("\n") || "");
}

/**
 * Every path that checks a resume must treat saved user answers as evidence.
 * Gap answers, editor edits and accepted bullet or summary suggestions are
 * stored on the claim itself, not in the original upload.
 */
export function collectUserProvidedAnswers(data: ResumeData): string[] {
  const answers: string[] = [];
  const collect = (bullets: ResumeData["experience"][number]["bullets"]) => {
    for (const bullet of bullets) {
      if (bullet.source.type !== "user_answer") continue;
      if (bullet.source.quote?.trim()) answers.push(bullet.source.quote.trim());
      if (bullet.text.trim()) answers.push(bullet.text.trim());
    }
  };
  data.experience.forEach((experience) => collect(experience.bullets));
  data.projects.forEach((project) => collect(project.bullets));
  if (data.summarySource?.type === "user_answer") {
    if (data.summarySource.quote?.trim()) answers.push(data.summarySource.quote.trim());
    if (data.summary.trim()) answers.push(data.summary.trim());
  }
  return [...new Set(answers)];
}

interface Claim {
  text: string;
  location: string;
  path: string;
  kind: "summary" | "bullet" | "project_bullet" | "education" | "custom" | "cover_letter" | "headline";
  sourceQuote?: string;
}

function normalizeMetric(raw: string): string {
  let value = raw.toLowerCase().replace(/[$€£,\s]/g, "");
  value = value.replace(/([0-9.]+)(thousand|million|billion)/g, (_, n: string, unit: string) => {
    const multiplier = unit === "thousand" ? 1000 : unit === "million" ? 1_000_000 : 1_000_000_000;
    const num = Number(n);
    return Number.isFinite(num) ? String(Math.round(num * multiplier)) : n;
  });
  value = value.replace(/percent/g, "%").replace(/hours?|hrs?/g, "hours").replace(/days?/g, "days").replace(/weeks?/g, "weeks").replace(/months?/g, "months").replace(/years?/g, "years").replace(/yrs?/g, "years");
  return value;
}

function extractMetrics(text: string): { raw: string; normalized: string; number: string; unit: string }[] {
  const expanded = expandNumberWords(text);
  const rx = /(?:\$|€|£)?\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(%|k\b|m\b|b\b|bn\b|million|billion|thousand|x\b|hours?|hrs?|days?|weeks?|months?|years?|yrs?|people|users|customers|clients|accounts|engineers?|reports?|projects?|markets?|countries|teams?|engineers?|sales|revenue|costs?)?/gi;
  const out: { raw: string; normalized: string; number: string; unit: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(expanded))) {
    const raw = m[0].trim();
    const number = m[1].replace(/,/g, "");
    const currency = /[$€£]/.test(raw) ? "$" : "";
    const unitRaw = (m[2] ?? "").toLowerCase();
    const unit = METRIC_UNIT_NORMALIZE[unitRaw] ?? unitRaw;
    if (!number) continue;
    if (/^(?:19|20)\d{2}$/.test(number) && !unit && !currency) continue; // dates are checked separately
    out.push({ raw, normalized: normalizeMetric(`${currency}${number}${unit}`), number, unit });
  }
  return out;
}

function metricsFromCorpus(corpus: string): { normalized: Set<string>; numbers: Set<string> } {
  const normalized = new Set<string>();
  const numbers = new Set<string>();
  for (const metric of extractMetrics(corpus)) {
    normalized.add(metric.normalized);
    numbers.add(metric.number);
  }
  return { normalized, numbers };
}

function supportedByCorpus(metric: { normalized: string; number: string; unit: string }, corpus: string, metrics: ReturnType<typeof metricsFromCorpus>): boolean {
  if (metrics.normalized.has(metric.normalized)) return true;
  if (!metric.unit && metrics.numbers.has(metric.number)) return true;
  if (metric.unit && corpus.includes(metric.normalized)) return true;
  // A unit-bearing claim can be supported by the same number and the unit written out elsewhere.
  if (metric.unit && metrics.numbers.has(metric.number) && containsPhrase(corpus, metric.unit)) return true;
  return false;
}

function dateKeysFromCorpus(corpus: string): { years: Set<number>; yearMonths: Set<string> } {
  const years = new Set<number>();
  const yearMonths = new Set<string>();
  for (const raw of corpus.match(/\b(?:19|20)\d{2}\b/g) ?? []) years.add(Number(raw));
  const monthYear = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.,]?\s+((?:19|20)\d{2})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = monthYear.exec(corpus))) {
    const month = MONTH_WORDS[m[1].toLowerCase().slice(0, 4)] ?? MONTH_WORDS[m[1].toLowerCase().slice(0, 3)];
    if (month) {
      years.add(Number(m[2]));
      yearMonths.add(`${m[2]}-${String(month).padStart(2, "0")}`);
    }
  }
  const numeric = /\b((?:19|20)\d{2})[-/.](\d{1,2})\b|\b(\d{1,2})[-/.]((?:19|20)\d{2})\b/g;
  while ((m = numeric.exec(corpus))) {
    const year = Number(m[1] ?? m[4]);
    const month = Number(m[2] ?? m[3]);
    years.add(year);
    yearMonths.add(`${year}-${String(month).padStart(2, "0")}`);
  }
  return { years, yearMonths };
}

function dateSupport(value: string, keys: ReturnType<typeof dateKeysFromCorpus>): boolean {
  if (!value.trim() || /present|current|now/i.test(value)) return true;
  const parsed = parseResumeDate(value);
  if (!parsed) return false;
  if (keys.years.has(parsed.year)) return true;
  return false;
}

function allowedEntityMatch(token: string, allowedEntities: string[]): boolean {
  const t = token.toLowerCase();
  return allowedEntities.some((entity) => {
    const words = entity.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean);
    return words.includes(t) || normalize(entity) === t;
  });
}

function isSupportedEntity(token: string, corpus: string): boolean {
  if (containsPhrase(corpus, token)) return true;
  const lower = token.toLowerCase();
  if (corpus.toLowerCase().includes(lower)) return true;
  // Match known technology aliases (Postgres vs PostgreSQL).
  const entry = skillTaxonomy.find((s) => [s.canonical, ...s.aliases].some((a) => normalize(a) === normalize(token)));
  if (entry) {
    return [entry.canonical, ...entry.aliases].some((a) => containsPhrase(corpus, a));
  }
  return false;
}

function extractProperNouns(text: string): string[] {
  const found = new Set<string>();
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const tokens = sentence.match(/[A-Za-z][A-Za-z0-9+.#/-]*/g) ?? [];
    tokens.forEach((token, index) => {
      const isFirst = index === 0;
      const capitalized = /^[A-Z]/.test(token);
      const allCaps = /^[A-Z0-9+.#/-]{2,}$/.test(token);
      if (!capitalized && !allCaps) return;
      if (token.length < 2) return;
      if (isFirst && !allCaps) return;
      const lower = token.toLowerCase();
      if (NON_ENTITY_TOKENS.has(lower)) return;
      found.add(token.replace(/[.,;:)]+$/, ""));
    });
  }
  return [...found];
}

function relativeOverlap(claim: string, source: string): number {
  const claimTokens = contentTokens(claim).map(stem);
  const sourceTokens = new Set(contentTokens(source).map(stem));
  if (!claimTokens.length) return 0;
  return claimTokens.filter((t) => sourceTokens.has(t)).length / claimTokens.length;
}

/* ------------------------------------------------------------------ */
/* Core fact check                                                     */
/* ------------------------------------------------------------------ */

export function factCheckResume(input: FactCheckInput): FactCheckResult {
  const { data, base = null, confirmations = [], allowedEntities = [] } = input;
  const corpus = sourceCorpus(input);
  const corpusNorm = normalize(corpus);
  const metrics = metricsFromCorpus(corpus);
  const dates = dateKeysFromCorpus(corpus);
  const findings: FactCheckFinding[] = [];
  const baseCorpus = base ? normalize(resumeToPlainText(base)) : "";
  const confirmedSet = new Set(confirmations);

  const add = (finding: Omit<FactCheckFinding, "id" | "fingerprint" | "confirmed">) => {
    const fingerprint = fingerprintOf(finding.location, finding.claim, finding.reason);
    if (findings.some((f) => f.fingerprint === fingerprint)) return;
    const confirmable = finding.confirmable !== false;
    const confirmed = confirmable && (confirmedSet.has(fingerprint) || confirmedSet.has(finding.claim));
    findings.push({
      ...finding,
      id: fingerprint,
      fingerprint,
      confirmable,
      confirmed,
      blocking: finding.blocking && !confirmed,
    });
  };

  const claims: Claim[] = [];
  if (data.summary.trim()) {
    claims.push({
      text: data.summary,
      location: "Summary",
      path: "summary",
      kind: "summary",
      sourceQuote: data.summarySource?.quote,
    });
  }
  data.experience.forEach((exp, i) => {
    exp.bullets.forEach((b, j) => {
      claims.push({
        text: b.text,
        location: `${exp.title || "Role"} at ${exp.company || "company"}, bullet ${j + 1}`,
        path: `experience.${i}.bullets.${j}.text`,
        kind: "bullet",
        sourceQuote: b.source.quote,
      });
    });
  });
  data.projects.forEach((p, i) => {
    p.bullets.forEach((b, j) => {
      claims.push({
        text: b.text,
        location: `${p.name || "Project"}, bullet ${j + 1}`,
        path: `projects.${i}.bullets.${j}.text`,
        kind: "project_bullet",
        sourceQuote: b.source.quote,
      });
    });
  });
  data.education.forEach((e, i) => {
    if (e.details) claims.push({ text: e.details, location: `Education ${i + 1}`, path: `education.${i}.details`, kind: "education" });
  });
  data.custom.forEach((c, i) => {
    if (c.content) claims.push({ text: c.content, location: c.title || `Additional section ${i + 1}`, path: `custom.${i}.content`, kind: "custom" });
  });

  /* --- 1. Placeholders ------------------------------------------------- */
  const fieldTexts: { path: string; value: string; location: string }[] = [];
  for (const claim of claims) fieldTexts.push({ path: claim.path, value: claim.text, location: claim.location });
  data.experience.forEach((e, i) => {
    fieldTexts.push({ path: `experience.${i}.title`, value: e.title, location: `Experience ${i + 1} title` });
    fieldTexts.push({ path: `experience.${i}.company`, value: e.company, location: `Experience ${i + 1} company` });
  });
  data.skills.forEach((g, i) => fieldTexts.push({ path: `skills.${i}.skills`, value: g.skills.join(", "), location: "Skills" }));
  data.projects.forEach((p, i) => fieldTexts.push({ path: `projects.${i}.description`, value: p.description ?? "", location: `${p.name} description` }));

  for (const field of fieldTexts) {
    const match = field.value.match(/\[[^\]\n]{1,60}\]/);
    if (match) {
      add({
        severity: "critical",
        claim: match[0],
        location: field.location,
        reason: "Unresolved placeholder. Generated content cannot ship with a blank or marker value.",
        suggestion: "Replace the placeholder with a real value the user provided, or remove the claim.",
        blocking: true,
        confirmable: false,
      });
    }
    if (/\b(?:TODO|TBD|INSERT (?:METRIC|NUMBER|DATE)|XX+%?)\b/i.test(field.value)) {
      add({
        severity: "critical",
        claim: field.value.match(/\b(?:TODO|TBD|INSERT (?:METRIC|NUMBER|DATE)|XX+%?)\b/i)?.[0] ?? "TODO",
        location: field.location,
        reason: "Placeholder text was found and must be resolved before export.",
        suggestion: "Ask the user for the real value or remove the placeholder.",
        blocking: true,
        confirmable: false,
      });
    }
  }

  /* --- 2. Planned projects -------------------------------------------- */
  data.projects.forEach((p, i) => {
    if (p.planned) {
      add({
        severity: "critical",
        claim: p.name,
        location: `Project ${i + 1}`,
        reason: "A planned project is marked as part of the resume. Planned work must stay in the Planned list until it is complete and has a link.",
        suggestion: "Remove the project from the resume or mark it done with a real repository link first.",
        blocking: true,
        confirmable: false,
      });
    }
  });

  /* --- 3. Numbers and metrics ----------------------------------------- */
  for (const claim of claims) {
    const baseValue = findBaseClaim(base, claim.path);
    if (baseValue !== null && baseValue.trim() === claim.text.trim()) continue;
    const claimMetrics = extractMetrics(claim.text);
    for (const metric of claimMetrics) {
      if (supportedByCorpus(metric, corpusNorm, metrics)) continue;
      add({
        severity: "critical",
        claim: metric.raw,
        location: claim.location,
        reason: `The number "${metric.raw}" does not appear in the user's source material. Invented metrics are not allowed.`,
        suggestion: "Ask the user for the real number. If there is no number, remove the metric.",
        blocking: true,
      });
      break;
    }
  }

  /* --- 4. Proper nouns and skills in claims ---------------------------- */
  for (const claim of claims) {
    const baseValue = findBaseClaim(base, claim.path);
    if (baseValue !== null && baseValue.trim() === claim.text.trim()) continue;
    const source = claim.sourceQuote ? `${corpus}\n${claim.sourceQuote}` : corpus;

    for (const token of extractProperNouns(claim.text)) {
      if (allowedEntityMatch(token, allowedEntities)) continue;
      if (isSupportedEntity(token, source)) continue;
      // Ignore the first token of the claim when it is a common resume verb in title case.
      if (/^[A-Z][a-z]+$/.test(token) && !NON_ENTITY_TOKENS.has(token.toLowerCase()) && claim.text.trim().startsWith(token) && !isSupportedEntity(token, source)) {
        continue;
      }
      add({
        severity: "critical",
        claim: token,
        location: claim.location,
        reason: `"${token}" is not supported by the user's input. This could read as an invented employer, tool, place or credential.`,
        suggestion: "Confirm this is real and add it to the source data, or remove the mention.",
        blocking: true,
      });
      break;
    }

    for (const entry of skillTaxonomy) {
      if (entry.type !== "hard") continue;
      const alias = [entry.canonical, ...entry.aliases].find((a) => containsPhrase(claim.text, a));
      if (!alias) continue;
      const supported = [entry.canonical, ...entry.aliases].some((a) => containsPhrase(source, a));
      if (supported) continue;
      add({
        severity: "critical",
        claim: alias,
        location: claim.location,
        reason: `The tool or skill "${alias}" appears in generated text but not in the user's data. Tailoring cannot add skills the user has not demonstrated.`,
        suggestion: "Remove the skill or use the gap workflow to establish real evidence first.",
        blocking: true,
      });
      break;
    }
  }

  /* --- 5. Identity facts: employers, titles, dates, degrees, certs ----- */
  if (input.checkIdentity !== false) {
    const baseExperiences = new Map<string, (typeof data.experience)[number]>();
    const baseById = new Map(base?.experience.map((e) => [e.id, e]) ?? []);
    const baseByRole = new Map(base?.experience.map((e) => [`${normalize(e.company)}|${normalize(e.title)}`, e]) ?? []);

    data.experience.forEach((exp, i) => {
      const known = baseById.get(exp.id) ?? baseByRole.get(`${normalize(exp.company)}|${normalize(exp.title)}`) ?? base?.experience[i];
      const location = `Experience ${i + 1}`;
      const additions: { field: string; value: string; baseValue?: string; reason: string; blocking: boolean }[] = [];

      if (known) {
        if (normalize(exp.company) !== normalize(known.company)) additions.push({ field: "employer", value: exp.company, baseValue: known.company, reason: "The employer name was changed from the user's source resume.", blocking: true });
        if (normalize(exp.title) !== normalize(known.title)) additions.push({ field: "job title", value: exp.title, baseValue: known.title, reason: "The job title was changed from the user's source resume.", blocking: true });
        if (known.startDate && exp.startDate !== known.startDate) additions.push({ field: "start date", value: exp.startDate, baseValue: known.startDate, reason: "The start date was changed from the user's source resume.", blocking: true });
        if (!exp.current && known.endDate && exp.endDate !== known.endDate) additions.push({ field: "end date", value: exp.endDate, baseValue: known.endDate, reason: "The end date was changed from the user's source resume.", blocking: true });
        if (known.current !== exp.current) additions.push({ field: "current role flag", value: exp.current ? "Present" : exp.endDate, baseValue: known.current ? "Present" : known.endDate, reason: "The current-role flag was changed from the user's source resume.", blocking: true });
      } else {
        if (!containsPhrase(corpus, exp.company)) additions.push({ field: "employer", value: exp.company, reason: "This employer does not appear in the user's source material.", blocking: true });
        if (!containsPhrase(corpus, exp.title)) additions.push({ field: "job title", value: exp.title, reason: "This job title does not appear in the user's source material.", blocking: true });
        if (!dateSupport(exp.startDate, dates)) additions.push({ field: "start date", value: exp.startDate, reason: "This start date is not supported by the source material.", blocking: true });
        if (!exp.current && !dateSupport(exp.endDate, dates)) additions.push({ field: "end date", value: exp.endDate, reason: "This end date is not supported by the source material.", blocking: true });
      }

      for (const item of additions) {
        add({
          severity: "critical",
          claim: `${item.field}: ${item.value || "(blank)"}`,
          location,
          reason: item.reason,
          suggestion: "Restore the original fact, or confirm the change explicitly before export.",
          blocking: item.blocking,
          supportedBy: item.baseValue ? `Original: ${item.baseValue}` : undefined,
        });
      }
    });

    if (base) {
      const baseRoleKeys = new Set(base.experience.map((e) => `${normalize(e.company)}|${normalize(e.title)}`));
      data.experience.forEach((exp, i) => {
        if (!baseRoleKeys.has(`${normalize(exp.company)}|${normalize(exp.title)}`)) {
          add({
            severity: "critical",
            claim: `${exp.title} at ${exp.company}`,
            location: `Experience ${i + 1}`,
            reason: "This role was added after parsing. New employers, titles and dates require explicit user confirmation.",
            suggestion: "Confirm this role is real, or remove it.",
            blocking: true,
          });
        }
      });
    }

    data.education.forEach((edu, i) => {
      const baseEdu = base?.education[i];
      const location = `Education ${i + 1}`;
      if (baseEdu) {
        if (normalize(edu.institution) !== normalize(baseEdu.institution)) {
          add({ severity: "critical", claim: edu.institution, location, reason: "The institution was changed from the user's source resume.", suggestion: "Restore the original institution.", blocking: true });
        }
        if (normalize(edu.degree) !== normalize(baseEdu.degree)) {
          add({ severity: "critical", claim: edu.degree, location, reason: "The degree was changed from the user's source resume.", suggestion: "Restore the original degree.", blocking: true });
        }
      } else {
        if (!containsPhrase(corpus, edu.institution)) {
          add({ severity: "critical", claim: edu.institution, location, reason: "This institution does not appear in the user's source material.", suggestion: "Confirm the institution or remove it.", blocking: true });
        }
        if (edu.degree && !containsPhrase(corpus, edu.degree) && !/[BSMA]\.?[AS]?\.?/i.test(edu.degree)) {
          add({ severity: "critical", claim: edu.degree, location, reason: "This degree does not appear in the user's source material.", suggestion: "Confirm the degree or remove it.", blocking: true });
        }
      }
    });

    data.certifications.forEach((cert, i) => {
      if (!base?.certifications.some((c) => normalize(c.name) === normalize(cert.name)) && !containsPhrase(corpus, cert.name)) {
        add({
          severity: "critical",
          claim: cert.name,
          location: `Certification ${i + 1}`,
          reason: "This certification does not appear in the user's source material.",
          suggestion: "Add evidence of the certification or remove it.",
          blocking: true,
        });
      }
    });

    if (base) {
      const baseProjects = new Set(base.projects.map((p) => normalize(p.name)));
      data.projects.forEach((project, i) => {
        if (project.planned) return;
        if (!baseProjects.has(normalize(project.name)) && !containsPhrase(corpus, project.name)) {
          add({
            severity: "critical",
            claim: project.name,
            location: `Project ${i + 1}`,
            reason: "This project was added and cannot be traced to the user's input.",
            suggestion: "Add a description and repository link in the source data, or remove the project.",
            blocking: true,
          });
        }
      });
    }
  }

  /* --- 6. Skills traceability ----------------------------------------- */
  for (let i = 0; i < data.skills.length; i++) {
    const group = data.skills[i];
    for (const skill of group.skills) {
      if (!skill.trim()) continue;
      const supportedByBase = base?.skills.some((g) => g.skills.some((s) => normalize(s) === normalize(skill)));
      if (supportedByBase) continue;
      if (baseCorpus && containsPhrase(baseCorpus, skill)) continue;
      const entry = skillTaxonomy.find((e) => [e.canonical, ...e.aliases].some((a) => normalize(a) === normalize(skill)));
      const aliases = entry ? [entry.canonical, ...entry.aliases] : [skill];
      if (aliases.some((a) => containsPhrase(corpus, a))) continue;
      // Allow compact acronyms and degree abbreviations that are genuinely in the source.
      add({
        severity: "critical",
        claim: skill,
        location: group.name ? `Skills, ${group.name}` : "Skills",
        reason: `The skill "${skill}" is not found in the user's uploaded resume or answers. Auto-added skills are not allowed.`,
        suggestion: "Confirm this skill is real and add it through the gap workflow, or remove it.",
        blocking: true,
      });
    }
  }

  /* --- 7. Traceability of changed claims -------------------------------- */
  for (const claim of claims) {
    if (claim.kind === "education" || claim.kind === "custom") continue;
    const baseValue = findBaseClaim(base, claim.path);
    if (baseValue !== null && baseValue.trim() === claim.text.trim()) continue;
    const support = claim.sourceQuote || corpus;
    const overlap = relativeOverlap(claim.text, support);
    if (overlap < 0.34) {
      add({
        severity: "warning",
        claim: claim.text.slice(0, 140),
        location: claim.location,
        reason: "The wording does not closely trace to the saved source. Rewrites must preserve the original facts, even when the phrasing changes.",
        suggestion: "Review the source and confirm that every claim in this sentence is something the user actually did.",
        blocking: false,
      });
    }
    if (!claim.sourceQuote) {
      add({
        severity: "info",
        claim: claim.text.slice(0, 100),
        location: claim.location,
        reason: "This claim has no stored source quote. The source field points to the original resume but not the exact sentence.",
        suggestion: "Review this line before export. The fact-check guard checks entities and metrics, but a human should confirm the framing.",
        blocking: false,
      });
    }
  }

  /* --- 8. Writing rules ------------------------------------------------- */
  for (const claim of claims) {
    const violations = writingRuleViolations(claim.text);
    for (const violation of violations) {
      add({
        severity: "warning",
        claim: claim.text.slice(0, 100),
        location: claim.location,
        reason: violation,
        suggestion: "Rewrite in plain language. The writing rules apply to all generated text.",
        blocking: false,
      });
    }
  }

  const blocking = findings.filter((f) => f.blocking).length;
  const warnings = findings.filter((f) => !f.blocking).length;
  return {
    passed: blocking === 0,
    blocking,
    warnings,
    findings,
    checkedAt: new Date().toISOString(),
    confirmedFindings: confirmations,
  };
}

function findBaseClaim(base: ResumeData | null, path: string): string | null {
  if (!base) return null;
  const parts = path.split(".");
  let current: unknown = base;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    if (Array.isArray(current)) {
      const index = Number(part);
      if (Number.isNaN(index)) return null;
      current = current[index];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof current === "string" ? current : null;
}

/* ------------------------------------------------------------------ */
/* Prose fact check (cover letters, LinkedIn, outreach)                */
/* ------------------------------------------------------------------ */

export function factCheckProse(input: FactCheckProseInput): FactCheckResult {
  const { text, sources, allowedEntities = [], confirmations = [], label = "Generated text" } = input;
  const corpus = expandNumberWords([text.length ? "" : "", ...sources].join("\n"));
  const corpusNorm = normalize(corpus);
  const metrics = metricsFromCorpus(corpus);
  const confirmedSet = new Set(confirmations);
  const findings: FactCheckFinding[] = [];

  const add = (finding: Omit<FactCheckFinding, "id" | "fingerprint" | "confirmed">) => {
    const fingerprint = fingerprintOf(finding.location, finding.claim, finding.reason);
    if (findings.some((f) => f.fingerprint === fingerprint)) return;
    const confirmable = finding.confirmable !== false;
    const confirmed = confirmable && (confirmedSet.has(fingerprint) || confirmedSet.has(finding.claim));
    findings.push({ ...finding, id: fingerprint, fingerprint, confirmable, confirmed, blocking: finding.blocking && !confirmed });
  };

  const placeholder = text.match(/\[[^\]\n]{1,60}\]/);
  if (placeholder) {
    add({
      severity: "critical",
      claim: placeholder[0],
      location: label,
      reason: "Unresolved placeholder in generated prose.",
      suggestion: "Fill it with a real value or remove it.",
      blocking: true,
      confirmable: false,
    });
  }

  for (const metric of extractMetrics(text)) {
    if (supportedByCorpus(metric, corpusNorm, metrics)) continue;
    add({
      severity: "critical",
      claim: metric.raw,
      location: label,
      reason: `The number "${metric.raw}" is not present in the user's source material.`,
      suggestion: "Use a real number from the resume or remove the metric.",
      blocking: true,
    });
  }

  for (const token of extractProperNouns(text)) {
    if (allowedEntityMatch(token, allowedEntities)) continue;
    if (isSupportedEntity(token, corpus)) continue;
    // Cover letters can legitimately name the target company and role; callers pass those in.
    add({
      severity: "warning",
      claim: token,
      location: label,
      reason: `"${token}" is not found in the user's data. Confirm that the reference is accurate.`,
      suggestion: "Verify the name or remove it.",
      blocking: true,
    });
    break;
  }

  for (const entry of skillTaxonomy) {
    if (entry.type !== "hard") continue;
    const alias = [entry.canonical, ...entry.aliases].find((a) => containsPhrase(text, a));
    if (!alias) continue;
    if (![entry.canonical, ...entry.aliases].some((a) => containsPhrase(corpus, a))) {
      add({
        severity: "critical",
        claim: alias,
        location: label,
        reason: `"${alias}" is claimed in the generated prose but is absent from the user's data.`,
        suggestion: "Remove the skill claim or establish real evidence first.",
        blocking: true,
      });
      break;
    }
  }

  for (const violation of writingRuleViolations(text)) {
    add({
      severity: "warning",
      claim: text.slice(0, 100),
      location: label,
      reason: violation,
      suggestion: "Rewrite in plain language.",
      blocking: false,
    });
  }

  const blocking = findings.filter((f) => f.blocking).length;
  return {
    passed: blocking === 0,
    blocking,
    warnings: findings.length - blocking,
    findings,
    checkedAt: new Date().toISOString(),
    confirmedFindings: confirmations,
  };
}

export const __factCheckInternals = {
  extractMetrics,
  extractProperNouns,
  sourceCorpus,
  fingerprintOf,
};
