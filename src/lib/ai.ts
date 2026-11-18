import type {
  AnalysisIssue,
  AnalysisResult,
  BulletRewriteResult,
  CoverLetterResult,
  ExtractedJd,
  FactCheckResult,
  GapItemView,
  InterviewPrepResult,
  LinkedInResult,
  ResumeData,
  SectionKey,
  TailorChange,
  TailorResult,
} from "@/lib/types";
import { resumeDataSchema, sectionKeys, uid, resumeToPlainText } from "@/lib/types";
import { hasLlm } from "@/lib/env";
import { callLlm } from "@/lib/llm";
import { analyzePrompt } from "@/prompts/analyze";
import { parsePrompt } from "@/prompts/parse";
import { tailorPrompt } from "@/prompts/tailor";
import { gapAnalysisPrompt } from "@/prompts/gap-analysis";
import { bulletRewritePrompt } from "@/prompts/bullet-rewrite";
import { coverLetterPrompt } from "@/prompts/cover-letter";
import { interviewPrompt } from "@/prompts/interview";
import { linkedinPrompt } from "@/prompts/linkedin";
import { summaryPrompt } from "@/prompts/summary";
import { factCheckPrompt } from "@/prompts/fact-check";
import type {
  LlmAnalyzeOutput,
  LlmBulletOutput,
  LlmCoverLetterOutput,
  LlmFactCheckOutput,
  LlmGapOutput,
  LlmInterviewOutput,
  LlmLinkedInOutput,
  LlmParseOutput,
  LlmSummaryOutput,
  LlmTailorOutput,
} from "@/prompts/schemas";
import { factCheckProse, factCheckResume } from "@/lib/fact-check";
import {
  generateBulletVariations,
  generateCoverLetterFromParts,
  generateCoverLetterRules,
  generateInterviewRules,
  generateLinkedInFromParts,
  generateLinkedInRules,
  generateSummariesRules,
} from "@/lib/generate";
import { finalizeTailorResult, mergeLlmChanges, rulesTailor } from "@/lib/tailor";
import { deriveRuleGaps, mergeLlmGaps, type GapSeed } from "@/lib/gaps";
import { analyzeKeywords } from "@/lib/keywords";

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function mapParsed(out: LlmParseOutput, fallbackOrder: SectionKey[]): ResumeData {
  const order = out.sectionOrder
    .map((s) => s.toLowerCase().trim())
    .filter((s): s is SectionKey => (sectionKeys as readonly string[]).includes(s));
  const data: ResumeData = {
    contact: {
      fullName: out.contact.fullName ?? "",
      headline: out.contact.headline ?? "",
      email: out.contact.email ?? "",
      phone: out.contact.phone ?? "",
      location: out.contact.location ?? "",
      website: out.contact.website ?? "",
      linkedin: out.contact.linkedin ?? "",
      github: out.contact.github ?? "",
    },
    summary: (out.summary ?? "").trim(),
    summarySource: { type: "user_text", ref: "uploaded resume", quote: (out.summary ?? "").trim() },
    experience: out.experience.map((e) => ({
      id: uid(),
      company: e.company ?? "",
      title: e.title ?? "",
      location: e.location ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
      current: Boolean(e.current),
      bullets: (e.bullets ?? []).map((b) => ({
        id: uid(),
        text: b.text,
        source: { type: "user_text", ref: "uploaded resume", quote: b.sourceQuote || b.text },
        verified: true,
        metricPlaceholder: false,
        keywords: [],
      })),
      source: "uploaded resume",
    })),
    education: out.education.map((e) => ({
      id: uid(),
      institution: e.institution ?? "",
      degree: e.degree ?? "",
      field: e.field ?? "",
      location: e.location ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
      details: e.details ?? "",
      source: "uploaded resume",
    })),
    skills: out.skills.map((g) => ({ id: uid(), name: g.name || "Skills", skills: (g.skills ?? []).filter(Boolean) })),
    projects: out.projects.map((p) => ({
      id: uid(),
      name: p.name,
      role: p.role ?? "",
      description: p.description ?? "",
      url: p.url ?? "",
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
      bullets: (p.bullets ?? []).map((b) => ({
        id: uid(),
        text: b.text,
        source: { type: "user_text" as const, ref: "uploaded resume", quote: b.sourceQuote || b.text },
        verified: true,
        metricPlaceholder: false,
        keywords: [],
      })),
      source: "uploaded resume",
      planned: false,
    })),
    certifications: out.certifications.map((c) => ({
      id: uid(),
      name: c.name,
      issuer: c.issuer ?? "",
      issueDate: c.issueDate ?? "",
      credentialId: c.credentialId ?? "",
      url: c.url ?? "",
      source: "uploaded resume",
    })),
    awards: out.awards.map((a) => ({
      id: uid(),
      name: a.name,
      issuer: a.issuer ?? "",
      date: a.date ?? "",
      description: a.description ?? "",
      source: "uploaded resume",
    })),
    custom: out.custom.map((c) => ({ id: uid(), title: c.title, content: c.content })),
    sectionOrder: order.length ? order : fallbackOrder,
  };

  const present: SectionKey[] = [];
  if (data.summary) present.push("summary");
  if (data.experience.length) present.push("experience");
  if (data.projects.length) present.push("projects");
  if (data.education.length) present.push("education");
  if (data.skills.length) present.push("skills");
  if (data.certifications.length) present.push("certifications");
  if (data.awards.length) present.push("awards");
  if (data.custom.length) present.push("custom");
  const finalOrder = data.sectionOrder.filter((s) => present.includes(s));
  for (const key of present) if (!finalOrder.includes(key)) finalOrder.push(key);
  data.sectionOrder = finalOrder.length ? finalOrder : fallbackOrder;
  return resumeDataSchema.parse(data);
}

