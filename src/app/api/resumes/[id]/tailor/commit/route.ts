import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { commitTailorSchema } from "@/lib/requests";
import { applyTailorChanges } from "@/lib/tailor";
import { buildFactCheck } from "@/lib/ai";
import { collectUserProvidedAnswers } from "@/lib/fact-check";
import { analyzeResume } from "@/lib/scoring";
import { createVersion, getOwnedJob, getOwnedResume, resolveJd, serializeVersion } from "@/lib/server-data";
import type { ResumeData } from "@/lib/types";
import { resumeToPlainText } from "@/lib/types";
import type { CommitTailorResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = commitTailorSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, params.id);
  const base = resume.parsed as unknown as ResumeData;
  if (body.jobId) await getOwnedJob(user.id, body.jobId);

  const accepted = new Set(body.acceptedChangeIds);
  const changes = body.changes.filter((change) => accepted.has(change.id));
  if (!changes.length) throw new HttpError(400, "Select at least one change to save a tailored version.");
  const data = applyTailorChanges(base, changes);

  const factCheck = await buildFactCheck(data, base, resume.rawText, {
    answers: collectUserProvidedAnswers(data),
    confirmations: body.confirmations,
    checkIdentity: true,
  });
  const { jd } = await resolveJd({ userId: user.id, jobId: body.jobId });
  const score = analyzeResume({ resume: data, jd, rawText: resumeToPlainText(data) }).score;

  const version = await createVersion({
    resumeId: resume.id,
    jobId: body.jobId ?? null,
    label: body.label,
    data,
    design: resume.design as unknown as Parameters<typeof createVersion>[0]["design"],
    source: "TAILORED",
    matchScore: score,
    factCheck,
  });
  if (body.jobId) await db().job.update({ where: { id: body.jobId }, data: { matchScore: score } });

  const payload: CommitTailorResponse = { version: serializeVersion(version), factCheck, score };
  return json(payload, { status: 201 });
});
