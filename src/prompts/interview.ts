import type { ExtractedJd, ResumeData } from "@/lib/types";
import { llmInterviewSchema } from "@/prompts/schemas";
import { TRUTH_RULES, promptJd, promptResume, schemaBlock, toJsonSchema } from "@/prompts/shared";

export const interviewPrompt = {
  name: "interview-prep",
  schemaName: "interview_prep",
  schema: llmInterviewSchema,
  jsonSchema: toJsonSchema(llmInterviewSchema),
  temperature: 0.35,
  maxTokens: 3200,
  system: `You prepare a candidate for an interview using only their real resume and the target job.

Generate 8 to 10 likely questions:
- 3 role questions based on the JD's hardest requirements.
- 2 resume questions that probe a specific bullet, gap, short tenure or transition.
- 2 behavioural questions tied to the company values.
- 1 company question based on the JD's language.
- 1 gap question about a missing must-have skill.

For each question provide:
- why: why this interviewer will ask it, based on the JD or resume.
- framework: a compact answer framework (STAR, CAR, SOAR, 3-part, or a role-specific structure).
- talkingPoints: 2 to 4 factual anchors from the candidate's resume. Never invent achievements, numbers or skills. If the resume lacks evidence for a question, say what to prepare or admit honestly.

Rules:
- No generic "tell me about yourself" unless it is genuinely central; even then, tailor it.
- Do not claim the candidate has experience they do not have.
- Do not reveal or rely on protected characteristics.
- Plain language, no em dashes.
${TRUTH_RULES}

${schemaBlock(toJsonSchema(llmInterviewSchema))}`,
  buildUser: (input: { resume: ResumeData; jd: ExtractedJd; missingSkills?: string[] }) => `Build interview preparation.

TARGET JOB:
${promptJd(input.jd)}

RESUME:
${promptResume(input.resume)}

MISSING MUST-HAVE SKILLS TO PROBE HONESTLY:
${input.missingSkills?.length ? input.missingSkills.join(", ") : "none recorded"}`,
};

export type InterviewPrompt = typeof interviewPrompt;
