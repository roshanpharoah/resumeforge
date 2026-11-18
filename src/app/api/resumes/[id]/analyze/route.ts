import { Prisma } from "@prisma/client";
import { apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { analyzeSchema } from "@/lib/requests";
import { analyzeResume } from "@/lib/scoring";
import { analyzeGaps, enrichAnalysis } from "@/lib/ai";
import { resolveJd, getOwnedResume, resolveResumeContent, serializeAnalysis, persistGapSeeds } from "@/lib/server-data";
import type { ParseRisk } from "@/lib/types";
import type { AnalyzeResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = analyzeSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, params.id);
  const { data, design, version } = await resolveResumeContent(resume, body.versionId);
  const { jd, job } = await resolveJd({ userId: user.id, jobId: body.jobId, jdText: body.jdText, title: body.title, company: body.company });

  const baseAnalysis = analyzeResume({
    resume: data,
    rawText: resume.rawText,
    jd,
    design,
    parseRisks: (resume.parseRisks as unknown as ParseRisk[]) ?? [],
  });
  const enriched = body.includeLlm ? await enrichAnalysis(data, jd, baseAnalysis) : { analysis: baseAnalysis, llmUsed: false };
  const analysis = enriched.analysis;

  const reportRow = await db().analysisReport.create({
    data: {
      resumeId: resume.id,
      versionId: version?.id ?? null,
      jobId: job?.id ?? null,
      score: analysis.score,
      breakdown: analysis.breakdown as unknown as Prisma.InputJsonValue,
      issues: analysis.issues as unknown as Prisma.InputJsonValue,
      keywords: analysis.keywords ? (analysis.keywords as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      meta: analysis.meta as unknown as Prisma.InputJsonValue,
    },
  });

  let gaps: Awaited<ReturnType<typeof persistGapSeeds>> = [];
  let gapWarnings: string[] = [];
  if (job && jd) {
    const seedResult = await analyzeGaps(data, jd, false);
    gapWarnings = seedResult.warnings;
    gaps = await persistGapSeeds({ userId: user.id, resumeId: resume.id, jobId: job.id, seeds: seedResult.seeds });
    await db().job.update({ where: { id: job.id }, data: { matchScore: analysis.score } });
  }

  const payload: AnalyzeResponse = {
    report: serializeAnalysis(reportRow),
    analysis,
    gaps,
    llmUsed: enriched.llmUsed,
  };
  return json({ ...payload, warnings: gapWarnings });
});
