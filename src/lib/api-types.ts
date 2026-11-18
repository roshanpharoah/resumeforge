import type {
  AnalysisResult,
  AnalysisIssue,
  DesignTokens,
  ExtractedJd,
  FactCheckResult,
  GapOptions,
  ParseRisk,
  ResumeData,
  TailorChange,
} from "@/lib/types";
import type { AnalysisRecordDto, GapDto, JobDetailDto, ResumeDetailDto, VersionDto } from "@/lib/serializers";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export interface RequestCodeRequest {
  email: string;
}
export interface RequestCodeResponse {
  ok: true;
  expiresInMinutes: number;
  devCode?: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}
export interface VerifyCodeResponse {
  ok: true;
  user: { id: string; email: string; name: string | null; image: string | null };
}

/* ------------------------------------------------------------------ */
/* Upload and parsing                                                  */
/* ------------------------------------------------------------------ */

export interface ParseUploadResponse {
  rawText: string;
  data: ResumeData;
  design: DesignTokens;
  parseRisks: ParseRisk[];
  designSource: "upload" | "template";
  fileName: string;
  fileType: "pdf" | "docx" | "txt";
  pageCount: number;
  warnings: string[];
  llmUsed: boolean;
  detection: {
    fonts: string[];
    hasImages: boolean;
    hasTables: boolean;
    hasColumns: boolean;
    hasTextboxes: boolean;
    hasHeaderFooter: boolean;
  };
}

export interface CreateResumeRequest {
  title: string;
  rawText?: string;
  data?: ResumeData;
  design?: DesignTokens;
  templateId?: string;
  designSource?: "upload" | "template";
  parseRisks?: ParseRisk[];
  originalFileKey?: string;
  originalFileName?: string;
  originalFileType?: string;
  originalFileBase64?: string;
}

export interface CreateResumeResponse {
  resume: ResumeDetailDto;
}

export interface UpdateResumeRequest {
  title?: string;
  data?: ResumeData;
  design?: DesignTokens;
  templateId?: string;
  designSource?: "upload" | "template";
  isPrimary?: boolean;
}

