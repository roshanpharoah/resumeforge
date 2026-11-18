import { Prisma } from "@prisma/client";
import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { updateResumeSchema } from "@/lib/requests";
import { applyTemplate } from "@/lib/templates";
import {
  getOwnedResume,
  serializeResumeDetail,
  setPrimaryResume,
} from "@/lib/server-data";
import type { UpdateResumeResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const row = await getOwnedResume(user.id, params.id);
  return json({ resume: serializeResumeDetail(row) });
});

export const PATCH = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const existing = await getOwnedResume(user.id, params.id);
  const body = updateResumeSchema.parse(await request.json());

  const data: Prisma.ResumeUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.data !== undefined) data.parsed = body.data as unknown as Prisma.InputJsonValue;
  let derivedDesignSource: "upload" | "template" | undefined;
  if (body.design !== undefined) {
    const design = body.templateId ? applyTemplate(body.design, body.templateId) : body.design;
    data.design = design as unknown as Prisma.InputJsonValue;
    data.templateId = design.templateId;
    derivedDesignSource = design.templateId === "uploaded" ? "upload" : "template";
  } else if (body.templateId !== undefined) {
    const currentDesign = existing.design as unknown as Parameters<typeof applyTemplate>[0];
    const design = applyTemplate(currentDesign, body.templateId);
    data.design = design as unknown as Prisma.InputJsonValue;
    data.templateId = design.templateId;
    derivedDesignSource = design.templateId === "uploaded" ? "upload" : "template";
  }
  if (body.designSource !== undefined) data.designSource = body.designSource;
  else if (derivedDesignSource) data.designSource = derivedDesignSource;
  if (body.isPrimary) data.isPrimary = true;
  if (Object.keys(data).length === 0) throw new HttpError(400, "No changes were provided.");

  await db().resume.update({ where: { id: existing.id }, data });
  if (body.isPrimary) await setPrimaryResume(user.id, existing.id);

  const row = await getOwnedResume(user.id, existing.id);
  const payload: UpdateResumeResponse = { resume: serializeResumeDetail(row) };
  return json(payload);
});

export const DELETE = apiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const existing = await getOwnedResume(user.id, params.id);
  if (existing.originalFileKey) await deleteFile(existing.originalFileKey).catch(() => undefined);
  await db().resume.delete({ where: { id: existing.id } });
  if (existing.isPrimary) {
    const next = await db().resume.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
    if (next) await db().resume.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  return json({ ok: true });
});
