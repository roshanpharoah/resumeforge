/**
 * Deterministic text utilities shared by the parser, analyzer and generators.
 * Everything here is pure so it can be unit tested without a database or an LLM.
 */

export const STOPWORDS = new Set(
  `a an the and or but if then than so of to in on at by for with about as into through during before after above below from up down out off over under again further once here there when where why how all any both each few more most other some such no nor not only own same too very can will just don should now i you he she it we they them their our your my me his her its who whom which what this that these those have has had do does did be been being is are was were would could may might must shall also using use used per across within without via etc role roles job work working experience experienced ability able strong excellent good great new including include includes required requirements preferred plus years year month months team teams company candidate candidates position ideal looking seeking join help support ensure ensuring provide providing across around based related relevant various multiple well highly deep broad proven track record environment environments opportunity opportunities benefits equal employer diversity apply application applicants`
    .split(/\s+/)
    .filter(Boolean),
);

const IRREGULAR_STEMS: Record<string, string> = {
  was: "be",
  were: "be",
  is: "be",
  are: "be",
  am: "be",
  been: "be",
  has: "have",
  had: "have",
  does: "do",
  did: "do",
  went: "go",
  gone: "go",
  ran: "run",
  built: "build",
  led: "lead",
  made: "make",
  wrote: "write",
  written: "write",
  drove: "drive",
  driven: "drive",
  grew: "grow",
  grown: "grow",
  brought: "bring",
  taught: "teach",
  thought: "think",
  won: "win",
  sent: "send",
  spent: "spend",
  began: "begin",
  begun: "begin",
  data: "data",
  analyses: "analysis",
  analysis: "analysis",
};

