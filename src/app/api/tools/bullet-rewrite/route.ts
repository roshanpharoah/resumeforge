import { apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { bulletRewriteSchema } from "@/lib/requests";
import { rewriteBullet } from "@/lib/ai";
import { extractJd } from "@/lib/keywords";
import { getOwnedJob, getOwnedResume, resolveResumeContent } from "@/lib/server-data";
import type { ExtractedJd } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45;

export const POST = apiHandler(async (request: Request) => {
  const user = await requireApiUser();
  const body = bulletRewriteSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, body.resumeId);
  const resolved = await resolveResumeContent(resume, body.versionId);
  let jdKeywords: string[] = [];
  if (body.jobId) {
    const job = await getOwnedJob(user.id, body.jobId);
    const jd = (job.extracted as ExtractedJd | null) ?? extractJd(job.jdText, job.title, job.company);
    jdKeywords = jd.keywords.map((k) => k.keyword).slice(0, 30);
  }
  const result = await rewriteBullet({
    resume: resolved.data,
    bulletText: body.bulletText,
    role: body.role,
    company: body.company,
    current: body.current,
    jdKeywords,
    userAnswer: body.userAnswer,
    askMetric: body.askMetric,
  });
  return json({ result });
});
