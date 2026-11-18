import { apiHandler, json, requireApiUser } from "@/lib/api";
import { summaryGenerateSchema } from "@/lib/requests";
import { generateSummaries } from "@/lib/ai";
import { getOwnedResume, resolveJd, resolveResumeContent } from "@/lib/server-data";

export const runtime = "nodejs";
export const maxDuration = 45;

export const POST = apiHandler(async (request: Request) => {
  const user = await requireApiUser();
  const body = summaryGenerateSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, body.resumeId);
  const resolved = await resolveResumeContent(resume, body.versionId);
  const { jd } = await resolveJd({ userId: user.id, jobId: body.jobId, jdText: body.jdText });
  const result = await generateSummaries(resolved.data, jd);
  return json(result);
});
