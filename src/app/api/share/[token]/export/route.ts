import { NextResponse } from "next/server";
import { HttpError, apiHandler } from "@/lib/api";
import { db } from "@/lib/db";
import { buildFactCheck } from "@/lib/ai";
import { collectUserProvidedAnswers } from "@/lib/fact-check";
import { renderResumeDocx, renderResumePdf, renderResumeTxt } from "@/lib/export";
import { toDesign, toResumeData } from "@/lib/serializers";
import { slugifyFileName } from "@/lib/utils";
import type { ResumeData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

export const GET = apiHandler(async (request: Request, { params }: { params: { token: string } }) => {
  const format = new URL(request.url).searchParams.get("format") ?? "pdf";
  if (!["pdf", "docx", "txt"].includes(format)) throw new HttpError(400, "Unsupported format.");
  const link = await db().shareLink.findUnique({
    where: { token: params.token },
    include: { resume: true, version: true },
  });
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt.getTime() < Date.now())) {
    throw new HttpError(404, "This share link is no longer available.");
  }

  const data = toResumeData(link.version ? link.version.data : link.resume.parsed);
  const design = toDesign(link.version ? link.version.design : link.resume.design);
  const base = link.version ? (link.resume.parsed as unknown as ResumeData) : null;
  const factCheck = await buildFactCheck(data, base, link.resume.rawText, {
    answers: collectUserProvidedAnswers(data),
    checkIdentity: Boolean(base),
  });
  if (factCheck.blocking > 0) throw new HttpError(422, "This resume has unresolved claims. The owner needs to fix them before it can be downloaded.");

  const stem = slugifyFileName(`${data.contact.fullName || "resume"}`);
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${stem}.${format}"`,
  };

  if (format === "txt") {
    return new NextResponse(new Uint8Array(renderResumeTxt(data)), { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (format === "docx") {
    const buffer = await renderResumeDocx(data, design);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    });
  }
  try {
    const buffer = await renderResumePdf(data, design);
    return new NextResponse(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": "application/pdf" } });
  } catch (error) {
    throw new HttpError(503, error instanceof Error ? error.message : "PDF rendering is unavailable.");
  }
});
