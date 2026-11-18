import { Prisma } from "@prisma/client";
import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { interviewPrepSchema } from "@/lib/requests";
import { generateInterview } from "@/lib/ai";
import { analyzeKeywords, extractJd } from "@/lib/keywords";
import { getOwnedJob, getOwnedResume } from "@/lib/server-data";
import { resumeToPlainText, type ExtractedJd, type ResumeData } from "@/lib/types";
import type { InterviewPrepResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = interviewPrepSchema.parse(await request.json());
  if (body.jobId && body.jobId !== params.id) throw new HttpError(400, "Job id mismatch.");
  const job = await getOwnedJob(user.id, params.id);

  let data: ResumeData;
  if (body.resumeVersionId) {
    const version = await db().resumeVersion.findFirst({
      where: { id: body.resumeVersionId, resume: { userId: user.id } },
    });
    if (!version) throw new HttpError(404, "Resume version not found.");
    data = version.data as unknown as ResumeData;
  } else {
    const resume = body.resumeId
      ? await getOwnedResume(user.id, body.resumeId)
      : await db().resume.findFirst({ where: { userId: user.id }, orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }] });
    if (!resume) throw new HttpError(400, "Add a resume before interview prep.");
    data = resume.parsed as unknown as ResumeData;
  }

  const jd = (job.extracted as ExtractedJd | null) ?? extractJd(job.jdText, job.title, job.company);
  const missing = analyzeKeywords(jd, resumeToPlainText(data))
    .missing.filter((k) => k.importance === "must")
    .map((k) => k.keyword);
  const result = await generateInterview(data, jd, missing, body.useLlm);

  await db().interviewPrep.upsert({
    where: { jobId: job.id },
    update: { questions: result.questions as unknown as Prisma.InputJsonValue },
    create: { jobId: job.id, questions: result.questions as unknown as Prisma.InputJsonValue },
  });

  const payload: InterviewPrepResponse = { interview: { questions: result.questions, generatedBy: result.generatedBy } };
  return json(payload);
});
