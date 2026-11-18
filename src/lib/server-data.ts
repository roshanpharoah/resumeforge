import { Prisma, type AnalysisReport, type Job, type Resume } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type {
  AnalysisResult,
  DesignTokens,
  ExtractedJd,
  GapCategory,
  GapOptions,
  ResumeData,
  TailorChange,
} from "@/lib/types";
import { designTokensSchema, resumeDataSchema } from "@/lib/types";
import { toDesign, toResumeData } from "@/lib/serializers";
import type {
  AnalysisRecordDto,
  ApplicationDto,
  GapDto,
  JobDetailDto,
  JobSummaryDto,
  ResumeDetailDto,
  ResumeSummaryDto,
  VersionDto,
} from "@/lib/serializers";
import { extractJd } from "@/lib/keywords";
import type { GapSeed } from "@/lib/gaps";

/* ------------------------------------------------------------------ */
/* Includes                                                            */
/* ------------------------------------------------------------------ */

export const resumeSummaryInclude = {
  _count: { select: { versions: true, gapItems: true } },
  analyses: { orderBy: { createdAt: "desc" as const }, take: 1, select: { score: true } },
} satisfies Prisma.ResumeInclude;

const resumeDetailInclude = {
  ...resumeSummaryInclude,
} satisfies Prisma.ResumeInclude;

export const versionInclude = {
  job: { select: { title: true, company: true } },
} satisfies Prisma.ResumeVersionInclude;

export const gapInclude = {
  questions: { orderBy: { createdAt: "asc" as const } },
  plannedProject: true,
} satisfies Prisma.GapItemInclude;

const jobDetailInclude = {
  versions: { orderBy: { createdAt: "desc" as const }, take: 24, include: versionInclude },
  gapItems: { include: gapInclude, orderBy: [{ importance: "asc" as const }, { createdAt: "desc" as const }] },
  coverLetters: { orderBy: { createdAt: "desc" as const }, take: 6, select: { id: true, content: true, createdAt: true, tone: true } },
  interviewPrep: true,
} satisfies Prisma.JobInclude;

type ResumeSummaryRow = Prisma.ResumeGetPayload<{ include: typeof resumeSummaryInclude }>;
type ResumeDetailRow = Prisma.ResumeGetPayload<{ include: typeof resumeDetailInclude }>;
type VersionRow = Prisma.ResumeVersionGetPayload<{ include: typeof versionInclude }>;
type GapRow = Prisma.GapItemGetPayload<{ include: typeof gapInclude }>;
type JobDetailRow = Prisma.JobGetPayload<{ include: typeof jobDetailInclude }>;

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

export function serializeResumeSummary(row: ResumeSummaryRow): ResumeSummaryDto {
  return {
    id: row.id,
    title: row.title,
    isPrimary: row.isPrimary,
    templateId: row.templateId,
    designSource: row.designSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    latestScore: row.analyses[0]?.score ?? null,
    versionCount: row._count.versions,
    gapCount: row._count.gapItems,
  };
}

export function serializeResumeDetail(row: ResumeDetailRow): ResumeDetailDto {
  const summary = serializeResumeSummary(row);
  return {
    ...summary,
    rawText: row.rawText,
    data: toResumeData(row.parsed),
    design: toDesign(row.design),
    parseRisks: Array.isArray(row.parseRisks) ? row.parseRisks : [],
    originalFileName: row.originalFileName,
    originalFileType: row.originalFileType,
    hasOriginalFile: Boolean(row.originalFileKey),
  };
}

export function serializeVersion(row: VersionRow): VersionDto {
  return {
    id: row.id,
    label: row.label,
    source: row.source,
    matchScore: row.matchScore,
    createdAt: row.createdAt.toISOString(),
    jobId: row.jobId,
    jobTitle: row.job?.title ?? null,
    company: row.job?.company ?? null,
    data: toResumeData(row.data),
    design: toDesign(row.design),
    factCheck: row.factCheck,
  };
}

