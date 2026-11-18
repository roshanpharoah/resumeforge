import type { AnalysisResult, DesignTokens, ExtractedJd, ResumeData } from "@/lib/types";
import { designTokensSchema, resumeDataSchema } from "@/lib/types";

export interface ResumeSummaryDto {
  id: string;
  title: string;
  isPrimary: boolean;
  templateId: string;
  designSource: string;
  createdAt: string;
  updatedAt: string;
  latestScore: number | null;
  versionCount: number;
  gapCount: number;
}

export interface ResumeDetailDto extends ResumeSummaryDto {
  rawText: string;
  data: ResumeData;
  design: DesignTokens;
  parseRisks: unknown[];
  originalFileName: string | null;
  originalFileType: string | null;
  hasOriginalFile: boolean;
}

export interface JobSummaryDto {
  id: string;
  company: string;
  title: string;
  status: string;
  matchScore: number | null;
  location: string | null;
  url: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  salaryRange: { min?: number; max?: number; currency?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobDetailDto extends JobSummaryDto {
  jdText: string;
  extracted: ExtractedJd | null;
  notes: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  versions: VersionDto[];
  gaps: GapDto[];
  coverLetters: { id: string; content: string; createdAt: string; tone: string }[];
  interviewPrep: unknown | null;
}

export interface VersionDto {
  id: string;
  label: string;
  source: string;
  matchScore: number | null;
  createdAt: string;
  jobId: string | null;
  jobTitle?: string | null;
  company?: string | null;
  data: ResumeData;
  design: DesignTokens;
  factCheck: unknown | null;
}

export interface GapQuestionDto {
  id: string;
  question: string;
  answer: string | null;
}

export interface GapDto {
  id: string;
  skill: string;
  category: string;
  importance: string;
  status: string;
  options: unknown;
  evidence: string | null;
  questions: GapQuestionDto[];
  plannedProject: {
    id: string;
    title: string;
    scope: string;
    stack: string[];
    plan: string[];
    repoStructure: string[];
    status: string;
    link: string | null;
    completedAt: string | null;
  } | null;
}

export interface ApplicationDto {
  id: string;
  company: string;
  title: string;
  status: "SAVED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED";
  updatedAt: string;
  matchScore: number | null;
  resumeVersionId: string | null;
  resumeLabel: string | null;
}

export interface DashboardDto {
  resumes: ResumeSummaryDto[];
  activeResume: ResumeDetailDto | null;
  jobs: ApplicationDto[];
  latestAnalysis: AnalysisResult | null;
  topFixes: AnalysisResult["issues"];
  gapCount: number;
  plannedProjects: number;
  scoreHistory: { date: string; score: number }[];
}

export interface AnalysisRecordDto {
  id: string;
  score: number;
  breakdown: AnalysisResult["breakdown"];
  issues: AnalysisResult["issues"];
  keywords: AnalysisResult["keywords"];
  meta: AnalysisResult["meta"];
  createdAt: string;
  jobId: string | null;
}

export function toResumeData(value: unknown): ResumeData {
  return resumeDataSchema.parse(value);
}

export function toDesign(value: unknown): DesignTokens {
  return designTokensSchema.parse(value);
}