export interface UpdateResumeResponse {
  resume: ResumeDetailDto;
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

export interface AnalyzeRequest {
  jobId?: string;
  jdText?: string;
  company?: string;
  title?: string;
  versionId?: string;
  includeLlm?: boolean;
}

export interface AnalyzeResponse {
  report: AnalysisRecordDto;
  analysis: AnalysisResult;
  gaps: GapDto[];
  llmUsed: boolean;
}

export interface FixApplyRequest {
  path: string;
  value: string;
}

export interface FixApplyResponse {
  data: ResumeData;
  rerun?: AnalysisResult;
}

/* ------------------------------------------------------------------ */
/* Tailoring                                                           */
/* ------------------------------------------------------------------ */

export interface TailorRequest {
  jobId?: string;
  jdText?: string;
  company?: string;
  title?: string;
  useLlm?: boolean;
}

export interface TailorResponse {
  result: {
    job: ExtractedJd;
    changes: TailorChange[];
    tailored: ResumeData;
    scoreBefore: number;
    scoreAfter: number;
    coveredKeywords: string[];
    uncoveredKeywords: string[];
    warnings: string[];
    generatedBy: "rules" | "llm";
  };
  base: ResumeData;
  design: DesignTokens;
}

export interface CommitTailorRequest {
  jobId?: string;
  label: string;
  acceptedChangeIds: string[];
  changes: TailorChange[];
  confirmations?: string[];
}

export interface CommitTailorResponse {
  version: VersionDto;
  factCheck: FactCheckResult;
  score: number;
}

/* ------------------------------------------------------------------ */
/* Versions                                                            */
/* ------------------------------------------------------------------ */

export interface CreateVersionRequest {
  label: string;
  data: ResumeData;
  design?: DesignTokens;
  jobId?: string;
  source?: "BASE" | "TAILORED";
  matchScore?: number;
  confirmations?: string[];
}

export interface CreateVersionResponse {
  version: VersionDto;
  factCheck: FactCheckResult;
}

/* ------------------------------------------------------------------ */
/* Fact check and export                                               */
/* ------------------------------------------------------------------ */

export interface FactCheckRequest {
  data?: ResumeData;
  versionId?: string;
  answers?: string[];
  confirmations?: string[];
}

export interface FactCheckResponse {
  factCheck: FactCheckResult;
}

export interface ExportRequest {
  format: "pdf" | "docx" | "txt";
  data?: ResumeData;
  design?: DesignTokens;
  versionId?: string;
  confirmations?: string[];
}

/* ------------------------------------------------------------------ */
/* Jobs and applications                                               */
/* ------------------------------------------------------------------ */

export interface CreateJobRequest {
  company: string;
  title: string;
  jdText: string;
  url?: string;
  location?: string;
  status?: "SAVED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED";
  notes?: string;
}

export interface CreateJobResponse {
  job: JobDetailDto;
}

export interface UpdateJobRequest {
  company?: string;
  title?: string;
  jdText?: string;
  url?: string;
  location?: string;
  status?: "SAVED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED";
  notes?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
}

export interface UpdateJobResponse {
  job: JobDetailDto;
}

export interface JobExtractResponse {
  extracted: ExtractedJd;
  llmUsed: boolean;
}

/* ------------------------------------------------------------------ */
/* Gaps                                                                */
/* ------------------------------------------------------------------ */

export interface GenerateGapsRequest {
  jobId: string;
  useLlm?: boolean;
}

export interface GenerateGapsResponse {
  gaps: GapDto[];
  warnings: string[];
  llmUsed: boolean;
}

export interface AnswerGapRequest {
  questionId?: string;
  answer: string;
  addToResume?: boolean;
  experienceId?: string;
}

export interface AnswerGapResponse {
  gap: GapDto;
  data: ResumeData;
  addedBulletId?: string;
  factCheck: FactCheckResult;
}

export interface AcceptReframeRequest {
  index: number;
  experienceId?: string;
}

export interface AcceptReframeResponse {
  gap: GapDto;
  data: ResumeData;
  addedBulletId?: string;
}

export interface UpdateGapRequest {
  status?: "OPEN" | "PLANNED" | "DONE" | "DISMISSED";
  evidence?: string;
}

export interface PlannedProjectRequest {
  gapId: string;
  status?: "PLANNED" | "IN_PROGRESS" | "DONE";
  link?: string;
  addToResume?: boolean;
}

export interface PlannedProjectResponse {
  gap: GapDto;
  data?: ResumeData;
}

/* ------------------------------------------------------------------ */
/* AI content                                                          */
/* ------------------------------------------------------------------ */

export interface BulletRewriteRequest {
  resumeId: string;
  versionId?: string;
  bulletId?: string;
  bulletText: string;
  role: string;
  company: string;
  current: boolean;
  userAnswer?: string;
  askMetric?: boolean;
  jobId?: string;
}

export interface SummaryGenerateRequest {
  resumeId: string;
  jobId?: string;
  jdText?: string;
}

export interface CoverLetterRequest {
  jobId: string;
  resumeVersionId?: string;
  hiringManager?: string;
  tone?: string;
  useLlm?: boolean;
}

export interface CoverLetterResponse {
  coverLetter: {
    id?: string;
    role: string;
    company: string;
    greeting: string;
    content: string;
    wordCount: number;
    factCheck: FactCheckResult;
    generatedBy: "rules" | "llm";
  };
}

export interface InterviewPrepRequest {
  jobId: string;
  resumeVersionId?: string;
  useLlm?: boolean;
}

export interface InterviewPrepResponse {
  interview: {
    questions: {
      question: string;
      category: "behavioural" | "role" | "resume" | "company" | "gap";
      why: string;
      framework: string;
      talkingPoints: string[];
    }[];
    generatedBy: "rules" | "llm";
  };
}

export interface LinkedInRequest {
  resumeId: string;
  jobId: string;
  useLlm?: boolean;
}

export interface LinkedInResponse {
  linkedin: {
    headline: string;
    about: string;
    skills: string[];
    featuredSuggestions: string[];
    factCheck: FactCheckResult;
    generatedBy: "rules" | "llm";
  };
}

/* ------------------------------------------------------------------ */
/* Sharing                                                             */
/* ------------------------------------------------------------------ */

export interface CreateShareRequest {
  versionId?: string;
  expiresInDays?: number;
}

export interface CreateShareResponse {
  token: string;
  url: string;
  qrDataUrl: string;
  expiresAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export interface LeaderboardRequest {
  resumeId: string;
  jobs: { jobId?: string; company: string; title: string; jdText: string }[];
}

export interface LeaderboardResponse {
  results: {
    company: string;
    title: string;
    score: number;
    mustHaveCoverage: number;
    missingTop: string[];
    jobId?: string;
  }[];
}

export interface ErrorResponse {
  error: string;
  details?: unknown;
  code?: string;
}

export interface FixResult {
  issues: AnalysisIssue[];
  fixed: boolean;
}

export type { GapOptions };
