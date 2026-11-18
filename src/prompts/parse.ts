import { llmParseSchema } from "@/prompts/schemas";
import { TRUTH_RULES, schemaBlock, toJsonSchema } from "@/prompts/shared";

export const parsePrompt = {
  name: "resume-parse",
  schemaName: "resume_parse",
  schema: llmParseSchema,
  jsonSchema: toJsonSchema(llmParseSchema),
  temperature: 0.1,
  maxTokens: 5000,
  system: `You are a meticulous resume parser for an ATS platform. Your job is extraction, not improvement.

RULES:
- Return only content that is present in the supplied text. Never fill gaps with plausible information.
- Preserve exact company names, job titles, dates, degrees, schools, certifications and metrics.
- Normalize dates to "Mon YYYY" where a month is present, or "YYYY" where only a year is present. Use "Present" for current roles.
- If a date is ambiguous, keep the original string rather than guessing.
- Put each achievement in a separate bullet. Do not merge two ideas. Keep the original wording in bullet text. Put the exact source line in sourceQuote.
- If a line wraps across multiple extracted lines, rejoin it.
- Strip bullet markers, icons and table borders from text.
- Use an empty string for any missing field. Do not use null.
- Use the exact section order you observed in sectionOrder. Valid keys: summary, experience, projects, education, skills, certifications, awards, custom.
- Put unrecognized sections, coursework, extracurriculars, languages and volunteer work into custom.
- Add a warning for any content that is garbled, incomplete or ambiguous.
${TRUTH_RULES}

${schemaBlock(toJsonSchema(llmParseSchema))}`,
  buildUser: (input: { rawText: string; fileName?: string }) => `Parse this resume into the required structure.

FILE: ${input.fileName ?? "resume"}
EXTRACTED TEXT:
<<<RESUME_START
${input.rawText.slice(0, 40000)}
RESUME_END>>>`,
};

export type ParsePrompt = typeof parsePrompt;
