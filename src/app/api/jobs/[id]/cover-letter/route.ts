import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { coverLetterSchema } from "@/lib/requests";
import { generateCoverLetter } from "@/lib/ai";
import { extractJd } from "@/lib/keywords";
import { getOwnedJob, getOwnedResume } from "@/lib/server-data";
import type { ExtractedJd, ResumeData } from "@/lib/types";
import type { CoverLetterResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = coverLetterSchema.parse(await request.json());
  if (body.jobId && body.jobId !== params.id) throw new HttpError(400, "Job id mismatch.");
  const job = await getOwnedJob(user.id, params.id);

  let data: ResumeData;
  let versionId: string | null = body.resumeVersionId ?? null;
  if (body.resumeVersionId) {
    const version = await db().resumeVersion.findFirst({
      where: { id: body.resumeVersionId, resume: { userId: user.id } },
    });
    if (!version) throw new HttpError(404, "Resume version not found.");
    data = version.data as unknown as ResumeData;
  } else {
    const found = body.resumeId
      ? await getOwnedResume(user.id, body.resumeId)
      : await db().resume.findFirst({ where: { userId: user.id }, orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }] });
    if (!found) throw new HttpError(400, "Add a resume before generating a cover letter.");
    data = found.parsed as unknown as ResumeData;
    versionId = null;
  }

  const jd = (job.extracted as ExtractedJd | null) ?? extractJd(job.jdText, job.title, job.company);
  const result = await generateCoverLetter(data, jd, job.jdText, {
    hiringManager: body.hiringManager,
    tone: body.tone,
    useLlm: body.useLlm,
  });

  const saved = await db().coverLetter.create({
    data: {
      userId: user.id,
      jobId: job.id,
      resumeVersionId: versionId,
      content: result.content,
      tone: body.tone,
    },
  });

  const payload: CoverLetterResponse = {
    coverLetter: {
      id: saved.id,
      role: result.role,
      company: result.company,
      greeting: result.greeting,
      content: result.content,
      wordCount: result.wordCount,
      factCheck: result.factCheck,
      generatedBy: result.generatedBy,
    },
  };
  return json(payload, { status: 201 });
});
