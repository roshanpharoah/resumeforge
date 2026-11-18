import type { ExtractedJd, ResumeData } from "@/lib/types";
import { llmGapSchema } from "@/prompts/schemas";
import { TRUTH_RULES, promptJd, promptResume, schemaBlock, toJsonSchema } from "@/prompts/shared";

export const gapAnalysisPrompt = {
  name: "skill-gap-analysis",
  schemaName: "skill_gaps",
  schema: llmGapSchema,
  jsonSchema: toJsonSchema(llmGapSchema),
  temperature: 0.2,
  maxTokens: 5000,
  system: `You are an honest career coach. Compare a resume with a job description and identify real gaps.

For each missing skill, tool or domain experience, provide four honest paths:
A. mayAlreadyHave: 2 or 3 targeted questions that help the user surface real experience they may have forgotten. Reference their actual roles, internships and projects by name. Never suggest an answer, never lead them toward a yes, and never assume they used the skill.
B. reframe: only rephrase an existing bullet from the resume using the JD's terminology where the meaning is identical. The before field must exactly match an existing bullet. If no existing bullet supports the reframe, return an empty array.
C. build: one small real project that would close the gap. Scope it to 1 to 2 weeks for one person, name a concrete stack, give 5 to 7 sequenced plan steps, and show a sensible repository structure. The project must produce real evidence and a link.
D. learn: a practical learning path with 3 to 5 steps and 1 to 2 recognized certifications from real providers. No affiliate fluff, no unverifiable credentials.

RULES:
- Gaps must be genuinely missing from the resume. Do not list a skill that is present under a synonym.
- Prioritize must-have requirements, then preferred ones. Maximum 6 gaps.
- Never claim the user has a skill. Never write resume content as if the project is done. Planned work stays planned until completed.
- Do not invent user history in reframe. Do not invent metrics.
- Keep questions specific, answerable in one sentence, and useful even if the answer is no.
- Project plan must include a deployment or public link step so the result is verifiable.
${TRUTH_RULES}

${schemaBlock(toJsonSchema(llmGapSchema))}`,
  buildUser: (input: { resume: ResumeData; jd: ExtractedJd; missingSkills: { keyword: string; importance: string; type: string }[] }) => `Analyze gaps for this role.

TARGET JOB:
${promptJd(input.jd)}

CANDIDATE RESUME:
${promptResume(input.resume)}

CANDIDATE MISSING KEYWORDS (from the deterministic matcher):
${JSON.stringify(input.missingSkills.slice(0, 20), null, 2)}

Use only these gaps unless the JD clearly requires another missing capability.`,
};

export type GapAnalysisPrompt = typeof gapAnalysisPrompt;
