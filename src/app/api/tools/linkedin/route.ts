import { apiHandler, json, requireApiUser } from "@/lib/api";
import { linkedinSchema } from "@/lib/requests";
import { generateLinkedIn } from "@/lib/ai";
import { extractJd } from "@/lib/keywords";
import { getOwnedJob, getOwnedResume, resolveResumeContent } from "@/lib/server-data";
import type { ExtractedJd } from "@/lib/types";
import type { LinkedInResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 45;

export const POST = apiHandler(async (request: Request) => {
  const user = await requireApiUser();
  const body = linkedinSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, body.resumeId);
  const resolved = await resolveResumeContent(resume, body.versionId);
  const job = await getOwnedJob(user.id, body.jobId);
  const jd = (job.extracted as ExtractedJd | null) ?? extractJd(job.jdText, job.title, job.company);
  const linkedin = await generateLinkedIn(resolved.data, jd, body.useLlm);
  const payload: LinkedInResponse = { linkedin };
  return json(payload);
});
