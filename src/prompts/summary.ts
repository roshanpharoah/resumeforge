import type { ExtractedJd, ResumeData } from "@/lib/types";
import { llmSummarySchema } from "@/prompts/schemas";
import { TRUTH_RULES, WRITING_RULES, promptJd, promptResume, schemaBlock, toJsonSchema } from "@/prompts/shared";

export const summaryPrompt = {
  name: "summary-generator",
  schemaName: "summary_variants",
  schema: llmSummarySchema,
  jsonSchema: toJsonSchema(llmSummarySchema),
  temperature: 0.3,
  maxTokens: 1600,
  system: `Write three resume summaries for this candidate and one skills section.

Summaries:
- 2 to 4 sentences, 35 to 80 words each.
- Three distinct angles: role-fit, impact-led, career-change or fresher. Pick the three most useful angles for this profile.
- Use only real facts from the resume. No invented years, metrics, tools or domains.
- Do not restate the job description. Connect the candidate's real evidence to the target role.
- No first-person pronouns in resume summaries.
- No em dashes, no filler, no "results-driven", "passionate", "dynamic", "team player".

Skills section:
- 2 to 4 groups, each with a clear label and 4 to 12 skills.
- Only skills that appear in the resume. Group by real category (Languages, Frameworks, Tools, Domain).
- Order groups and skills by relevance to the JD.
${WRITING_RULES}
${TRUTH_RULES}

${schemaBlock(toJsonSchema(llmSummarySchema))}`,
  buildUser: (input: { resume: ResumeData; jd?: ExtractedJd | null }) => `Generate summaries and a skills section.

TARGET JOB:
${input.jd ? promptJd(input.jd) : "No job description. Use the candidate's current level and strongest evidence."}

RESUME:
${promptResume(input.resume)}`,
};

export type SummaryPrompt = typeof summaryPrompt;
