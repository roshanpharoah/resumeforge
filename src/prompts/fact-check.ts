import type { ResumeData } from "@/lib/types";
import { llmFactCheckSchema } from "@/prompts/schemas";
import { TRUTH_RULES, promptResume, schemaBlock, sourceQuotes, toJsonSchema } from "@/prompts/shared";

export const factCheckPrompt = {
  name: "fact-check",
  schemaName: "fact_check",
  schema: llmFactCheckSchema,
  jsonSchema: toJsonSchema(llmFactCheckSchema),
  temperature: 0.0,
  maxTokens: 2500,
  system: `You are a conservative fact-checking editor. Your job is to catch unsupported claims in a tailored resume before it is exported.

Compare every claim in the generated resume against the source resume and the user's explicit answers. A claim is supported only when the source states the same fact, entity, metric, date or scope.

Flag:
- Invented or altered employers, titles, dates, locations, degrees, schools, certifications or awards.
- Invented numbers, percentages, dollar amounts, team sizes, user counts, time frames or scale.
- Tools, skills, domains or responsibilities that do not appear in the source.
- A statement that changes the meaning of the original work, even if the wording sounds plausible.
- Claims that cannot be traced to a specific source line.

Do not flag:
- Grammar or style improvements.
- Honest rephrasing that preserves the facts.
- Shorter phrasing of the same achievement.
- A summary that uses the target company name or role title as context.

Severity:
- critical: a factual claim is unsupported or contradicted. blocking must be true.
- warning: framing or wording cannot be traced but no specific fact is invented. blocking false.
- info: a minor traceability gap. blocking false.

Be precise. Quote the smallest unsupported claim. Suggest a concrete correction.
${TRUTH_RULES}

${schemaBlock(toJsonSchema(llmFactCheckSchema))}`,
  buildUser: (input: { generated: ResumeData; source: ResumeData; answers?: string[] }) => `FACT CHECK THIS GENERATED RESUME.

GENERATED RESUME:
${promptResume(input.generated)}

SOURCE RESUME (the user's own data):
${promptResume(input.source)}

SOURCE QUOTES:
${sourceQuotes(input.source).map((q) => `- ${q}`).join("\n") || "(none stored)"}

USER ANSWERS:
${input.answers?.length ? input.answers.map((a) => `- ${a}`).join("\n") : "(none)"}

Return findings only for claims that are not supported. Empty findings means the generated resume is factually consistent with the source.`,
};

export type FactCheckPrompt = typeof factCheckPrompt;
