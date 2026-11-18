import { randomBytes } from "crypto";
import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { shareSchema } from "@/lib/requests";
import { buildFactCheck } from "@/lib/ai";
import { collectUserProvidedAnswers } from "@/lib/fact-check";
import { getOwnedResume, resolveResumeContent } from "@/lib/server-data";
import type { ResumeData } from "@/lib/types";
import type { CreateShareResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  await getOwnedResume(user.id, params.id);
  const links = await db().shareLink.findMany({
    where: { resumeId: params.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return json({
    links: links.map((link) => ({
      id: link.id,
      token: link.token,
      url: `${process.env.APP_URL?.replace(/\/+$/, "") || "http://localhost:3000"}/r/${link.token}`,
      versionId: link.resumeVersionId,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString(),
    })),
  });
});

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = shareSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, params.id);
  const resolved = await resolveResumeContent(resume, body.versionId);
  const base = body.versionId ? (resume.parsed as unknown as ResumeData) : null;
  const factCheck = await buildFactCheck(resolved.data, base, resume.rawText, {
    answers: collectUserProvidedAnswers(resolved.data),
    confirmations: body.confirmations,
    checkIdentity: Boolean(base),
  });
  if (factCheck.blocking > 0) {
    throw new HttpError(422, `Sharing blocked: ${factCheck.blocking} unsupported claim${factCheck.blocking === 1 ? "" : "s"} must be resolved first.`, {
      factCheck,
    });
  }

  const token = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000);
  await db().shareLink.create({
    data: {
      token,
      resumeId: resume.id,
      resumeVersionId: body.versionId ?? null,
      expiresAt,
    },
  });

  const baseUrl = process.env.APP_URL?.replace(/\/+$/, "") || new URL(request.url).origin;
  const url = `${baseUrl}/r/${token}`;
  const qrcode = await import("qrcode");
  const qrDataUrl = await qrcode.toDataURL(url, {
    width: 420,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const payload: CreateShareResponse = { token, url, qrDataUrl, expiresAt: expiresAt.toISOString() };
  return json(payload, { status: 201 });
});
