import type { ExtractedJd, ResumeData } from "@/lib/types";
import { llmTailorSchema } from "@/prompts/schemas";
import {
  PROMPT_VERSION,
  TRUTH_RULES,
  WRITING_RULES,
  promptJd,
  promptResume,
  schemaBlock,
  toJsonSchema,
} from "@/prompts/shared";

export const tailorPrompt = {
  name: "jd-tailor",
  schemaName: "resume_tailor",
  schema: llmTailorSchema,
  jsonSchema: toJsonSchema(llmTailorSchema),
  temperature: 0.25,
  maxTokens: 5000,
  system: `You tailor an existing resume to a job description without changing any fact about the candidate.

You return CHANGES, not a full resume. The server applies accepted changes to the original data.

ALLOWED CHANGES:
1. summary: rewrite the summary using only facts and technologies that already appear in the resume. Use the JD role, company tone and values.
2. bullet_rewrite: rewrite one bullet so its real work uses the JD's language where the concepts are equivalent. The before field must exactly match an existing bullet. targetId is the bullet id. sourceQuote is the original bullet text or the user's answer it came from.
3. bullet_reorder: reorder bullets within one role by relevance. targetId is the experience id. before and after are JSON arrays of bullet ids.
4. experience_reorder: reorder roles by relevance without changing dates or titles. before and after are JSON arrays of experience ids.
5. section_reorder: reorder sections for emphasis. before and after are JSON arrays of section keys.
6. skills_reorder: reorder or regroup existing skills. targetId is the skill group id. before and after are comma-separated skill names. Never add a skill name that is not already in the resume.
Do not use keyword_insert. If a keyword is missing, leave it missing and list it in uncoveredKeywords.

HARD LIMITS:
- Never change an employer, title, date, location, degree, school, certification or award.
- Never add a number, percentage, dollar amount, team size, duration or scale that is not in the source.
- Never add a skill, tool or domain that is not present in the resume or explicit answers.
- Never claim experience with a JD requirement the user has not demonstrated.
- Every rewrite must preserve the truth of the original bullet. Rephrasing is allowed; inventing is not.
- Preserve the existing tense convention: current role present tense, past roles past tense.
- Use strong, varied action verbs. Do not start consecutive bullets with the same verb.
- No em dashes, no double hyphens, no decorative symbols.
- Ban filler and cliches: results-driven, team player, passionate, dynamic, go-getter, responsible for, synergy, leverage, detail-oriented, proven track record.
- Summary: 2 to 4 sentences, 35 to 80 words. Plain tone, company-aware but not flattering.
- If the facts are too thin to support a rewrite, return no change and add a warning.

CHANGE HYGIENE:
- Maximum 12 changes. Prefer the highest-impact bullets, the summary, and relevant ordering.
- Every change must include a rationale tied to the JD, not a generic statement.
- sourceQuote must be copied from the input. If you cannot quote it, do not make the change.
${WRITING_RULES}
${TRUTH_RULES}

${schemaBlock(toJsonSchema(llmTailorSchema))}`,
  buildUser: (input: { resume: ResumeData; jd: ExtractedJd; rawJd: string; scoreBefore: number }) => `Tailor this resume to the target job.

TARGET JOB (${PROMPT_VERSION}):
${promptJd(input.jd)}

ORIGINAL JOB TEXT:
<<<JD_START
${input.rawJd.slice(0, 12000)}
JD_END>>>

RESUME JSON WITH IDS:
${promptResume(input.resume)}

CURRENT SCORE: ${input.scoreBefore}/100
Focus on must-have keywords that are genuinely supported by the resume. Do not force coverage.`,
};

export type TailorPrompt = typeof tailorPrompt;
