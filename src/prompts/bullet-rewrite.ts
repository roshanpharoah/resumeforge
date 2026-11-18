import { llmBulletSchema } from "@/prompts/schemas";
import { TRUTH_RULES, WRITING_RULES, schemaBlock, toJsonSchema } from "@/prompts/shared";

export const bulletRewritePrompt = {
  name: "bullet-rewrite",
  schemaName: "bullet_variations",
  schema: llmBulletSchema,
  jsonSchema: toJsonSchema(llmBulletSchema),
  temperature: 0.35,
  maxTokens: 1200,
  system: `You write resume bullets and you never invent facts.

Produce exactly 3 variations of the supplied bullet. Each variation uses a different formula:
1. XYZ: Accomplished X, measured by Y, by doing Z.
2. STAR: Situation or task, action, result. Compress it into one bullet.
3. action-result: Strong verb, concrete action, honest outcome.

Rules:
- Preserve every fact from the source bullet: employer, tool, scope, metric and result.
- Never add a number, percentage, dollar amount, scale, team size or duration that is not in the source or user answers.
- If a quantified result would make the bullet materially stronger and no real number exists, set needsMetric true and use the exact placeholder [add metric]. Include a specific follow-up question that asks for the real figure.
- Do not use a placeholder when the bullet works without a number. Prefer a truthful bullet with no metric.
- Start with a strong action verb. No repeated opening verbs across the 3 variations.
- One idea, 1 to 2 lines, 8 to 24 words when possible.
- Past tense for past roles, present tense for the current role.
- No first-person pronouns.
- No em dashes, no double hyphens, no decorative symbols.
- Ban: results-driven, team player, passionate, dynamic, go-getter, responsible for, synergy, leverage, rockstar, ninja, guru, detail-oriented, proven track record.
- If the original bullet contains vague words such as several, many or various, ask for the real quantity instead of keeping the vagueness.
${WRITING_RULES}
${TRUTH_RULES}

${schemaBlock(toJsonSchema(llmBulletSchema))}`,
  buildUser: (input: {
    bullet: string;
    role: string;
    company: string;
    current: boolean;
    jdKeywords: string[];
    userAnswer?: string;
    askMetric?: boolean;
  }) => `Rewrite this bullet.

SOURCE BULLET: ${input.bullet}
ROLE: ${input.role} at ${input.company}
TENSE: ${input.current ? "present (current role)" : "past"}
RELEVANT JD KEYWORDS: ${input.jdKeywords.length ? input.jdKeywords.join(", ") : "none"}
${input.userAnswer ? `USER ANSWER WITH ADDITIONAL REAL DETAIL: ${input.userAnswer}` : ""}
${input.askMetric ? "The user specifically wants to add quantification. Ask for real numbers and do not guess." : ""}

Each variation must be supportable from the source bullet and the user answer. Return the follow-up questions needed to make any placeholder real.`,
};

export type BulletRewritePrompt = typeof bulletRewritePrompt;
