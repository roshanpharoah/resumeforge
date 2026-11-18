import { NextResponse } from "next/server";
import { HttpError, apiHandler, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { exportSchema } from "@/lib/requests";
import { buildFactCheck } from "@/lib/ai";
import { collectUserProvidedAnswers } from "@/lib/fact-check";
import { renderResumeDocx, renderResumePdf, renderResumeTxt } from "@/lib/export";
import { getOwnedResume, resolveResumeContent } from "@/lib/server-data";
import { slugifyFileName } from "@/lib/utils";
import type { ResumeData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = exportSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, params.id);
  const resolved = await resolveResumeContent(resume, body.versionId);
  const data = body.data ?? resolved.data;
  const design = body.design ?? resolved.design;
  const base = body.versionId ? (resume.parsed as unknown as ResumeData) : null;

  const factCheck = await buildFactCheck(data, base, resume.rawText, {
    answers: collectUserProvidedAnswers(data),
    confirmations: body.confirmations,
    checkIdentity: Boolean(base),
  });
  if (factCheck.blocking > 0) {
    throw new HttpError(422, `Export blocked: ${factCheck.blocking} claim${factCheck.blocking === 1 ? "" : "s"} could not be verified.`, {
      factCheck,
    });
  }

  const stem = slugifyFileName(`${data.contact.fullName || resume.title}-${body.versionId ? "tailored" : "resume"}`);
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${stem}.${body.format}"`,
  };

  if (body.format === "txt") {
    const buffer = renderResumeTxt(data);
    return new NextResponse(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (body.format === "docx") {
    const buffer = await renderResumeDocx(data, design);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    });
  }

  try {
    const buffer = await renderResumePdf(data, design);
    return new NextResponse(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": "application/pdf" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF rendering failed.";
    throw new HttpError(503, message, {
      code: "PDF_ENGINE_UNAVAILABLE",
      hint: "Install Chrome for Puppeteer, or set PUPPETEER_EXECUTABLE_PATH. DOCX and TXT export still work.",
    });
  } finally {
    if (body.versionId) {
      await db().resumeVersion.update({ where: { id: body.versionId }, data: { factCheck: factCheck as unknown as object } }).catch(() => undefined);
    }
  }
});
