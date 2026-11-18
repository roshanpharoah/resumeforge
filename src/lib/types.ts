import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

export const uid = () => Math.random().toString(36).slice(2, 10);

export const sectionKeys = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "awards",
  "custom",
] as const;

export type SectionKey = (typeof sectionKeys)[number];

export const severitySchema = z.enum(["critical", "warning", "info"]);
export type Severity = z.infer<typeof severitySchema>;

export const sourceTypeSchema = z.enum(["user_text", "user_answer", "placeholder", "generated"]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

const sourceSchema = z.object({
  type: sourceTypeSchema.default("user_text"),
  ref: z.string().default("uploaded resume"),
  quote: z.string().optional(),
});

export type ClaimSource = z.infer<typeof sourceSchema>;

/* ------------------------------------------------------------------ */
/* Resume data                                                         */
/* ------------------------------------------------------------------ */

export const contactSchema = z.object({
  fullName: z.string().default(""),
  headline: z.string().optional().default(""),
  email: z.string().default(""),
  phone: z.string().optional().default(""),
  location: z.string().optional().default(""),
  website: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
  github: z.string().optional().default(""),
});
export type Contact = z.infer<typeof contactSchema>;

export const bulletSchema = z.object({
  id: z.string().default(uid),
  text: z.string(),
  source: sourceSchema.default({ type: "user_text", ref: "uploaded resume" }),
  verified: z.boolean().default(true),
  metricPlaceholder: z.boolean().default(false),
  keywords: z.array(z.string()).default([]),
  variations: z.array(z.string()).optional(),
});
export type Bullet = z.infer<typeof bulletSchema>;

export const experienceSchema = z.object({
  id: z.string().default(uid),
  company: z.string(),
  title: z.string(),
  location: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  current: z.boolean().default(false),
  bullets: z.array(bulletSchema).default([]),
  source: z.string().optional().default("uploaded resume"),
});
export type Experience = z.infer<typeof experienceSchema>;

export const educationSchema = z.object({
  id: z.string().default(uid),
  institution: z.string(),
  degree: z.string().optional().default(""),
  field: z.string().optional().default(""),
  location: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  details: z.string().optional().default(""),
  source: z.string().optional().default("uploaded resume"),
});
export type Education = z.infer<typeof educationSchema>;

export const skillGroupSchema = z.object({
  id: z.string().default(uid),
  name: z.string().default("Skills"),
  skills: z.array(z.string()).default([]),
});
export type SkillGroup = z.infer<typeof skillGroupSchema>;

export const projectSchema = z.object({
  id: z.string().default(uid),
  name: z.string(),
  role: z.string().optional().default(""),
  description: z.string().optional().default(""),
  url: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  bullets: z.array(bulletSchema).default([]),
  source: z.string().optional().default("uploaded resume"),
  planned: z.boolean().default(false),
});
export type Project = z.infer<typeof projectSchema>;

export const certificationSchema = z.object({
  id: z.string().default(uid),
  name: z.string(),
  issuer: z.string().optional().default(""),
  issueDate: z.string().optional().default(""),
  credentialId: z.string().optional().default(""),
  url: z.string().optional().default(""),
  source: z.string().optional().default("uploaded resume"),
});
export type Certification = z.infer<typeof certificationSchema>;

export const awardSchema = z.object({
  id: z.string().default(uid),
  name: z.string(),
  issuer: z.string().optional().default(""),
  date: z.string().optional().default(""),
  description: z.string().optional().default(""),
  source: z.string().optional().default("uploaded resume"),
});
export type Award = z.infer<typeof awardSchema>;

export const customSectionSchema = z.object({
  id: z.string().default(uid),
  title: z.string(),
  content: z.string(),
});
export type CustomSection = z.infer<typeof customSectionSchema>;

export const resumeDataSchema = z.object({
  contact: contactSchema,
  summary: z.string().default(""),
  summarySource: sourceSchema.optional().default({ type: "user_text", ref: "uploaded resume" }),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  skills: z.array(skillGroupSchema).default([]),
  projects: z.array(projectSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
  awards: z.array(awardSchema).default([]),
  custom: z.array(customSectionSchema).default([]),
  sectionOrder: z.array(z.enum(sectionKeys)).default([
    "summary",
    "experience",
    "projects",
    "education",
    "skills",
    "certifications",
    "awards",
  ]),
});

export type ResumeData = z.infer<typeof resumeDataSchema>;

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */

export const fontChoices = [
  "Inter",
  "Source Sans 3",
  "Georgia",
  "Garamond",
  "Times New Roman",
  "Arial",
  "Calibri",
  "Helvetica",
  "Cambria",
  "Lato",
] as const;

export const designTokensSchema = z.object({
  templateId: z.string().default("ats-classic"),
  fontHeading: z.string().default("Inter"),
  fontBody: z.string().default("Inter"),
  baseSize: z.number().min(8).max(14).default(10.5),
  lineHeight: z.number().min(1).max(2).default(1.4),
  margin: z.number().min(24).max(96).default(48),
  sectionGap: z.number().min(8).max(32).default(16),
  accent: z.string().default("#111827"),
  textColor: z.string().default("#1f2937"),
  headingCase: z.enum(["upper", "title", "none"]).default("upper"),
  showRule: z.boolean().default(true),
  columns: z.union([z.literal(1), z.literal(2)]).default(1),
  atsRisk: z.enum(["none", "low", "medium", "high"]).default("none"),
  /** Captured from an uploaded file, used by "Keep my design". */
  detected: z
    .object({
      fonts: z.array(z.string()).default([]),
      sizes: z.array(z.number()).default([]),
      margins: z.number().optional(),
      sectionOrder: z.array(z.string()).default([]),
      colors: z.array(z.string()).default([]),
      columns: z.union([z.literal(1), z.literal(2)]).optional(),
      confidence: z.number().min(0).max(1).default(0),
    })
    .optional(),
});

export type DesignTokens = z.infer<typeof designTokensSchema>;

export const defaultDesign: DesignTokens = designTokensSchema.parse({});

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export type TemplateKind = "ats" | "designer" | "custom";

export interface TemplateDefinition {
  id: string;
  name: string;
  kind: TemplateKind;
  description: string;
  atsRisk: "none" | "low" | "medium" | "high";
  design: Partial<DesignTokens>;
  previewAccent?: string;
}

export const templates: TemplateDefinition[] = [
  {
    id: "ats-classic",
    name: "Classic",
    kind: "ats",
    description: "Single column, standard headings, generous white space.",
    atsRisk: "none",
    design: { fontHeading: "Inter", fontBody: "Inter", headingCase: "upper", showRule: true, accent: "#111827" },
  },
  {
    id: "ats-compact",
    name: "Compact",
    kind: "ats",
    description: "Fits more content on one page without crowding.",
    atsRisk: "none",
    design: { fontHeading: "Arial", fontBody: "Arial", baseSize: 10, lineHeight: 1.32, margin: 40, sectionGap: 12 },
  },
  {
    id: "ats-editorial",
    name: "Editorial",
    kind: "ats",
    description: "Serif headings with a quiet, confident hierarchy.",
    atsRisk: "none",
    design: { fontHeading: "Georgia", fontBody: "Inter", headingCase: "title", showRule: true, accent: "#1f3a34" },
  },
  {
    id: "ats-mono",
    name: "Technical",
    kind: "ats",
    description: "Engineer-friendly with tight, scannable skill rows.",
    atsRisk: "none",
    design: { fontHeading: "Arial", fontBody: "Calibri", baseSize: 10, lineHeight: 1.36, accent: "#0f172a" },
  },
  {
    id: "ats-navy",
    name: "Navy",
    kind: "ats",
    description: "A restrained navy accent that still parses cleanly.",
    atsRisk: "none",
    design: { fontHeading: "Source Sans 3", fontBody: "Source Sans 3", accent: "#1e3a5f", headingCase: "upper" },
  },
  {
    id: "ats-warm",
    name: "Warm",
    kind: "ats",
    description: "Friendly serif details for non-technical roles.",
    atsRisk: "none",
    design: { fontHeading: "Cambria", fontBody: "Lato", accent: "#4a3728", headingCase: "title" },
  },
  {
    id: "ats-slate",
    name: "Slate",
    kind: "ats",
    description: "Neutral, dense, and built for two-page careers.",
    atsRisk: "none",
    design: { fontHeading: "Inter", fontBody: "Inter", baseSize: 10, lineHeight: 1.35, margin: 42, accent: "#334155" },
  },
  {
    id: "ats-minimal",
    name: "Minimal",
    kind: "ats",
    description: "No rules, tight headings, maximum signal.",
    atsRisk: "none",
    design: { fontHeading: "Helvetica", fontBody: "Helvetica", showRule: false, headingCase: "upper", sectionGap: 13 },
  },
  {
    id: "designer-sidebar",
    name: "Sidebar",
    kind: "designer",
    description: "Two-column sidebar layout. Attractive, but some ATS parsers scramble it.",
    atsRisk: "high",
    design: { columns: 2, fontHeading: "Inter", fontBody: "Inter", accent: "#0f766e", showRule: false },
  },
  {
    id: "designer-bold",
    name: "Bold",
    kind: "designer",
    description: "Large display headings and an accent block.",
    atsRisk: "medium",
    design: { fontHeading: "Georgia", fontBody: "Inter", accent: "#7c2d12", headingCase: "title", baseSize: 10.5 },
  },
  {
    id: "designer-rule",
    name: "Rulebook",
    kind: "designer",
    description: "Editorial rules and colored labels for creative roles.",
    atsRisk: "low",
    design: { fontHeading: "Garamond", fontBody: "Source Sans 3", accent: "#6d28d9", headingCase: "upper", showRule: true },
  },
];

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

export type ScoreCategory =
  | "keywords"
  | "sections"
  | "format"
  | "contact"
  | "bullets"
  | "readability"
  | "spelling"
  | "timeline";

export interface ParseRisk {
  id: string;
  label: string;
  severity: Severity;
  detail: string;
  detectedIn: "pdf" | "docx" | "text" | "template";
  evidence?: string;
}

export interface ScoreDimension {
  key: ScoreCategory;
  label: string;
  score: number;
  max: number;
  summary: string;
  details: string[];
}

export type FixKind = "auto" | "review" | "ask" | "none";

export interface IssueFix {
  kind: FixKind;
  label: string;
  /** A structured patch the client can apply with one click. */
  patch?:
    | { op: "replace_text"; path: string; value: string }
    | { op: "add_section"; section: SectionKey }
    | { op: "set_heading"; value: string }
    | { op: "fill_placeholder"; path: string; prompt: string }
    | { op: "open_tool"; tool: string; payload?: Record<string, unknown> };
}

export interface AnalysisIssue {
  id: string;
  severity: Severity;
  category: ScoreCategory | "content";
  title: string;
  location: string;
  why: string;
  fix: IssueFix;
  resolved?: boolean;
}

export type KeywordType = "hard" | "soft";
export type MatchType = "exact" | "stemmed" | "semantic" | "missing";

export interface KeywordHit {
  keyword: string;
  type: KeywordType;
  importance: "must" | "nice";
  matchType: MatchType;
  occurrences: number;
  matchedAs?: string;
}

export interface KeywordAnalysis {
  matched: KeywordHit[];
  missing: KeywordHit[];
  mustHaveCoverage: number;
  niceToHaveCoverage: number;
  hardSkillCoverage: number;
  softSkillCoverage: number;
  total: number;
}

export interface AnalysisMeta {
  wordCount: number;
  bulletCount: number;
  estimatedPages: number;
  readingGrade: number;
  experienceYears: number;
  experienceLevel: "fresher" | "early" | "mid" | "senior" | "lead";
  hasJd: boolean;
  parseWarnings: string[];
}

export interface AnalysisResult {
  score: number;
  breakdown: ScoreDimension[];
  issues: AnalysisIssue[];
  keywords: KeywordAnalysis | null;
  meta: AnalysisMeta;
  generatedBy: "rules" | "llm";
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Job / JD extraction                                                 */
/* ------------------------------------------------------------------ */

export interface ExtractedJd {
  role: string;
  company: string;
  seniority: string;
  location?: string;
  employmentType?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  tools: string[];
  responsibilities: string[];
  keywords: { keyword: string; type: KeywordType; importance: "must" | "nice" }[];
  companyValues: string[];
  tone: string;
  mustHaveYears?: number | null;
  salaryRange?: { min?: number; max?: number; currency?: string } | null;
  summary: string;
}

/* ------------------------------------------------------------------ */
/* Tailoring                                                           */
/* ------------------------------------------------------------------ */

export type TailorChangeKind =
  | "summary"
  | "bullet_rewrite"
  | "bullet_reorder"
  | "section_reorder"
  | "skills_reorder"
  | "experience_reorder"
  | "keyword_insert";

export interface TailorChange {
  id: string;
  kind: TailorChangeKind;
  section: string;
  targetId?: string;
  targetPath?: string;
  before: string;
  after: string;
  rationale: string;
  source: string;
  risk: "low" | "medium" | "high";
  /** For reorder operations, ordered ids. */
  beforeOrder?: string[];
  afterOrder?: string[];
}

export interface TailorResult {
  job: ExtractedJd;
  changes: TailorChange[];
  tailored: ResumeData;
  scoreBefore: number;
  scoreAfter: number;
  coveredKeywords: string[];
  uncoveredKeywords: string[];
  warnings: string[];
  generatedBy: "rules" | "llm";
}

/* ------------------------------------------------------------------ */
/* Gaps                                                                */
/* ------------------------------------------------------------------ */

export type GapCategory = "skill" | "tool" | "domain" | "responsibility";

export interface GapOptions {
  mayAlreadyHave: { questions: string[]; note: string };
  reframe: { before: string; after: string; source: string }[];
  build: {
    title: string;
    scope: string;
    stack: string[];
    plan: string[];
    repoStructure: string[];
  };
  learn: { path: string[]; certifications: { name: string; provider: string; note: string }[] };
}

export interface GapItemView {
  id: string;
  skill: string;
  category: GapCategory;
  importance: "must" | "nice";
  status: "OPEN" | "PLANNED" | "DONE" | "DISMISSED";
  options: GapOptions;
  evidence?: string | null;
  questions: { id: string; question: string; answer?: string | null }[];
  plannedProject?: {
    id: string;
    title: string;
    scope: string;
    stack: string[];
    plan: string[];
    repoStructure: string[];
    status: "PLANNED" | "IN_PROGRESS" | "DONE";
    link?: string | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/* Fact check                                                          */
/* ------------------------------------------------------------------ */

export interface FactCheckFinding {
  id: string;
  fingerprint: string;
  severity: Severity;
  claim: string;
  location: string;
  reason: string;
  supportedBy?: string;
  suggestion: string;
  blocking: boolean;
  confirmed?: boolean;
  /** Placeholders and placed planned projects must be fixed, not confirmed away. */
  confirmable?: boolean;
}

export interface FactCheckResult {
  passed: boolean;
  blocking: number;
  warnings: number;
  findings: FactCheckFinding[];
  checkedAt: string;
  confirmedFindings?: string[];
}

/* ------------------------------------------------------------------ */
/* Misc generated content                                              */
/* ------------------------------------------------------------------ */

export interface CoverLetterResult {
  role: string;
  company: string;
  greeting: string;
  content: string;
  wordCount: number;
  factCheck: FactCheckResult;
  generatedBy: "rules" | "llm";
}

export interface InterviewQuestion {
  question: string;
  category: "behavioural" | "role" | "resume" | "company" | "gap";
  why: string;
  framework: string;
  talkingPoints: string[];
}

export interface InterviewPrepResult {
  questions: InterviewQuestion[];
  generatedBy: "rules" | "llm";
}

export interface LinkedInResult {
  headline: string;
  about: string;
  skills: string[];
  featuredSuggestions: string[];
  factCheck: FactCheckResult;
  generatedBy: "rules" | "llm";
}

export interface BulletRewriteResult {
  variations: { text: string; formula: string; source: string; needsMetric: boolean }[];
  followUpQuestions: string[];
  factCheck: FactCheckResult;
  generatedBy: "rules" | "llm";
}

/* ------------------------------------------------------------------ */
/* API envelopes                                                       */
/* ------------------------------------------------------------------ */

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export const sectionLabels: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  custom: "Additional",
};

export const standardHeadings = [
  "summary",
  "professional summary",
  "profile",
  "experience",
  "professional experience",
  "work experience",
  "employment",
  "education",
  "skills",
  "technical skills",
  "projects",
  "certifications",
  "licenses & certifications",
  "awards",
  "honors & awards",
  "publications",
];

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function estimatePages(data: ResumeData): number {
  const text = resumeToPlainText(data);
  const words = countWords(text);
  return Math.max(1, Math.round((words + data.experience.length * 18 + 90) / 520));
}

export function resumeToPlainText(data: ResumeData): string {
  const lines: string[] = [];
  const c = data.contact;
  if (c.fullName) lines.push(c.fullName);
  if (c.headline) lines.push(c.headline);
  const contactLine = [c.email, c.phone, c.location, c.linkedin, c.website, c.github].filter(Boolean).join(" | ");
  if (contactLine) lines.push(contactLine);
  if (data.summary) lines.push("", "SUMMARY", data.summary);
  if (data.experience.length) {
    lines.push("", "EXPERIENCE");
    for (const x of data.experience) {
      lines.push(`${x.title} | ${x.company}${x.location ? ` | ${x.location}` : ""} | ${x.startDate} - ${x.current ? "Present" : x.endDate}`);
      for (const b of x.bullets) lines.push(`- ${b.text}`);
    }
  }
  if (data.projects.length) {
    lines.push("", "PROJECTS");
    for (const p of data.projects) {
      lines.push(`${p.name}${p.role ? ` | ${p.role}` : ""}${p.url ? ` | ${p.url}` : ""}`);
      if (p.description) lines.push(p.description);
      for (const b of p.bullets) lines.push(`- ${b.text}`);
    }
  }
  if (data.education.length) {
    lines.push("", "EDUCATION");
    for (const e of data.education) {
      lines.push(`${e.degree}${e.field ? `, ${e.field}` : ""} | ${e.institution}${e.endDate ? ` | ${e.endDate}` : ""}`);
      if (e.details) lines.push(e.details);
    }
  }
  if (data.skills.length) {
    lines.push("", "SKILLS");
    for (const s of data.skills) lines.push(`${s.name}: ${s.skills.join(", ")}`);
  }
  if (data.certifications.length) {
    lines.push("", "CERTIFICATIONS");
    for (const cert of data.certifications) lines.push(`${cert.name}${cert.issuer ? ` | ${cert.issuer}` : ""}${cert.issueDate ? ` | ${cert.issueDate}` : ""}`);
  }
  if (data.awards.length) {
    lines.push("", "AWARDS");
    for (const a of data.awards) lines.push(`${a.name}${a.issuer ? ` | ${a.issuer}` : ""}${a.date ? ` | ${a.date}` : ""}`);
  }
  for (const cs of data.custom) {
    lines.push("", cs.title.toUpperCase(), cs.content);
  }
  return lines.join("\n");
}

export function emptyResume(fullName = "", email = ""): ResumeData {
  return resumeDataSchema.parse({
    contact: { fullName, email },
    sectionOrder: ["summary", "experience", "projects", "education", "skills", "certifications", "awards"],
  });
}
