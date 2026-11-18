import { apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { leaderboardSchema } from "@/lib/requests";
import { analyzeResume } from "@/lib/scoring";
import { extractJd } from "@/lib/keywords";
import { getOwnedResume } from "@/lib/server-data";
import { resumeToPlainText } from "@/lib/types";
import type { ResumeData } from "@/lib/types";
import type { LeaderboardResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 45;

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = leaderboardSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, params.id);
  const data = resume.parsed as unknown as ResumeData;
  const text = resumeToPlainText(data);

  let targets = body.jobs;
  if (!targets?.length) {
    const saved = await db().job.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 12 });
    targets = saved.map((job) => ({ jobId: job.id, company: job.company, title: job.title, jdText: job.jdText }));
  }

  const results: LeaderboardResponse["results"] = [];
  for (const target of targets) {
    const jd = extractJd(target.jdText, target.title, target.company);
    const analysis = analyzeResume({ resume: data, jd, rawText: text });
    results.push({
      company: target.company,
      title: target.title,
      score: analysis.score,
      mustHaveCoverage: analysis.keywords?.mustHaveCoverage ?? 0,
      missingTop: analysis.keywords?.missing.filter((k) => k.importance === "must").slice(0, 6).map((k) => k.keyword) ?? [],
      jobId: target.jobId,
    });
    if (target.jobId) {
      await db().job.updateMany({ where: { id: target.jobId, userId: user.id }, data: { matchScore: analysis.score } });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return json({ results });
});
