import { z } from "zod";

/**
 * Structured output contracts for every LLM task.
 * These schemas are exported as JSON Schema in the prompts and validated again
 * with Zod after each response. No route trusts raw model output.
 */

export const llmParseSchema = z.object({
  contact: z.object({
    fullName: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string(),
    github: z.string(),
    website: z.string(),
  }),
  summary: z.string(),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      current: z.boolean(),
      bullets: z.array(z.object({ text: z.string(), sourceQuote: z.string() })),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string(),
      location: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      details: z.string(),
    }),
  ),
  skills: z.array(z.object({ name: z.string(), skills: z.array(z.string()) })),
  projects: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      description: z.string(),
      url: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      bullets: z.array(z.object({ text: z.string(), sourceQuote: z.string() })),
    }),
  ),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string(),
      issueDate: z.string(),
      credentialId: z.string(),
      url: z.string(),
    }),
  ),
  awards: z.array(z.object({ name: z.string(), issuer: z.string(), date: z.string(), description: z.string() })),
  custom: z.array(z.object({ title: z.string(), content: z.string() })),
  sectionOrder: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type LlmParseOutput = z.infer<typeof llmParseSchema>;

export const llmAnalyzeSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  issues: z.array(
    z.object({
      severity: z.enum(["critical", "warning", "info"]),
      category: z.enum(["keywords", "sections", "format", "contact", "bullets", "readability", "spelling", "timeline", "content"]),
      title: z.string(),
      location: z.string(),
      why: z.string(),
      fixLabel: z.string(),
      fixKind: z.enum(["auto", "review", "ask", "none"]),
      suggestedText: z.string(),
    }),
  ),
  keywordNotes: z.array(z.string()),
  truthWarnings: z.array(z.string()),
});

export type LlmAnalyzeOutput = z.infer<typeof llmAnalyzeSchema>;

export const tailorChangeKindSchema = z.enum([
  "summary",
  "bullet_rewrite",
  "bullet_reorder",
  "section_reorder",
  "skills_reorder",
  "experience_reorder",
  "keyword_insert",
]);

export const llmTailorSchema = z.object({
  summary: z.string(),
  changes: z.array(
    z.object({
      kind: tailorChangeKindSchema,
      section: z.string(),
      targetId: z.string(),
      before: z.string(),
      after: z.string(),
      rationale: z.string(),
      sourceQuote: z.string(),
      risk: z.enum(["low", "medium", "high"]),
    }),
  ),
  warnings: z.array(z.string()),
  coveredKeywords: z.array(z.string()),
  uncoveredKeywords: z.array(z.string()),
});

export type LlmTailorOutput = z.infer<typeof llmTailorSchema>;

export const llmGapSchema = z.object({
  gaps: z.array(
    z.object({
      skill: z.string(),
      category: z.enum(["skill", "tool", "domain", "responsibility"]),
      importance: z.enum(["must", "nice"]),
      why: z.string(),
      questions: z.array(z.string()).min(1).max(3),
      reframe: z.array(z.object({ before: z.string(), after: z.string() })).max(3),
      project: z.object({
        title: z.string(),
        scope: z.string(),
        stack: z.array(z.string()),
        plan: z.array(z.string()),
        repoStructure: z.array(z.string()),
      }),
      learning: z.object({
        path: z.array(z.string()),
        certifications: z.array(z.object({ name: z.string(), provider: z.string(), note: z.string() })),
      }),
    }),
  ),
});

export type LlmGapOutput = z.infer<typeof llmGapSchema>;

export const llmBulletSchema = z.object({
  variations: z
    .array(
      z.object({
        text: z.string(),
        formula: z.enum(["XYZ", "STAR", "action-result", "scope-action-result"]),
        needsMetric: z.boolean(),
      }),
    )
    .length(3),
  followUpQuestions: z.array(z.string()).max(5),
});

export type LlmBulletOutput = z.infer<typeof llmBulletSchema>;

export const llmFactCheckSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.enum(["critical", "warning", "info"]),
      claim: z.string(),
      location: z.string(),
      reason: z.string(),
      suggestion: z.string(),
      blocking: z.boolean(),
    }),
  ),
  summary: z.string(),
});

export type LlmFactCheckOutput = z.infer<typeof llmFactCheckSchema>;

export const llmCoverLetterSchema = z.object({
  greeting: z.string(),
  content: z.string(),
  toneNotes: z.array(z.string()),
});

export type LlmCoverLetterOutput = z.infer<typeof llmCoverLetterSchema>;

export const llmInterviewSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      category: z.enum(["behavioural", "role", "resume", "company", "gap"]),
      why: z.string(),
      framework: z.string(),
      talkingPoints: z.array(z.string()),
    }),
  ),
});

export type LlmInterviewOutput = z.infer<typeof llmInterviewSchema>;

export const llmLinkedInSchema = z.object({
  headline: z.string(),
  about: z.string(),
  skills: z.array(z.string()).max(20),
  featured: z.array(z.string()).max(5),
});

export type LlmLinkedInOutput = z.infer<typeof llmLinkedInSchema>;

export const llmSummarySchema = z.object({
  summaries: z
    .array(
      z.object({
        text: z.string(),
        angle: z.enum(["role-fit", "impact-led", "career-change", "fresher"]),
      }),
    )
    .length(3),
  skillsGroups: z.array(z.object({ name: z.string(), skills: z.array(z.string()) })),
});

export type LlmSummaryOutput = z.infer<typeof llmSummarySchema>;