export async function parseWithAi(
  rawText: string,
  fileName: string,
  fallbackData: ResumeData,
): Promise<{ data: ResumeData; warnings: string[]; llmUsed: boolean }> {
  if (!hasLlm()) return { data: fallbackData, warnings: [], llmUsed: false };
  const result = await callLlm({
    ...parsePrompt,
    user: parsePrompt.buildUser({ rawText, fileName }),
  });
  if (!result.ok || !result.data) {
    return { data: fallbackData, warnings: [`AI parsing was unavailable, so the rules parser was used. ${result.error ?? ""}`.trim()], llmUsed: false };
  }
  try {
    const data = mapParsed(result.data, fallbackData.sectionOrder);
    const warnings = result.data.warnings ?? [];
    if (!data.experience.length && fallbackData.experience.length) {
      warnings.push("AI parsing missed work experience, so the rules parser result was kept for that section.");
      data.experience = fallbackData.experience;
    }
    if (!data.contact.email && fallbackData.contact.email) data.contact.email = fallbackData.contact.email;
    if (!data.contact.fullName && fallbackData.contact.fullName) data.contact.fullName = fallbackData.contact.fullName;
    if (!data.skills.length && fallbackData.skills.length) data.skills = fallbackData.skills;
    return { data, warnings, llmUsed: true };
  } catch (error) {
    return {
      data: fallbackData,
      warnings: [`AI parsing returned an invalid structure, so the rules parser was used. ${error instanceof Error ? error.message : ""}`.trim()],
      llmUsed: false,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Analysis enrichment                                                 */
/* ------------------------------------------------------------------ */

export async function enrichAnalysis(
  resume: ResumeData,
  jd: ExtractedJd | null,
  analysis: AnalysisResult,
): Promise<{ analysis: AnalysisResult; llmUsed: boolean }> {
  if (!hasLlm() || analysis.meta.wordCount < 30) return { analysis, llmUsed: false };
  const result = await callLlm({
    ...analyzePrompt,
    user: analyzePrompt.buildUser({ resume, jd, analysis }),
  });
  if (!result.ok || !result.data) return { analysis, llmUsed: false };
  const existing = new Set(analysis.issues.map((i) => i.title.toLowerCase()));
  const llmIssues: AnalysisIssue[] = result.data.issues
    .filter((issue) => !existing.has(issue.title.toLowerCase()))
    .slice(0, 8)
    .map((issue) => ({
      id: `llm_${uid()}`,
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      location: issue.location,
      why: `${issue.why}${issue.suggestedText ? ` Suggested rewrite: "${issue.suggestedText}"` : ""}`,
      fix: {
        kind: issue.fixKind,
        label: issue.fixLabel,
        patch: {
          op: "open_tool",
          tool: issue.category === "keywords" ? "gap-analysis" : issue.category === "bullets" ? "bullet-rewrite" : "proofread",
        },
      },
    }));
  const issues = [...analysis.issues, ...llmIssues].sort((a, b) => {
    const rank = (s: string) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
    return rank(a.severity) - rank(b.severity);
  });
  return {
    analysis: { ...analysis, issues, generatedBy: "llm" },
    llmUsed: true,
  };
}

export async function runLlmFactCheck(
  generated: ResumeData,
  source: ResumeData,
  answers: string[] = [],
): Promise<{ result: LlmFactCheckOutput["findings"]; used: boolean }> {
  if (!hasLlm()) return { result: [], used: false };
  const res = await callLlm({ ...factCheckPrompt, user: factCheckPrompt.buildUser({ generated, source, answers }) });
  if (!res.ok || !res.data) return { result: [], used: false };
  return { result: res.data.findings, used: true };
}

/* ------------------------------------------------------------------ */
/* Tailoring                                                           */
/* ------------------------------------------------------------------ */

export async function tailorWithAi(
  base: ResumeData,
  jd: ExtractedJd,
  rawJd: string,
  useLlm = true,
  answers: string[] = [],
): Promise<TailorResult> {
  const rules = rulesTailor(base, jd);
  if (!hasLlm() || !useLlm) return finalizeTailorResult(base, jd, rules.changes, "rules");

  const result = await callLlm({
    ...tailorPrompt,
    user: tailorPrompt.buildUser({ resume: base, jd, rawJd, scoreBefore: rules.scoreBefore }),
  });
  if (!result.ok || !result.data) {
    return finalizeTailorResult(base, jd, rules.changes, "rules", [`AI tailoring was unavailable, so safe rule based changes were used. ${result.error ?? ""}`.trim()]);
  }
  try {
    const merged = mergeLlmChanges(base, jd, rules, result.data as LlmTailorOutput, { answers });
    if (!merged.changes.length) {
      return finalizeTailorResult(base, jd, rules.changes, "rules", ["AI did not propose a change that passed the fact guard, so safe rule based changes were used."]);
    }
    return finalizeTailorResult(base, jd, merged.changes, "llm", merged.warnings);
  } catch (error) {
    return finalizeTailorResult(base, jd, rules.changes, "rules", [`AI tailoring failed validation. ${error instanceof Error ? error.message : ""}`.trim()]);
  }
}

/* ------------------------------------------------------------------ */
/* Gaps                                                                */
/* ------------------------------------------------------------------ */

export async function analyzeGaps(resume: ResumeData, jd: ExtractedJd, useLlm = true): Promise<{ seeds: GapSeed[]; warnings: string[]; llmUsed: boolean }> {
  const resumeText = resumeToPlainText(resume);
  const keywordAnalysis = analyzeKeywords(jd, resumeText);
  const seeds = deriveRuleGaps(resume, jd, keywordAnalysis);
  if (!hasLlm() || !useLlm) return { seeds, warnings: [], llmUsed: false };

  const missingSkills = keywordAnalysis.missing.map((m) => ({ keyword: m.keyword, importance: m.importance, type: m.type }));
  const result = await callLlm({
    ...gapAnalysisPrompt,
    user: gapAnalysisPrompt.buildUser({ resume, jd, missingSkills }),
  });
  if (!result.ok || !result.data) {
    return { seeds, warnings: [], llmUsed: false };
  }
  try {
    const merged = mergeLlmGaps(resume, jd, seeds, result.data as LlmGapOutput);
    return { seeds: merged.gaps, warnings: merged.warnings, llmUsed: true };
  } catch {
    return { seeds, warnings: ["AI gap analysis could not be validated, so rule based options were used."], llmUsed: false };
  }
}

/* ------------------------------------------------------------------ */
/* Bullet rewrite                                                      */
/* ------------------------------------------------------------------ */

export async function rewriteBullet(input: {
  resume: ResumeData;
  bulletText: string;
  role: string;
  company: string;
  current: boolean;
  jdKeywords: string[];
  userAnswer?: string;
  askMetric?: boolean;
}): Promise<BulletRewriteResult> {
  const sources = [resumeToPlainText(input.resume), ...(input.userAnswer ? [input.userAnswer] : [])];
  const fallback = generateBulletVariations({
    bullet: input.bulletText,
    role: input.role,
    company: input.company,
    current: input.current,
    jdKeywords: input.jdKeywords,
    userAnswer: input.userAnswer,
    askMetric: input.askMetric,
    sources,
  });
  if (!hasLlm()) return fallback;
  const result = await callLlm({
    ...bulletRewritePrompt,
    user: bulletRewritePrompt.buildUser({
      bullet: input.bulletText,
      role: input.role,
      company: input.company,
      current: input.current,
      jdKeywords: input.jdKeywords,
      userAnswer: input.userAnswer,
      askMetric: input.askMetric,
    }),
  });
  if (!result.ok || !result.data) return fallback;
  const variations = result.data.variations.map((v) => ({
    text: v.text,
    formula: v.formula === "XYZ" ? "XYZ" : v.formula === "STAR" ? "STAR" : v.formula === "scope-action-result" ? "star-variant" : "action-result",
    source: input.bulletText,
    needsMetric: v.needsMetric,
  }));
  const factCheck = factCheckProse({
    text: variations.map((v) => v.text).join("\n"),
    sources,
    label: "Bullet variations",
  });
  if (factCheck.blocking > 0) {
    return fallback;
  }
  return {
    variations,
    followUpQuestions: result.data.followUpQuestions,
    factCheck,
    generatedBy: "llm",
  };
}

/* ------------------------------------------------------------------ */
/* Summaries                                                           */
/* ------------------------------------------------------------------ */

export async function generateSummaries(resume: ResumeData, jd: ExtractedJd | null): Promise<ReturnType<typeof generateSummariesRules> & { generatedBy: "rules" | "llm" }> {
  const fallback = generateSummariesRules(resume, jd);
  if (!hasLlm()) return { ...fallback, generatedBy: "rules" };
  const result = await callLlm({
    ...summaryPrompt,
    user: summaryPrompt.buildUser({ resume, jd }),
  });
  if (!result.ok || !result.data) return { ...fallback, generatedBy: "rules" };
  const data = result.data as LlmSummaryOutput;
  const resumeSkills = new Set(resume.skills.flatMap((g) => g.skills.map((s) => s.toLowerCase())));
  const safeSkills = data.skillsGroups
    .map((g) => ({
      id: fallback.skillsGroups.find((f) => f.name.toLowerCase() === g.name.toLowerCase())?.id ?? uid(),
      name: g.name,
      skills: g.skills.filter((s) => resumeSkills.has(s.toLowerCase())),
    }))
    .filter((g) => g.skills.length);
  const summaries = data.summaries.filter((s) => factCheckProse({ text: s.text, sources: [resumeToPlainText(resume), ...(jd ? [jd.company, jd.role] : [])], allowedEntities: jd ? [jd.company, jd.role] : [], label: "Summary" }).blocking === 0);
  return {
    summaries: summaries.length ? summaries.map((s) => ({ text: s.text, angle: s.angle })) : fallback.summaries,
    skillsGroups: safeSkills.length ? safeSkills : fallback.skillsGroups,
    generatedBy: summaries.length || safeSkills.length ? "llm" : "rules",
  };
}

/* ------------------------------------------------------------------ */
/* Cover letter                                                        */
/* ------------------------------------------------------------------ */

export async function generateCoverLetter(
  resume: ResumeData,
  jd: ExtractedJd,
  rawJd: string,
  options: { hiringManager?: string; tone?: string; useLlm?: boolean } = {},
): Promise<CoverLetterResult> {
  const fallback = generateCoverLetterRules(resume, jd, options.hiringManager);
  if (!hasLlm() || options.useLlm === false) return fallback;
  const result = await callLlm({
    ...coverLetterPrompt,
    user: coverLetterPrompt.buildUser({ resume, jd, rawJd, hiringManager: options.hiringManager, tone: options.tone }),
  });
  if (!result.ok || !result.data) return fallback;
  const data = result.data as LlmCoverLetterOutput;
  const generated = generateCoverLetterFromParts(resume, jd, { greeting: data.greeting, content: data.content });
  if (generated.factCheck.blocking > 0) {
    return { ...fallback, factCheck: mergeFactCheck(fallback.factCheck, generated.factCheck), generatedBy: "rules" };
  }
  return generated;
}

function mergeFactCheck(a: FactCheckResult, b: FactCheckResult): FactCheckResult {
  const findings = [...a.findings, ...b.findings.filter((f) => !a.findings.some((x) => x.fingerprint === f.fingerprint))];
  const blocking = findings.filter((f) => f.blocking).length;
  return { ...a, findings, blocking, warnings: findings.length - blocking, passed: blocking === 0 };
}

/* ------------------------------------------------------------------ */
/* Interview                                                           */
/* ------------------------------------------------------------------ */

export async function generateInterview(
  resume: ResumeData,
  jd: ExtractedJd,
  missingSkills: string[],
  useLlm = true,
): Promise<InterviewPrepResult> {
  const fallback = generateInterviewRules(resume, jd, missingSkills);
  if (!hasLlm() || !useLlm) return fallback;
  const result = await callLlm({
    ...interviewPrompt,
    user: interviewPrompt.buildUser({ resume, jd, missingSkills }),
  });
  if (!result.ok || !result.data) return fallback;
  const data = result.data as LlmInterviewOutput;
  return {
    questions: data.questions.slice(0, 12),
    generatedBy: "llm",
  };
}

/* ------------------------------------------------------------------ */
/* LinkedIn                                                            */
/* ------------------------------------------------------------------ */

export async function generateLinkedIn(resume: ResumeData, jd: ExtractedJd, useLlm = true): Promise<LinkedInResult> {
  const fallback = generateLinkedInRules(resume, jd);
  if (!hasLlm() || !useLlm) return fallback;
  const result = await callLlm({
    ...linkedinPrompt,
    user: linkedinPrompt.buildUser({ resume, jd }),
  });
  if (!result.ok || !result.data) return fallback;
  const data = result.data as LlmLinkedInOutput;
  const resumeSkills = new Set(resume.skills.flatMap((g) => g.skills.map((s) => s.toLowerCase())));
  const safeSkills = data.skills.filter((s) => resumeSkills.has(s.toLowerCase()));
  const output = generateLinkedInFromParts(resume, jd, {
    headline: data.headline,
    about: data.about,
    skills: safeSkills.length ? safeSkills.slice(0, 20) : fallback.skills,
    featured: data.featured,
  });
  if (output.factCheck.blocking > 0) {
    return { ...fallback, factCheck: mergeFactCheck(fallback.factCheck, output.factCheck), generatedBy: "rules" };
  }
  return output;
}

/* ------------------------------------------------------------------ */
/* Deterministic guard + LLM second opinion                            */
/* ------------------------------------------------------------------ */

export async function buildFactCheck(
  resume: ResumeData,
  base: ResumeData | null,
  sourceText: string,
  options: { answers?: string[]; confirmations?: string[]; allowedEntities?: string[]; checkIdentity?: boolean } = {},
): Promise<FactCheckResult> {
  const deterministic = factCheckResume({
    data: resume,
    base,
    sourceText,
    answers: options.answers,
    confirmations: options.confirmations,
    allowedEntities: options.allowedEntities,
    checkIdentity: options.checkIdentity,
  });
  return deterministic;
}

export type AiGapSeed = GapSeed;
export type { GapItemView };
