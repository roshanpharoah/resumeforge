import { Prisma } from "@prisma/client";
import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { createResumeSchema } from "@/lib/requests";
import { parseResumeHeuristic } from "@/lib/parse-heuristic";
import { applyTemplate } from "@/lib/templates";
import { defaultDesign, resumeToPlainText } from "@/lib/types";
import { createVersion, getOwnedResume, listResumes, serializeResumeDetail } from "@/lib/server-data";
import type { CreateResumeResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const user = await requireApiUser();
  return json({ resumes: await listResumes(user.id) });
});

export const POST = apiHandler(async (request: Request) => {
  const user = await requireApiUser();
  const body = createResumeSchema.parse(await request.json());
  const parsed = body.data ?? (body.rawText?.trim() ? parseResumeHeuristic(body.rawText, body.originalFileName).data : null);
  if (!parsed) throw new HttpError(400, "Add resume content before saving.");

  if (body.originalFileKey && !body.originalFileKey.startsWith(`${user.id}/`)) {
    throw new HttpError(400, "That uploaded file does not belong to your account.");
  }

  const design = body.design ?? (body.templateId ? applyTemplate(defaultDesign, body.templateId) : defaultDesign);
  const templateId = body.templateId ?? design.templateId;
  const prisma = db();
  const existing = await prisma.resume.count({ where: { userId: user.id } });

  const created = await prisma.resume.create({
    data: {
      userId: user.id,
      title: body.title,
      isPrimary: existing === 0,
      rawText: body.rawText?.trim() || resumeToPlainText(parsed),
      parsed: parsed as unknown as Prisma.InputJsonValue,
      design: design as unknown as Prisma.InputJsonValue,
      templateId,
      designSource: body.designSource ?? (body.originalFileKey ? "upload" : "template"),
      parseRisks: (body.parseRisks ?? []) as unknown as Prisma.InputJsonValue,
      originalFileKey: body.originalFileKey ?? null,
      originalFileName: body.originalFileName ?? null,
      originalFileType: body.originalFileType ?? null,
    },
  });

  await createVersion({
    resumeId: created.id,
    label: body.originalFileKey ? "Original upload" : "First draft",
    data: parsed,
    design,
    source: body.originalFileKey ? "UPLOAD" : "BASE",
  });

  const resume = await getOwnedResume(user.id, created.id);
  const payload: CreateResumeResponse = { resume: serializeResumeDetail(resume) };
  return json(payload, { status: 201 });
});
