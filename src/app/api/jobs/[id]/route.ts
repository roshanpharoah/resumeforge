import { Prisma } from "@prisma/client";
import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { updateJobSchema } from "@/lib/requests";
import { extractJd } from "@/lib/keywords";
import { getOwnedJob, serializeJobDetail } from "@/lib/server-data";
import type { UpdateJobResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const job = await getOwnedJob(user.id, params.id);
  return json({ job: serializeJobDetail(job) });
});

export const PATCH = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const existing = await getOwnedJob(user.id, params.id);
  const body = updateJobSchema.parse(await request.json());
  const data: Prisma.JobUpdateInput = {};

  if (body.company !== undefined) data.company = body.company;
  if (body.title !== undefined) data.title = body.title;
  if (body.jdText !== undefined) {
    data.jdText = body.jdText;
    const extracted = extractJd(body.jdText, body.title ?? existing.title, body.company ?? existing.company);
    data.extracted = extracted as unknown as Prisma.InputJsonValue;
    data.matchScore = null;
  }
  if (body.url !== undefined) data.url = body.url || null;
  if (body.location !== undefined) data.location = body.location || null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.salaryMin !== undefined) data.salaryMin = body.salaryMin;
  if (body.salaryMax !== undefined) data.salaryMax = body.salaryMax;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.status !== undefined) {
    data.status = body.status;
    data.statusUpdatedAt = new Date();
    if (body.status === "APPLIED" && !existing.appliedAt) data.appliedAt = new Date();
  }
  if (Object.keys(data).length === 0) throw new HttpError(400, "No changes were provided.");

  await db().job.update({ where: { id: existing.id }, data });
  const job = await getOwnedJob(user.id, existing.id);
  const payload: UpdateJobResponse = { job: serializeJobDetail(job) };
  return json(payload);
});

export const DELETE = apiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const existing = await getOwnedJob(user.id, params.id);
  await db().job.delete({ where: { id: existing.id } });
  return json({ ok: true });
});
