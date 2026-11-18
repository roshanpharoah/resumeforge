import type { AnalysisResult, ExtractedJd, ResumeData } from "@/lib/types";
import { llmAnalyzeSchema } from "@/prompts/schemas";
import { QUALITY_BAR, TRUTH_RULES, WRITING_RULES, promptJd, promptResume, schemaBlock, toJsonSchema } from "@/prompts/shared";

export const analyzePrompt = {
  name: "resume-analyze",
  schemaName: "resume_analysis",
  schema: llmAnalyzeSchema,
  jsonSchema: toJsonSchema(llmAnalyzeSchema),
  temperature: 0.1,
  maxTokens: 3000,
  system: `You are a senior ATS reviewer and recruiting manager. You review a resume against a target job description.

The deterministic scoring engine has already calculated the numeric score and keyword coverage. Do not invent a new score. Add qualitative issues the rules engine cannot see, and keep every issue specific to a line in the resume.

RULES:
- Focus on recruiter decision quality, evidence, clarity and role fit.
- Do not repeat an issue that is already in the deterministic findings unless you have a materially different fix.
- Every issue needs: severity, exact location, why it matters to a recruiter or parser, and one concrete fix.
- Do not suggest adding a skill the user has not shown. Recommend the gap workflow instead.
- Do not mark a factual claim as safe. The fact checker handles that separately.
- Avoid generic advice such as "tailor your resume" or "use keywords". Name the line and the change.
- Use plain language, no em dashes.
${WRITING_RULES}
${TRUTH_RULES}
${QUALITY_BAR}

${schemaBlock(toJsonSchema(llmAnalyzeSchema))}`,
  buildUser: (input: { resume: ResumeData; jd?: ExtractedJd | null; analysis: AnalysisResult }) => `Review this resume.

RESUME JSON:
${promptResume(input.resume)}

TARGET JOB:
${input.jd ? promptJd(input.jd) : "No job description supplied. Review general ATS readiness only."}

DETERMINISTIC ANALYSIS (authoritative for scores):
${JSON.stringify(
  {
    score: input.analysis.score,
    breakdown: input.analysis.breakdown.map((b) => ({ key: b.key, score: b.score, max: b.max, summary: b.summary })),
    keywords: input.analysis.keywords
      ? {
          mustHaveCoverage: input.analysis.keywords.mustHaveCoverage,
          niceToHaveCoverage: input.analysis.keywords.niceToHaveCoverage,
          missing: input.analysis.keywords.missing.slice(0, 20),
        }
      : null,
    existingIssues: input.analysis.issues.slice(0, 30).map((i) => ({ severity: i.severity, title: i.title, location: i.location })),
    meta: input.analysis.meta,
  },
  null,
  2,
)}`,
};

export type AnalyzePrompt = typeof analyzePrompt;
