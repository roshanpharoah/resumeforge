import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { HttpError, apiHandler, json, rateLimit, requireApiUser } from "@/lib/api";
import { extractDocument, detectFileType } from "@/lib/parse-file";
import { parseResumeHeuristic } from "@/lib/parse-heuristic";
import { parseWithAi } from "@/lib/ai";
import { putFile } from "@/lib/storage";
import { env } from "@/lib/env";
import { defaultDesign } from "@/lib/types";
import type { ParseUploadResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireApiUser();
  rateLimit(`parse:${user.id}`, 15, 10 * 60 * 1000);
  const form = await request.formData().catch(() => null);
  if (!form) throw new HttpError(400, "Send the file as multipart form data.");
  const file = form.get("file");
  const pasted = form.get("text");
  const useFile = file instanceof File && file.size > 0;

  if (!useFile && !(typeof pasted === "string" && pasted.trim().length >= 30)) {
    throw new HttpError(400, "Choose a PDF, DOCX or TXT file, or paste your resume text.");
  }

  let rawText = "";
  let fileName = "Pasted resume";
  let fileType: ParseUploadResponse["fileType"] = "txt";
  let pageCount = 1;
  let design = defaultDesign;
  let risks = [] as ParseUploadResponse["parseRisks"];
  let detection: ParseUploadResponse["detection"] = {
    fonts: [],
    hasImages: false,
    hasTables: false,
    hasColumns: false,
    hasTextboxes: false,
    hasHeaderFooter: false,
  };
  let fileKey: string | undefined;

  if (useFile) {
    const activeFile = file as File;
    const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
    if (activeFile.size > maxBytes) throw new HttpError(413, `File is larger than the ${env().MAX_UPLOAD_MB} MB limit.`);
    const buffer = Buffer.from(await activeFile.arrayBuffer());
    fileName = activeFile.name;
    fileType = detectFileType(activeFile.name, activeFile.type);
    const extraction = await extractDocument(buffer, activeFile.name, activeFile.type);
    if (!extraction.rawText.trim()) throw new HttpError(422, "No selectable text was found in that file. If it is a scanned PDF, export a text based version first.");
    rawText = extraction.rawText;
    pageCount = extraction.pageCount;
    design = extraction.design;
    risks = extraction.risks;
    detection = {
      fonts: extraction.meta.fonts,
      hasImages: extraction.meta.hasImages,
      hasTables: extraction.meta.hasTables,
      hasColumns: extraction.meta.hasColumns,
      hasTextboxes: extraction.meta.hasTextboxes,
      hasHeaderFooter: extraction.meta.hasHeaderFooter,
    };
    const extension = fileType === "docx" ? "docx" : fileType === "pdf" ? "pdf" : "txt";
    fileKey = `${user.id}/${randomUUID()}.${extension}`;
    await putFile(fileKey, buffer, activeFile.type || "application/octet-stream");
  } else {
    rawText = (pasted as string).replace(/\r\n?/g, "\n").trim();
    const heuristic = parseResumeHeuristic(rawText, "resume.txt");
    design = {
      ...design,
      templateId: "uploaded",
      detected: {
        fonts: [],
        sizes: [],
        margins: 48,
        sectionOrder: heuristic.sectionOrder,
        colors: [],
        columns: 1,
        confidence: 0.2,
      },
    };
    pageCount = Math.max(1, Math.ceil(rawText.split(/\s+/).length / 500));
  }

  const heuristic = parseResumeHeuristic(rawText, fileName);
  const ai = await parseWithAi(rawText, fileName, heuristic.data);

  const warnings = [...ai.warnings];
  if (risks.some((r) => r.severity === "critical")) {
    warnings.push("At least one critical parse risk was detected. Review the ATS view before exporting.");
  }

  const payload: ParseUploadResponse = {
    rawText,
    data: ai.data,
    design,
    parseRisks: risks,
    designSource: useFile && design.detected ? "upload" : "template",
    fileName,
    fileType,
    pageCount,
    warnings,
    llmUsed: ai.llmUsed,
    detection,
  };
  return json({ ...payload, fileKey });
});
