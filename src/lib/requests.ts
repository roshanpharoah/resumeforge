import { z } from "zod";
import { designTokensSchema, resumeDataSchema, severitySchema } from "@/lib/types";

export const gapCategories = ["skill", "tool", "domain", "responsibility"] as const;

export const requestCodeSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const verifyCodeSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6 digit code."),
});

export const createResumeSchema = z.object({
  title: z.string().trim().min(1, "Give this resume a name.").max(120),
  rawText: z.string().max(400_000).optional(),
  data: resumeDataSchema.optional(),
  design: designTokensSchema.optional(),
  templateId: z.string().max(60).optional(),
  designSource: z.enum(["upload", "template"]).optional(),
  parseRisks: z.array(z.any()).max(50).optional(),
  originalFileKey: z.string().max(300).optional(),
  originalFileName: z.string().max(300).optional(),
  originalFileType: z.string().max(20).optional(),
});

export const updateResumeSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  data: resumeDataSchema.optional(),
  design: designTokensSchema.optional(),
  templateId: z.string().max(60).optional(),
  designSource: z.enum(["upload", "template"]).optional(),
  isPrimary: z.boolean().optional(),
});

export const analyzeSchema = z.object({
  jobId: z.string().min(1).optional(),
  jdText: z.string().max(60_000).optional(),
  company: z.string().max(160).optional(),
  title: z.string().max(160).optional(),
  versionId: z.string().min(1).optional(),
  includeLlm: z.boolean().default(true),
});

export const tailorSchema = z.object({
  jobId: z.string().min(1).optional(),
  jdText: z.string().max(60_000).optional(),
  company: z.string().max(160).optional(),
  title: z.string().max(160).optional(),
  useLlm: z.boolean().default(true),
  answers: z.array(z.string().max(1_000)).max(20).optional(),
});

export const tailorChangeSchema = z.object({
  id: z.string(),
  kind: z.enum(["summary", "bullet_rewrite", "bullet_reorder", "section_reorder", "skills_reorder", "experience_reorder", "keyword_insert"]),
  section: z.string(),
  targetId: z.string().optional(),
  targetPath: z.string().optional(),
  before: z.string(),
  after: z.string(),
  rationale: z.string(),
  source: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  beforeOrder: z.array(z.string()).optional(),
  afterOrder: z.array(z.string()).optional(),
});

export const commitTailorSchema = z.object({
  jobId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(120),
  acceptedChangeIds: z.array(z.string()).max(100),
  changes: z.array(tailorChangeSchema).max(200),
  confirmations: z.array(z.string()).max(60).optional(),
});

export const createVersionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  data: resumeDataSchema,
  design: designTokensSchema.optional(),
  jobId: z.string().min(1).optional(),
  source: z.enum(["BASE", "TAILORED"]).default("BASE"),
  matchScore: z.number().min(0).max(100).optional(),
  confirmations: z.array(z.string()).max(60).optional(),
});

export const factCheckSchema = z.object({
  data: resumeDataSchema.optional(),
  versionId: z.string().min(1).optional(),
  answers: z.array(z.string().max(2_000)).max(30).optional(),
  confirmations: z.array(z.string()).max(60).optional(),
});

export const exportSchema = z.object({
  format: z.enum(["pdf", "docx", "txt"]),
  data: resumeDataSchema.optional(),
  design: designTokensSchema.optional(),
  versionId: z.string().min(1).optional(),
  confirmations: z.array(z.string()).max(60).optional(),
});

export const shareSchema = z.object({
  versionId: z.string().min(1).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
  confirmations: z.array(z.string()).max(60).optional(),
});

const jobStatus = z.enum(["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"]);

export const createJobSchema = z.object({
  company: z.string().trim().min(1, "Add the company name.").max(180),
  title: z.string().trim().min(1, "Add the role title.").max(180),
  jdText: z.string().trim().min(1, "Paste the job description.").max(80_000),
  url: z.string().url("Enter a valid URL.").max(2_000).optional().or(z.literal("")),
  location: z.string().max(180).optional(),
  status: jobStatus.optional(),
  notes: z.string().max(20_000).optional(),
});