export function serializeGap(row: GapRow): GapDto {
  return {
    id: row.id,
    skill: row.skill,
    category: row.category,
    importance: row.importance,
    status: row.status,
    options: row.options,
    evidence: row.evidence,
    questions: row.questions.map((q) => ({ id: q.id, question: q.question, answer: q.answer })),
    plannedProject: row.plannedProject
      ? {
          id: row.plannedProject.id,
          title: row.plannedProject.title,
          scope: row.plannedProject.scope,
          stack: Array.isArray(row.plannedProject.stack) ? (row.plannedProject.stack as string[]) : [],
          plan: Array.isArray(row.plannedProject.plan) ? (row.plannedProject.plan as string[]) : [],
          repoStructure: Array.isArray(row.plannedProject.repoStructure) ? (row.plannedProject.repoStructure as string[]) : [],
          status: row.plannedProject.status,
          link: row.plannedProject.link,
          completedAt: row.plannedProject.completedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export function serializeJobSummary(row: Job): JobSummaryDto {
  const extracted = (row.extracted as ExtractedJd | null) ?? null;
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    status: row.status,
    matchScore: row.matchScore,
    location: row.location,
    url: row.url,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    currency: row.currency,
    salaryRange: extracted?.salaryRange ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeJobDetail(row: JobDetailRow): JobDetailDto {
  return {
    ...serializeJobSummary(row),
    jdText: row.jdText,
    extracted: (row.extracted as ExtractedJd | null) ?? null,
    notes: row.notes,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    currency: row.currency,
    versions: row.versions.map(serializeVersion),
    gaps: row.gapItems.map(serializeGap),
    coverLetters: row.coverLetters.map((c) => ({ id: c.id, content: c.content, createdAt: c.createdAt.toISOString(), tone: c.tone })),
    interviewPrep: row.interviewPrep ? { questions: row.interviewPrep.questions, updatedAt: row.interviewPrep.updatedAt.toISOString() } : null,
  };
}

export function analysisFromRecord(row: AnalysisReport): AnalysisResult {
  return {
    score: row.score,
    breakdown: (row.breakdown as unknown as AnalysisResult["breakdown"]) ?? [],
    issues: (row.issues as unknown as AnalysisResult["issues"]) ?? [],
    keywords: (row.keywords as unknown as AnalysisResult["keywords"]) ?? null,
    meta: (row.meta as unknown as AnalysisResult["meta"]) ?? {
      wordCount: 0,
      bulletCount: 0,
      estimatedPages: 1,
      readingGrade: 0,
      experienceYears: 0,
      experienceLevel: "fresher",
      hasJd: false,
      parseWarnings: [],
    },
    generatedBy: "rules",
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeAnalysis(row: AnalysisReport): AnalysisRecordDto {
  const analysis = analysisFromRecord(row);
  return {
    id: row.id,
    score: row.score,
    breakdown: analysis.breakdown,
    issues: analysis.issues,
    keywords: analysis.keywords,
    meta: analysis.meta,
    createdAt: analysis.createdAt,
    jobId: row.jobId,
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export async function listResumes(userId: string): Promise<ResumeSummaryDto[]> {
  const rows = await db().resume.findMany({
    where: { userId },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    include: resumeSummaryInclude,
  });
  return rows.map(serializeResumeSummary);
}

export async function getOwnedResume(userId: string, resumeId: string): Promise<ResumeDetailRow> {
  const resume = await db().resume.findFirst({ where: { id: resumeId, userId }, include: resumeDetailInclude });
  if (!resume) throw new HttpError(404, "Resume not found.");
  return resume;
}

export async function getOwnedJob(userId: string, jobId: string): Promise<JobDetailRow> {
  const job = await db().job.findFirst({ where: { id: jobId, userId }, include: jobDetailInclude });
  if (!job) throw new HttpError(404, "Job not found.");
  return job;
}

export async function getOwnedGap(userId: string, gapId: string) {
  const gap = await db().gapItem.findFirst({ where: { id: gapId, userId }, include: gapInclude });
  if (!gap) throw new HttpError(404, "Gap not found.");
  return gap;
}

export async function getGapsForJob(userId: string, resumeId: string, jobId: string): Promise<GapDto[]> {
  const rows = await db().gapItem.findMany({
    where: { userId, resumeId, jobId },
    orderBy: [{ importance: "asc" }, { createdAt: "desc" }],
    include: gapInclude,
  });
  return rows.map(serializeGap);
}

export async function resolveJd(args: {
  userId: string;
  jobId?: string;
  jdText?: string;
  title?: string;
  company?: string;
}): Promise<{ jd: ExtractedJd | null; rawJd: string; job: Job | null }> {
  if (args.jobId) {
    const job = await getOwnedJob(args.userId, args.jobId);
    const jd = (job.extracted as ExtractedJd | null) ?? extractJd(job.jdText, job.title, job.company);
    return { jd, rawJd: job.jdText, job };
  }
  const raw = args.jdText?.trim();
  if (raw) {
    return { jd: extractJd(raw, args.title ?? "", args.company ?? ""), rawJd: raw, job: null };
  }
  return { jd: null, rawJd: "", job: null };
}

export async function resolveResumeContent(
  resume: Resume,
  versionId?: string,
): Promise<{ data: ResumeData; design: DesignTokens; version: VersionRow | null }> {
  if (versionId) {
    const version = await db().resumeVersion.findFirst({
      where: { id: versionId, resumeId: resume.id },
      include: versionInclude,
    });
    if (!version) throw new HttpError(404, "Resume version not found.");
    return { data: toResumeData(version.data), design: toDesign(version.design), version };
  }
  return { data: toResumeData(resume.parsed), design: toDesign(resume.design), version: null };
}

export async function latestAnalysis(userId: string, resumeId: string): Promise<AnalysisResult | null> {
  await getOwnedResume(userId, resumeId);
  const row = await db().analysisReport.findFirst({ where: { resumeId }, orderBy: { createdAt: "desc" } });
  return row ? analysisFromRecord(row) : null;
}

/* ------------------------------------------------------------------ */
/* Gaps                                                                */
/* ------------------------------------------------------------------ */

export async function persistGapSeeds(args: {
  userId: string;
  resumeId: string;
  jobId: string;
  seeds: GapSeed[];
}): Promise<GapDto[]> {
  const prisma = db();
  for (const seed of args.seeds) {
    const existing = await prisma.gapItem.findFirst({
      where: { resumeId: args.resumeId, jobId: args.jobId, skill: seed.skill },
    });
    const questionTexts = seed.options.mayAlreadyHave.questions.slice(0, 5);
    if (existing) {
      const existingQuestions = await prisma.gapQuestion.findMany({ where: { gapItemId: existing.id }, select: { question: true } });
      const known = new Set(existingQuestions.map((q) => q.question));
      const fresh = questionTexts.filter((q) => !known.has(q));
      await prisma.gapItem.update({
        where: { id: existing.id },
        data: {
          options: seed.options as unknown as Prisma.InputJsonValue,
          importance: seed.importance,
          category: seed.category,
          ...(fresh.length ? { questions: { create: fresh.map((question) => ({ question })) } } : {}),
        },
      });
    } else {
      await prisma.gapItem.create({
        data: {
          userId: args.userId,
          resumeId: args.resumeId,
          jobId: args.jobId,
          skill: seed.skill,
          category: seed.category,
          importance: seed.importance,
          options: seed.options as unknown as Prisma.InputJsonValue,
          questions: { create: questionTexts.map((question) => ({ question })) },
        },
      });
    }
  }
  return getGapsForJob(args.userId, args.resumeId, args.jobId);
}

/* ------------------------------------------------------------------ */
/* Resume writes                                                       */
/* ------------------------------------------------------------------ */

export async function saveResumeData(resumeId: string, data: ResumeData, design?: DesignTokens) {
  const parsed = resumeDataSchema.parse(data);
  const payload: Prisma.ResumeUpdateInput = { parsed: parsed as unknown as Prisma.InputJsonValue };
  if (design) payload.design = design as unknown as Prisma.InputJsonValue;
  return db().resume.update({ where: { id: resumeId }, data: payload });
}

export async function createVersion(args: {
  resumeId: string;
  jobId?: string | null;
  label: string;
  data: ResumeData;
  design: DesignTokens;
  source: "UPLOAD" | "BASE" | "TAILORED";
  matchScore?: number | null;
  factCheck?: unknown;
}): Promise<VersionRow> {
  const version = await db().resumeVersion.create({
    data: {
      resumeId: args.resumeId,
      jobId: args.jobId ?? null,
      label: args.label,
      data: args.data as unknown as Prisma.InputJsonValue,
      design: args.design as unknown as Prisma.InputJsonValue,
      source: args.source,
      matchScore: args.matchScore ?? null,
      factCheck: (args.factCheck ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
    include: versionInclude,
  });
  return version;
}

export async function setPrimaryResume(userId: string, resumeId: string) {
  await db().$transaction([
    db().resume.updateMany({ where: { userId }, data: { isPrimary: false } }),
    db().resume.updateMany({ where: { userId, id: resumeId }, data: { isPrimary: true } }),
  ]);
}

export function applicationFromRow(row: {
  id: string;
  company: string;
  title: string;
  status: string;
  updatedAt: Date;
  matchScore: number | null;
  versions?: { id: string; label: string }[];
}): ApplicationDto {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    status: row.status as ApplicationDto["status"],
    updatedAt: row.updatedAt.toISOString(),
    matchScore: row.matchScore,
    resumeVersionId: row.versions?.[0]?.id ?? null,
    resumeLabel: row.versions?.[0]?.label ?? null,
  };
}

export type { GapRow, JobDetailRow, ResumeDetailRow, ResumeSummaryRow, VersionRow };
