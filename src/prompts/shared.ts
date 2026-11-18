import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ExtractedJd, ResumeData } from "@/lib/types";
import { resumeToPlainText } from "@/lib/types";

export const PROMPT_VERSION = "2026-01-resumeforge-v1";

export const WRITING_RULES = `
WRITING RULES (apply to every generated sentence):
- No em dashes. No double hyphens. No decorative symbols or emoji used as separators.
- Ban these phrases and their close variants: results-driven, team player, passionate, dynamic, go-getter, responsible for, synergy, leverage, rockstar, ninja, guru, proven track record, detail-oriented, hard-working, self-starter, hit the ground running, world-class, best-in-class, cutting-edge.
- Start every resume bullet with a strong, varied action verb. Do not repeat an opening verb within the same section.
- One idea per bullet, 1 to 2 lines, 8 to 24 words when possible.
- Use past tense for past roles and present tense for the current role.
- Prefer concrete tools, real numbers and outcomes over adjectives. Never estimate or invent a number.
- Write plainly and humanly. Match the company's tone only in the summary and cover letter, never in experience bullets.
- Do not use first-person pronouns in resume bullets or the resume summary.
- No cliches. No filler. Every sentence earns its space.
`.trim();

export const TRUTH_RULES = `
TRUTHFULNESS RULES (non-negotiable):
- Use only facts present in the user-provided resume, their explicit answers, or confirmed project evidence in the input.
- Never invent employers, job titles, dates, locations, degrees, schools, certifications, awards, projects or metrics.
- Never add a skill or tool unless the user's data shows real use of it. Keyword insertion is allowed only when the exact concept already appears in the user's experience under different wording.
- Preserve every company name, title, date and degree exactly. Reformatting a date is allowed only if it represents the same month and year.
- If a bullet needs a number the user did not provide, ask for it. If the output requires a placeholder, write [add metric] and mark the item so export is blocked. Do not guess.
- Every rewritten bullet must keep a sourceQuote from the user's original text or answers.
- If the available evidence is too thin, omit the claim and add a warning. Silence is better than fabrication.
`.trim();

export const QUALITY_BAR = `
QUALITY BAR:
- A recruiter should understand the candidate's level and strongest evidence in 6 seconds.
- Every issue you raise must explain why it matters and what to do next.
- Prefer specific and testable feedback. No generic encouragement.
`.trim();

export const sanityDisclaimer =
  "AI output is a draft. ResumeForge validates claims against your source data, but you are responsible for confirming every line before you apply.";

export function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const json = zodToJsonSchema(schema, { target: "openAi", $refStrategy: "none" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export function schemaBlock(schema: Record<string, unknown>): string {
  return `Return only a JSON object matching this JSON Schema exactly:\n${JSON.stringify(schema, null, 2)}`;
}

export function promptResume(resume: ResumeData): string {
  return JSON.stringify(
    {
      contact: resume.contact,
      summary: resume.summary,
      experience: resume.experience.map((e) => ({
        id: e.id,
        title: e.title,
        company: e.company,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        current: e.current,
        bullets: e.bullets.map((b) => ({ id: b.id, text: b.text, sourceQuote: b.source.quote ?? "", sourceType: b.source.type })),
      })),
      projects: resume.projects.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        description: p.description,
        url: p.url,
        startDate: p.startDate,
        endDate: p.endDate,
        bullets: p.bullets.map((b) => ({ id: b.id, text: b.text, sourceQuote: b.source.quote ?? "" })),
      })),
      education: resume.education.map((e) => ({
        id: e.id,
        institution: e.institution,
        degree: e.degree,
        field: e.field,
        startDate: e.startDate,
        endDate: e.endDate,
        details: e.details,
      })),
      skills: resume.skills,
      certifications: resume.certifications,
      awards: resume.awards,
      custom: resume.custom,
      sectionOrder: resume.sectionOrder,
    },
    null,
    2,
  );
}

export function promptJd(jd: ExtractedJd): string {
  return JSON.stringify(
    {
      role: jd.role,
      company: jd.company,
      seniority: jd.seniority,
      requiredSkills: jd.requiredSkills,
      preferredSkills: jd.preferredSkills,
      tools: jd.tools,
      responsibilities: jd.responsibilities,
      keywords: jd.keywords,
      companyValues: jd.companyValues,
      tone: jd.tone,
      mustHaveYears: jd.mustHaveYears,
      summary: jd.summary,
    },
    null,
    2,
  );
}

export function resumePlainText(resume: ResumeData): string {
  return resumeToPlainText(resume);
}

export function sourceQuotes(resume: ResumeData): string[] {
  const quotes: string[] = [];
  if (resume.summarySource.quote) quotes.push(resume.summarySource.quote);
  for (const e of resume.experience) for (const b of e.bullets) if (b.source.quote) quotes.push(b.source.quote);
  for (const p of resume.projects) for (const b of p.bullets) if (b.source.quote) quotes.push(b.source.quote);
  return quotes;
}