export const updateJobSchema = z.object({
  company: z.string().trim().min(1).max(180).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  jdText: z.string().trim().min(1).max(80_000).optional(),
  url: z.string().url().max(2_000).optional().nullable(),
  location: z.string().max(180).optional().nullable(),
  status: jobStatus.optional(),
  notes: z.string().max(20_000).optional().nullable(),
  salaryMin: z.number().int().min(0).max(10_000_000).optional().nullable(),
  salaryMax: z.number().int().min(0).max(10_000_000).optional().nullable(),
  currency: z.string().max(8).optional(),
  resumeId: z.string().min(1).optional(),
});

export const extractJobSchema = z.object({
  jdText: z.string().trim().min(20, "Paste a longer job description.").max(80_000),
  title: z.string().max(180).optional(),
  company: z.string().max(180).optional(),
  url: z.string().url().max(2_000).optional(),
});

export const generateGapsSchema = z.object({
  resumeId: z.string().min(1),
  useLlm: z.boolean().default(true),
});

export const answerGapSchema = z.object({
  questionId: z.string().min(1).optional(),
  answer: z.string().trim().min(3, "Add a little more detail.").max(4_000),
  addToResume: z.boolean().default(true),
  experienceId: z.string().optional(),
});

export const acceptReframeSchema = z.object({
  index: z.number().int().min(0).max(10),
  experienceId: z.string().optional(),
});

export const updateGapSchema = z.object({
  status: z.enum(["OPEN", "PLANNED", "DONE", "DISMISSED"]).optional(),
  evidence: z.string().max(4_000).optional().nullable(),
});

export const plannedProjectSchema = z.object({
  gapId: z.string().min(1),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]).default("PLANNED"),
  link: z.string().url("Add a public project link.").max(2_000).optional().or(z.literal("")),
  addToResume: z.boolean().default(false),
});

export const bulletRewriteSchema = z.object({
  resumeId: z.string().min(1),
  versionId: z.string().min(1).optional(),
  bulletId: z.string().optional(),
  bulletText: z.string().trim().min(10, "Add a little more detail first.").max(2_000),
  role: z.string().max(180).default(""),
  company: z.string().max(180).default(""),
  current: z.boolean().default(false),
  userAnswer: z.string().max(2_000).optional(),
  askMetric: z.boolean().default(false),
  jobId: z.string().min(1).optional(),
});

export const summaryGenerateSchema = z.object({
  resumeId: z.string().min(1),
  jobId: z.string().min(1).optional(),
  jdText: z.string().max(60_000).optional(),
  versionId: z.string().min(1).optional(),
});

export const coverLetterSchema = z.object({
  jobId: z.string().min(1).optional(),
  resumeVersionId: z.string().min(1).optional(),
  resumeId: z.string().min(1).optional(),
  hiringManager: z.string().max(160).optional(),
  tone: z.enum(["professional", "warm", "direct", "curious"]).default("professional"),
  useLlm: z.boolean().default(true),
});

export const interviewPrepSchema = z.object({
  jobId: z.string().min(1).optional(),
  resumeVersionId: z.string().min(1).optional(),
  resumeId: z.string().min(1).optional(),
  useLlm: z.boolean().default(true),
});

export const linkedinSchema = z.object({
  resumeId: z.string().min(1),
  jobId: z.string().min(1),
  versionId: z.string().min(1).optional(),
  useLlm: z.boolean().default(true),
});

export const proofreadSchema = z.object({
  text: z.string().trim().min(1).max(40_000),
  resumeId: z.string().min(1).optional(),
});

export const leaderboardSchema = z.object({
  resumeId: z.string().min(1),
  jobs: z
    .array(
      z.object({
        jobId: z.string().optional(),
        company: z.string().max(180).default(""),
        title: z.string().max(180).default(""),
        jdText: z.string().min(20).max(80_000),
      }),
    )
    .max(12)
    .optional(),
});

export const jdUrlSchema = z.object({
  url: z.string().url("Paste a valid job posting URL.").max(2_000),
});

export const fixApplySchema = z.object({
  path: z.string().trim().min(1).max(300),
  value: z.string().max(10_000),
});

export const gapCategoriesSchema = z.enum(gapCategories);
export const severityEnum = severitySchema;
