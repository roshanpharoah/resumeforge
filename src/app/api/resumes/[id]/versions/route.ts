import { apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { createVersionSchema } from "@/lib/requests";
import { buildFactCheck } from "@/lib/ai";
import { collectUserProvidedAnswers } from "@/lib/fact-check";
import { analyzeResume } from "@/lib/scoring";
import { resumeToPlainText } from "@/lib/types";
import {
  createVersion,
  getOwnedResume,
  resolveJd,
  serializeVersion,
  versionInclude,
} from "@/lib/server-data";
import type { CreateVersionResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  await getOwnedResume(user.id, params.id);
  const versions = await db().resumeVersion.findMany({
    where: { resumeId: params.id },
    orderBy: { createdAt: "desc" },
    include: versionInclude,
  });
  return json({ versions: versions.map(serializeVersion) });
});

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = createVersionSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, params.id);
  if (body.jobId) await resolveJd({ userId: user.id, jobId: body.jobId });
  const design = body.design ?? (resume.design as unknown as CreateVersionResponse["version"]["design"]);
  const base = resume.parsed as unknown as typeof body.data;

  const factCheck = await buildFactCheck(body.data, body.source === "TAILORED" ? base : null, resume.rawText, {
    answers: collectUserProvidedAnswers(body.data),
    confirmations: body.confirmations,
    checkIdentity: body.source === "TAILORED",
  });
  const { jd } = await resolveJd({ userId: user.id, jobId: body.jobId });
  const score =
    body.matchScore ?? analyzeResume({ resume: body.data, jd, rawText: resumeToPlainText(body.data) }).score;

  const version = await createVersion({
    resumeId: resume.id,
    jobId: body.jobId ?? null,
    label: body.label,
    data: body.data,
    design,
    source: body.source,
    matchScore: score,
    factCheck,
  });

  const payload: CreateVersionResponse = { version: serializeVersion(version), factCheck };
  return json(payload, { status: 201 });
});