/** Light Porter-style stemmer. Good enough for keyword matching. */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9+#.]/g, "");
  if (!w) return "";
  if (IRREGULAR_STEMS[w]) return IRREGULAR_STEMS[w];
  if (w.length <= 3) return w;
  w = w.replace(/(?:ies|ied)$/, "y");
  w = w.replace(/(?:sses|shes|ches|xes)$/, (m) => m.slice(0, -2));
  w = w.replace(/(?:ing|edly|edness|ness|ments|ment|tions|tion|sion|sions|ers|er|ies|ed|es|s)$/i, (suffix) => {
    if (suffix === "s" && /(?:ss|us|is)$/.test(w)) return "s";
    if (suffix === "es" && /(?:ss|sh|ch|x)$/.test(w.slice(0, -2))) return "es";
    return "";
  });
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  if (/([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, " ")
    .replace(/[^\w\s+#./'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter((t) => t.length > 0);
}

export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function ngrams(tokens: string[], n: number): string[] {
  if (n <= 0 || tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsPhrase(haystack: string, phrase: string): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  const escaped = escapeRegExp(p).replace(/\\ /g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

export function countPhrase(haystack: string, phrase: string): number {
  const p = phrase.trim().toLowerCase();
  if (!p) return 0;
  const escaped = escapeRegExp(p).replace(/\\ /g, "\\s+");
  const rx = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "gi");
  return (haystack.match(rx) ?? []).length;
}

export function sentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function wordsOf(text: string): string[] {
  return text.trim() ? text.trim().split(/\s+/) : [];
}

export function wordCount(text: string): number {
  return wordsOf(text).length;
}

export const countWords = wordCount;

export function bulletLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^([-•*·▪◦‣–—]|\d+[.)]\s)/.test(line) || (line.length > 30 && line.length < 320 && /^[A-Z]/.test(line) && !/:$/.test(line)))
    .map((line) => line.replace(/^([-•*·▪◦‣–—]|\d+[.)]\s+)/, "").trim())
    .filter((line) => wordCount(line) >= 4);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function truncate(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;
}

export function upperFirst(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function lowerFirst(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
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

export interface ParsedDate {
  year: number;
  month: number;
  format: string;
}

export function parseResumeDate(input: string): ParsedDate | null {
  const raw = input.trim();
  if (!raw || /present|current|now/i.test(raw)) return null;
  let m = raw.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return { year: +m[1], month: Math.min(12, Math.max(1, +m[2])), format: "YYYY-MM" };
  m = raw.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return { year: +m[2], month: Math.min(12, Math.max(1, +m[1])), format: "MM/YYYY" };
  m = raw.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return { year: +m[2], month, format: "Month YYYY" };
  }
  m = raw.match(/^(\d{4})$/);
  if (m) return { year: +m[1], month: 1, format: "YYYY" };
  m = raw.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return { year: +m[3], month, format: "Month D, YYYY" };
  }
  return null;
}

export function monthsBetween(a: ParsedDate | null, b: ParsedDate | null): number | null {
  if (!a || !b) return null;
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function formatMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Readability                                                         */
/* ------------------------------------------------------------------ */

function syllableCount(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

export function fleschReadingEase(text: string): number {
  const sentenceList = sentences(text);
  const words = wordsOf(text).filter((w) => /[a-zA-Z]/.test(w));
  if (!sentenceList.length || !words.length) return 0;
  const syllables = words.reduce((sum, w) => sum + syllableCount(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentenceList.length) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, score));
}

export function readingGrade(text: string): number {
  const sentenceList = sentences(text);
  const words = wordsOf(text).filter((w) => /[a-zA-Z]/.test(w));
  if (!sentenceList.length || !words.length) return 0;
  const syllables = words.reduce((sum, w) => sum + syllableCount(w), 0);
  const grade = 0.39 * (words.length / sentenceList.length) + 11.8 * (syllables / words.length) - 15.59;
  return Math.max(0, Math.min(20, grade));
}

/* ------------------------------------------------------------------ */
/* Resume writing rules                                                */
/* ------------------------------------------------------------------ */

export const ACTION_VERBS = [
  "led",
  "built",
  "launched",
  "designed",
  "developed",
  "created",
  "delivered",
  "implemented",
  "improved",
  "reduced",
  "increased",
  "automated",
  "migrated",
  "scaled",
  "streamlined",
  "negotiated",
  "managed",
  "owned",
  "drove",
  "grew",
  "cut",
  "saved",
  "generated",
  "won",
  "shipped",
  "architected",
  "optimized",
  "refactored",
  "trained",
  "mentored",
  "coordinated",
  "analyzed",
  "forecasted",
  "researched",
  "presented",
  "partnered",
  "established",
  "introduced",
  "rebuilt",
  "transformed",
  "accelerated",
  "diagnosed",
  "resolved",
  "standardized",
  "documented",
  "facilitated",
  "prioritized",
];

export const WEAK_OPENERS = [
  "responsible for",
  "worked on",
  "helped with",
  "assisted with",
  "assisted in",
  "involved in",
  "participated in",
  "tasked with",
  "duties included",
  "was responsible for",
  "was involved in",
  "handled",
  "managed various",
  "utilized",
  "used",
  "did",
];

export const STRONG_VERB_SUGGESTIONS: Record<string, string> = {
  "responsible for": "Owned",
  "was responsible for": "Owned",
  "worked on": "Built",
  "helped with": "Supported",
  "helped": "Supported",
  "assisted with": "Supported",
  "assisted in": "Supported",
  "involved in": "Contributed to",
  "participated in": "Contributed to",
  "tasked with": "Delivered",
  "was involved in": "Contributed to",
  handled: "Managed",
  utilized: "Used",
  used: "Applied",
  did: "Delivered",
};

export const BUZZWORDS = [
  "results-driven",
  "results driven",
  "team player",
  "hard-working",
  "hard working",
  "passionate",
  "dynamic",
  "go-getter",
  "go getter",
  "self-starter",
  "self starter",
  "detail-oriented",
  "detail oriented",
  "think outside the box",
  "synergy",
  "synergize",
  "leverage",
  "rockstar",
  "ninja",
  "guru",
  "wear many hats",
  "proven track record",
  "hit the ground running",
  "fast-paced environment",
  "excellent communication skills",
  "people person",
  "multitasker",
  "motivated",
  "innovative",
  "strategic thinker",
  "visionary",
  "world-class",
  "best-in-class",
  "cutting-edge",
  "game changer",
  "disrupt",
  "disruptive",
  "thought leader",
  "growth hacker",
  "seasoned",
  "extensive experience",
  "wide range of",
  "various",
  "responsible for",
];

export const CLICHES = [
  "responsible for",
  "duties included",
  "worked closely with",
  "excellent communication skills",
  "proven ability to",
  "ability to work",
  "able to work",
  "strong work ethic",
  "team player",
  "detail-oriented",
  "passionate about",
  "seeking a challenging",
  "looking for an opportunity",
  "utilize my skills",
  "leverage my experience",
  "hit the ground running",
  "think outside the box",
  "go above and beyond",
  "results-driven professional",
];

const COMMON_MISSPELLINGS: Record<string, string> = {
  recieve: "receive",
  recieved: "received",
  seperate: "separate",
  seperated: "separated",
  definately: "definitely",
  occured: "occurred",
  occuring: "occurring",
  sucessful: "successful",
  succesful: "successful",
  succesfully: "successfully",
  managment: "management",
  manegement: "management",
  buisness: "business",
  bussiness: "business",
  enviroment: "environment",
  enviornment: "environment",
  acheive: "achieve",
  acheived: "achieved",
  existance: "existence",
  independant: "independent",
  responsable: "responsible",
  responsability: "responsibility",
  comunication: "communication",
  communicationg: "communicating",
  collaberation: "collaboration",
  colaboration: "collaboration",
  developement: "development",
  develpment: "development",
  enginering: "engineering",
  enterpise: "enterprise",
  experiance: "experience",
  experianced: "experienced",
  knowlege: "knowledge",
  leaded: "led",
  maintainance: "maintenance",
  maintenence: "maintenance",
  neccessary: "necessary",
  necesary: "necessary",
  ocurred: "occurred",
  oportunity: "opportunity",
  oppurtunity: "opportunity",
  perfomance: "performance",
  performance: "performance",
  proffesional: "professional",
  profesional: "professional",
  projet: "project",
  recomendation: "recommendation",
  refered: "referred",
  reccomend: "recommend",
  sucess: "success",
  sucessfully: "successfully",
  thier: "their",
  tihs: "this",
  untill: "until",
  wich: "which",
  writen: "written",
  manger: "manager",
  mangers: "managers",
  particpated: "participated",
  stratgey: "strategy",
  stratagy: "strategy",
  anaylsis: "analysis",
  analize: "analyze",
  optimze: "optimize",
  automted: "automated",
  implementaion: "implementation",
  deliverd: "delivered",
  architcture: "architecture",
  databse: "database",
  cloud: "cloud",
};

export interface SpellingIssue {
  word: string;
  suggestion: string;
  index: number;
}

export function findMisspellings(text: string): SpellingIssue[] {
  const out: SpellingIssue[] = [];
  const seen = new Set<string>();
  const rx = /\b[A-Za-z][A-Za-z'-]+\b/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    const lower = m[0].toLowerCase();
    if (seen.has(lower) || lower.length < 3) continue;
    const suggestion = COMMON_MISSPELLINGS[lower];
    if (suggestion && suggestion !== lower) {
      out.push({ word: m[0], suggestion, index: m.index });
      seen.add(lower);
    }
  }
  return out.slice(0, 40);
}

export function detectGrammarIssues(text: string): { message: string; quote: string }[] {
  const issues: { message: string; quote: string }[] = [];
  const dup = text.match(/\b(\w+)\s+\1\b/gi) ?? [];
  for (const raw of dup.slice(0, 5)) {
    const word = raw.split(/\s+/)[0];
    if (!/^(that|had|has|is|was|very|can)$/i.test(word)) {
      issues.push({ message: `Repeated word: "${raw}"`, quote: raw });
    }
  }
  const spacing = text.match(/[a-z][.,;:][A-Za-z]/g) ?? [];
  for (const raw of spacing.slice(0, 5)) issues.push({ message: `Missing space after punctuation: "${raw}"`, quote: raw });
  if (/\bi\b/.test(text)) issues.push({ message: 'Pronoun "I" must be capitalized.', quote: "i" });
  return issues;
}

export const PASSIVE_RX =
  /\b(?:was|were|is|are|been|being|be)\s+(?:\w+ly\s+)?(?:built|created|designed|managed|developed|written|led|made|done|used|run|driven|implemented|delivered|improved|reduced|increased|handled|owned|launched|shipped|trained|reviewed|tested|analyzed|defined|established|maintained|supported|coordinated|executed|deployed)\b/i;

export function startsWithActionVerb(bullet: string): boolean {
  const first = normalize(bullet).split(" ")[0] ?? "";
  return ACTION_VERBS.includes(first);
}

export function firstVerb(bullet: string): string {
  return normalize(bullet).split(" ")[0] ?? "";
}

export function hasQuantifiedImpact(bullet: string): boolean {
  return /(?:\d+[%$€£]?|\$\s?\d|[€£]\s?\d|\b\d[\d,.]*\s*(?:k|m|bn|billion|million|thousand|x|percent|hours?|days?|weeks?|months?|people|users|customers|clients|markets?|countries|teams?|engineers?|projects?|accounts?|leads?|sales|revenue|costs?|tickets?)\b|\b(?:doubled|tripled|halved|cut in half|zero to one)\b)/i.test(
    bullet,
  );
}

export function findBannedLanguage(text: string): { phrase: string; index: number }[] {
  const lower = text.toLowerCase();
  const found: { phrase: string; index: number }[] = [];
  for (const phrase of [...BUZZWORDS, ...CLICHES]) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      if (!found.some((f) => f.phrase === phrase)) found.push({ phrase, index: idx });
      idx = lower.indexOf(phrase, idx + phrase.length);
    }
  }
  return found;
}

/** Writing-quality guard used on all generated prose. */
export function writingRuleViolations(text: string): string[] {
  const violations: string[] = [];
  if (/\u2014/.test(text)) violations.push("Contains an em dash.");
  if (/--/.test(text)) violations.push("Contains a double hyphen.");
  if (/[•▪◦‣]/u.test(text)) violations.push("Contains decorative separator symbols.");
  if (/\b(?:results-driven|team player|passionate|dynamic|go-getter|responsible for|synergy|leverage|rockstar|ninja)\b/i.test(text)) {
    violations.push("Contains a banned buzzword or cliche.");
  }
  const emoji = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  if (emoji) violations.push("Contains decorative emoji.");
  return violations;
}

/** Replace banned language with plain alternatives. Used as a post-processing safety net. */
export function sanitizeProse(text: string): string {
  let out = text
    .replace(/\u2014/g, ", ")
    .replace(/\s*--\s*/g, ", ")
    .replace(/[•▪◦‣]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const replacements: [RegExp, string][] = [
    [/\bresults[- ]driven\b/gi, "outcome-focused"],
    [/\bteam player\b/gi, "collaborative"],
    [/\bpassionate about\b/gi, "focused on"],
    [/\bpassionate\b/gi, "motivated"],
    [/\bdynamic\b/gi, "adaptable"],
    [/\bgo[- ]getter\b/gi, "self-starter"],
    [/\bresponsible for\b/gi, "Owned"],
    [/\bdetail[- ]oriented\b/gi, "careful"],
    [/\bleverage\b/gi, "use"],
    [/\brockstar|ninja|guru\b/gi, "specialist"],
    [/\bsynergy\b/gi, "collaboration"],
    [/\bworld[- ]class\b/gi, "strong"],
    [/\bbest[- ]in[- ]class\b/gi, "strong"],
    [/\bcutting[- ]edge\b/gi, "modern"],
    [/\bthink outside the box\b/gi, "solve problems creatively"],
    [/\bhit the ground running\b/gi, "contribute quickly"],
  ];
  for (const [rx, replacement] of replacements) out = out.replace(rx, replacement);
  return out;
}

export function titleFromRole(role: string): string {
  const cleaned = role.replace(/\s*[\(\[].*?[\)\]]/g, "").trim();
  return titleCase(cleaned || "Role");
}

export function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(/https?:\/\/[^\s)>\]]+|(?:www\.|linkedin\.com|github\.com)[^\s)>\]]+/gi) ?? []));
}

export function extractEmails(text: string): string[] {
  return Array.from(new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []));
}

export function extractPhones(text: string): string[] {
  return Array.from(
    new Set(text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) ?? []),
  );
}

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function percent(n: number): number {
  return Math.round(clamp(n, 0, 1) * 100);
}
