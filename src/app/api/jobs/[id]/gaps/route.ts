import { apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { generateGapsSchema } from "@/lib/requests";
import { analyzeGaps } from "@/lib/ai";
import { extractJd } from "@/lib/keywords";
import { getGapsForJob, getOwnedJob, getOwnedResume, persistGapSeeds } from "@/lib/server-data";
import type { ExtractedJd, ResumeData } from "@/lib/types";
import type { GenerateGapsResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const job = await getOwnedJob(user.id, params.id);
  const resumeId = new URL(request.url).searchParams.get("resumeId");
  const resume = resumeId
    ? await getOwnedResume(user.id, resumeId)
    : await db().resume.findFirst({ where: { userId: user.id }, orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }] });
  if (!resume) return json({ gaps: [] });
  return json({ gaps: await getGapsForJob(user.id, resume.id, job.id) });
});

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = generateGapsSchema.parse(await request.json());
  const job = await getOwnedJob(user.id, params.id);
  const resume = await getOwnedResume(user.id, body.resumeId);
  const data = resume.parsed as unknown as ResumeData;
  const jd = (job.extracted as ExtractedJd | null) ?? extractJd(job.jdText, job.title, job.company);

  const generated = await analyzeGaps(data, jd, body.useLlm);
  const gaps = await persistGapSeeds({ userId: user.id, resumeId: resume.id, jobId: job.id, seeds: generated.seeds });
  const payload: GenerateGapsResponse = { gaps, warnings: generated.warnings, llmUsed: generated.llmUsed };
  return json(payload);
});
