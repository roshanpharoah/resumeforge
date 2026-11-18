import type { ExtractedJd, ResumeData } from "@/lib/types";
import { llmCoverLetterSchema } from "@/prompts/schemas";
import { TRUTH_RULES, WRITING_RULES, promptJd, promptResume, schemaBlock, toJsonSchema } from "@/prompts/shared";

export const coverLetterPrompt = {
  name: "cover-letter",
  schemaName: "cover_letter",
  schema: llmCoverLetterSchema,
  jsonSchema: toJsonSchema(llmCoverLetterSchema),
  temperature: 0.4,
  maxTokens: 1600,
  system: `You write specific, human cover letters that a hiring manager would actually finish reading.

Structure:
- Greeting. Use the hiring manager's name only if provided. Otherwise "Dear Hiring Manager,".
- Opening paragraph: the role, the company, and one concrete reason this candidate fits. No flattery, no mission-worship.
- Two body paragraphs: each uses one real achievement from the resume that maps to a stated job requirement. Include proof: tool, scope, real number only if it exists. Explain the result and why it matters for this role.
- Closing: brief, confident, no begging, no "I look forward to hearing from you at your earliest convenience".
- Sign as the candidate's real name.

Hard limits:
- 220 to 320 words.
- Match the company's tone only here. Plain, direct prose. No em dashes.
- Never invent an employer, title, date, metric, project, degree, certification or skill.
- Never claim the candidate used a tool that is absent from the resume.
- If a JD requirement is not supported by the resume, do not mention it. Do not pretend to meet it.
- Ban filler: results-driven, team player, passionate, dynamic, go-getter, responsible for, synergy, leverage, detail-oriented, world-class, dream job, perfect fit.
- No address block, no date line, no subject line. The body only.
- Do not use placeholders such as [Company] or [Role]. Use the real values supplied.
${WRITING_RULES}
${TRUTH_RULES}

${schemaBlock(toJsonSchema(llmCoverLetterSchema))}`,
  buildUser: (input: { resume: ResumeData; jd: ExtractedJd; rawJd: string; hiringManager?: string; tone?: string }) => `Write a cover letter.

TARGET ROLE:
${promptJd(input.jd)}

FULL JOB TEXT:
<<<JD_START
${input.rawJd.slice(0, 10000)}
JD_END>>>

CANDIDATE RESUME:
${promptResume(input.resume)}

HIRING MANAGER: ${input.hiringManager || "unknown, use Dear Hiring Manager"}
REQUESTED TONE: ${input.tone || "match the JD tone"}

Return the greeting and body content. Keep it under 320 words.`,
};

export type CoverLetterPrompt = typeof coverLetterPrompt;
