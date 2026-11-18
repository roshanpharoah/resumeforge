import type { DesignTokens, ParseRisk } from "@/lib/types";
import { defaultDesign } from "@/lib/types";
import { parseResumeHeuristic } from "@/lib/parse-heuristic";

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type ResumeFileType = "pdf" | "docx" | "txt";

export interface DocumentExtraction {
  rawText: string;
  fileType: ResumeFileType;
  pageCount: number;
  risks: ParseRisk[];
  design: DesignTokens;
  meta: {
    title?: string;
    author?: string;
    producer?: string;
    fonts: string[];
    hasImages: boolean;
    hasTables: boolean;
    hasColumns: boolean;
    hasTextboxes: boolean;
    hasHeaderFooter: boolean;
    colors: string[];
  };
}

export class DocumentParseError extends Error {
  code: "UNSUPPORTED" | "EMPTY" | "TOO_LARGE" | "CORRUPT";
  constructor(message: string, code: DocumentParseError["code"]) {
    super(message);
    this.name = "DocumentParseError";
    this.code = code;
  }
}

const SAFE_FONTS = new Set([
  "arial",
  "helvetica",
  "helvetica neue",
  "times",
  "times new roman",
  "georgia",
  "garamond",
  "calibri",
  "cambria",
  "inter",
  "lato",
  "source sans 3",
  "source sans pro",
  "roboto",
  "open sans",
  "merriweather",
  "minion",
  "carlito",
  "liberation sans",
  "liberation serif",
  "dejavu sans",
  "dejavu serif",
  "noto sans",
  "segoe ui",
  "verdana",
  "tahoma",
  "trebuchet",
  "courier",
  "courier new",
  "consolas",
]);

const MONTHS = /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i;

function cleanFontName(raw: string): string {
  return raw
    .replace(/^\/?[A-Z]{6}\+/, "")
    .replace(/^(?:[A-Z]{1,3}\+)?/, "")
    .replace(/#\d+$/, "")
    .replace(/[,_]/g, " ")
    .replace(/\s+(?:bold|italic|oblique|regular|roman|mt|ps|std|pro|new)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapFont(raw: string): string {
  const clean = cleanFontName(raw);
  const lower = clean.toLowerCase();
  const map: [RegExp, string][] = [
    [/arial/, "Arial"],
    [/helvetica/, "Helvetica"],
    [/times/, "Times New Roman"],
    [/georgia/, "Georgia"],
    [/garamond/, "Garamond"],
    [/calibri/, "Calibri"],
    [/cambria/, "Cambria"],
    [/inter/, "Inter"],
    [/lato/, "Lato"],
    [/source ?sans/, "Source Sans 3"],
    [/roboto/, "Arial"],
    [/open ?sans/, "Arial"],
    [/merriweather|minion|caslon|baskerville/, "Georgia"],
    [/segoe/, "Arial"],
    [/verdana|tahoma|trebuchet/, "Arial"],
    [/courier|consolas|mono/, "Times New Roman"],
  ];
  for (const [rx, mapped] of map) if (rx.test(lower)) return mapped;
  return clean || "Arial";
}

function isSafeFont(font: string): boolean {
  return SAFE_FONTS.has(cleanFontName(font).toLowerCase());
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}

interface PdfLine {
  page: number;
  text: string;
  y: number;
  x: number;
  gaps: number[];
  fontSizes: number[];
  fonts: string[];
}

interface PdfLayout {
  lines: PdfLine[];
  pageWidth: number;
  pageHeight: number;
  pageCount: number;
  fonts: string[];
  fontSizes: number[];
  hasImages: boolean;
  imageCount: number;
  colors: string[];
  metadata: { title?: string; author?: string; producer?: string };
}

async function extractPdf(buffer: Buffer): Promise<{ rawText: string; layout: PdfLayout; pageCount: number }> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as unknown as { default: (data: Buffer, options?: Record<string, unknown>) => Promise<{ text: string; numpages: number; info?: Record<string, unknown> }> }).default;

  const lines: PdfLine[] = [];
  const fonts = new Set<string>();
  const fontSizes: number[] = [];
  let pageCounter = 0;
  let pageWidth = 612;
  let pageHeight = 792;
  let hasImages = false;
  let imageCount = 0;
  let colors: string[] = [];

  const rawLatin = buffer.toString("latin1");
  if (/\/Subtype\s*\/Image/.test(rawLatin)) hasImages = true;
  imageCount = (rawLatin.match(/\/Subtype\s*\/Image/g) ?? []).length;
  for (const m of rawLatin.matchAll(/\/BaseFont\s*\/([^\s/<>[\]()]+)/g)) fonts.add(m[1]);
  colors = extractPdfColors(rawLatin).slice(0, 12);

  const renderPage = async (pageData: {
    getTextContent: (options?: Record<string, unknown>) => Promise<{ items: PdfTextItem[] }>;
    view?: number[];
    rotate?: number;
    pageNumber?: number;
  }): Promise<string> => {
    pageCounter += 1;
    const page = pageCounter;
    const view = pageData.view ?? [0, 0, 612, 792];
    pageWidth = Math.max(pageWidth, Math.abs(view[2] - view[0]) || 612);
    pageHeight = Math.max(pageHeight, Math.abs(view[3] - view[1]) || 792);
    let content: { items: PdfTextItem[] };
    try {
      content = await pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
    } catch {
      return "";
    }
    const items = (content.items ?? []).filter((i) => typeof i.str === "string" && i.str.trim().length > 0);
    if (!items.length) return "";

    const groups = new Map<number, PdfTextItem[]>();
    for (const item of items) {
      const y = Math.round((item.transform?.[5] ?? 0) / 3) * 3;
      const arr = groups.get(y) ?? [];
      arr.push(item);
      groups.set(y, arr);
    }
    const pageLines: PdfLine[] = [];
    for (const [y, group] of groups) {
      group.sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0));
      let text = "";
      let previousEnd: number | null = null;
      const gaps: number[] = [];
      const lineFonts = new Set<string>();
      const lineSizes: number[] = [];
      for (const item of group) {
        const x = item.transform?.[4] ?? 0;
        const size = Math.abs(item.transform?.[3] ?? item.height ?? 10);
        if (previousEnd !== null) {
          const gap = x - previousEnd;
          if (gap > Math.max(2.5, size * 0.22)) {
            text += " ";
            if (gap > pageWidth * 0.045) gaps.push(gap);
          }
        }
        text += item.str;
        previousEnd = x + (item.width || 0);
        lineSizes.push(size);
        fontSizes.push(size);
        if (item.fontName) lineFonts.add(item.fontName);
      }
      const clean = text.replace(/\s+/g, " ").trim();
      if (!clean) continue;
      pageLines.push({
        page,
        text: clean,
        y,
        x: group[0]?.transform?.[4] ?? 0,
        gaps,
        fontSizes: lineSizes,
        fonts: [...lineFonts],
      });
    }
    pageLines.sort((a, b) => b.y - a.y);
    lines.push(...pageLines);
    return pageLines.map((l) => l.text).join("\n");
  };

  let parsed: { text: string; numpages: number; info?: Record<string, unknown> };
  try {
    parsed = await pdfParse(buffer, { max: 0, pagerender: renderPage });
  } catch (error) {
    throw new DocumentParseError(`The PDF could not be read. ${error instanceof Error ? error.message : ""}`.trim(), "CORRUPT");
  }
  const rawText = (parsed.text || lines.map((l) => l.text).join("\n")).replace(/\n{3,}/g, "\n\n").trim();
  if (!rawText && !lines.length) {
    throw new DocumentParseError("No selectable text was found. This looks like a scanned or image-only PDF. Upload a text-based PDF or DOCX.", "EMPTY");
  }

  const info = parsed.info ?? {};
  return {
    rawText,
    pageCount: parsed.numpages || pageCounter || 1,
    layout: {
      lines,
      pageWidth,
      pageHeight,
      pageCount: parsed.numpages || pageCounter || 1,
      fonts: [...fonts].map(mapFont),
      fontSizes,
      hasImages,
      imageCount,
      colors,
      metadata: {
        title: typeof info.Title === "string" ? info.Title : undefined,
        author: typeof info.Author === "string" ? info.Author : undefined,
        producer: typeof info.Producer === "string" ? info.Producer : undefined,
      },
    },
  };
}

function extractPdfColors(raw: string): string[] {
  const counts = new Map<string, number>();
  const rx = /([01](?:\.\d+)?)\s+([01](?:\.\d+)?)\s+([01](?:\.\d+)?)\s+(rg|RG)\b/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(raw))) {
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (r > 0.92 && g > 0.92 && b > 0.92) continue;
    if (r < 0.18 && g < 0.18 && b < 0.18) continue;
    const hex = `#${[r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const gray = /([01](?:\.\d+)?)\s+(g|G)\b/g;
  while ((m = gray.exec(raw))) {
    const v = Number(m[1]);
    if (v > 0.9 || v < 0.2) continue;
    const hex = `#${Math.round(v * 255).toString(16).padStart(2, "0").repeat(3)}`;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}

function detectPdfRisks(layout: PdfLayout, rawText: string): ParseRisk[] {
  const risks: ParseRisk[] = [];
  const { lines, pageWidth } = layout;

  const imageOnly = layout.hasImages && rawText.replace(/\s/g, "").length < 80;
  if (imageOnly) {
    risks.push({
      id: "pdf-image-only",
      label: "Scanned or image-only PDF",
      severity: "critical",
      detail: "The page contains images instead of selectable text. An ATS will receive an empty document.",
      detectedIn: "pdf",
      evidence: `${layout.imageCount} embedded images`,
    });
  } else if (layout.hasImages) {
    risks.push({
      id: "pdf-images",
      label: "Embedded images detected",
      severity: layout.imageCount > 3 ? "warning" : "info",
      detail: "Images are ignored by most ATS parsers. Move important information, especially contact details and skills, into plain text.",
      detectedIn: "pdf",
      evidence: `${layout.imageCount} images`,
    });
  }

  const wideGapLines = lines.filter((line) => line.gaps.filter((gap) => gap > pageWidth * 0.16).length >= 1);
  if (wideGapLines.length >= 3) {
    const rightSided = wideGapLines.filter((line) => line.x > pageWidth * 0.3).length;
    if (rightSided >= 2 || wideGapLines.length >= 6) {
      risks.push({
        id: "pdf-columns",
        label: "Multiple columns detected",
        severity: "warning",
        detail: "Text appears in two or more columns. ATS extraction often reads across columns, merging unrelated lines.",
        detectedIn: "pdf",
        evidence: `${wideGapLines.length} lines with wide gaps`,
      });
    }
  }

  const tableRows = lines.filter((line) => line.gaps.filter((gap) => gap > pageWidth * 0.08).length >= 2);
  if (tableRows.length >= 3) {
    risks.push({
      id: "pdf-table",
      label: "Table-like layout detected",
      severity: "warning",
      detail: "Aligned rows with multiple columns often come from tables. Some parsers drop table cells or read them out of order.",
      detectedIn: "pdf",
      evidence: `${tableRows.length} rows with 3 or more columns`,
    });
  }

  const leftMargins = lines.map((l) => l.x).filter((x) => x > 0);
  const minLeft = leftMargins.length ? Math.min(...leftMargins.slice(0, 50)) : 0;
  const floating = lines.filter((line) => line.x > minLeft + pageWidth * 0.28 && line.text.length < 70);
  if (floating.length >= 3) {
    risks.push({
      id: "pdf-textbox",
      label: "Floating text or text boxes",
      severity: "warning",
      detail: "Short blocks sit far from the main left margin. Text boxes are a common cause of missing sections in ATS imports.",
      detectedIn: "pdf",
      evidence: `${floating.length} isolated blocks`,
    });
  }

  const pageCount = layout.pageCount;
  if (pageCount > 1) {
    const repeatedTop = new Map<string, number>();
    const repeatedBottom = new Map<string, number>();
    for (const line of lines) {
      const normalized = line.text.toLowerCase().replace(/\d+/g, "#").trim();
      if (normalized.length < 3 || normalized.length > 80) continue;
      if (line.y > layout.pageHeight * 0.9) repeatedTop.set(normalized, (repeatedTop.get(normalized) ?? 0) + 1);
      if (line.y < layout.pageHeight * 0.1) repeatedBottom.set(normalized, (repeatedBottom.get(normalized) ?? 0) + 1);
    }
    const repeated = [...repeatedTop.entries(), ...repeatedBottom.entries()].filter(([, count]) => count >= Math.max(2, pageCount - 1));
    if (repeated.length) {
      risks.push({
        id: "pdf-header-footer",
        label: "Headers or footers detected",
        severity: "warning",
        detail: "Repeated text at the top or bottom of pages is often ignored by ATS parsers. Keep contact details and important content in the body.",
        detectedIn: "pdf",
        evidence: repeated.slice(0, 3).map(([text]) => text).join(", "),
      });
    }
  }

  const uniqueFonts = [...new Set(layout.fonts)];
  const unusual = uniqueFonts.filter((f) => !isSafeFont(f));
  if (unusual.length) {
    risks.push({
      id: "pdf-fonts",
      label: "Unusual fonts detected",
      severity: "info",
      detail: "Decorative fonts may substitute on another machine and shift your layout. Standard fonts are safer.",
      detectedIn: "pdf",
      evidence: unusual.slice(0, 4).join(", "),
    });
  }

  if (/[▁▂▃▄▅▆▇█▉▊▋▌▍▎▏■□●○◆◇★☆⬤◉◍]/.test(rawText)) {
    risks.push({
      id: "pdf-skill-bars",
      label: "Graphic skill bars or rating icons",
      severity: "warning",
      detail: "Bar and dot ratings are invisible to ATS keyword extraction. Write skill names as plain text.",
      detectedIn: "pdf",
      evidence: "Block or rating glyphs",
    });
  }

  const symbolCount = (rawText.match(/[\uE000-\uF8FF\u2700-\u27BF\u2B00-\u2BFF]/g) ?? []).length;
  if (symbolCount > 2) {
    risks.push({
      id: "pdf-icons",
      label: "Icon fonts may hide labels",
      severity: "info",
      detail: "Icon glyphs often replace words such as email or phone. Keep a text label next to each icon.",
      detectedIn: "pdf",
      evidence: `${symbolCount} symbol glyphs`,
    });
  }

  return risks;
}

function designFromPdf(layout: PdfLayout, rawText: string): DesignTokens {
  const parsed = parseResumeHeuristic(rawText);
  const uniqueFonts = unique(layout.fonts, (f) => f.toLowerCase());
  const bodyFont = uniqueFonts[0] ?? "Arial";
  const sizes = layout.fontSizes.filter((s) => s >= 6 && s <= 30).sort((a, b) => a - b);
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10.5;
  const max = sizes.length ? sizes[sizes.length - 1] : 12;
  const minLeft = layout.lines.length ? Math.min(...layout.lines.slice(0, 80).map((l) => l.x).filter((x) => x > 0)) : 48;
  const marginPx = clamp(Math.round((minLeft / (layout.pageWidth || 612)) * 816), 24, 96);
  const accent = layout.colors[0] ?? "#111827";
  const columns = layout.lines.some((l) => l.gaps.some((g) => g > layout.pageWidth * 0.18)) ? 1 : 1;

  return {
    ...defaultDesign,
    templateId: "uploaded",
    fontHeading: mapFont(uniqueFonts[1] ?? bodyFont),
    fontBody: bodyFont,
    baseSize: clamp(Math.round(median * 10) / 10, 8, 14),
    lineHeight: clamp(Math.round(((max - median) / Math.max(median, 1) + 1.32) * 100) / 100, 1.15, 1.7),
    margin: marginPx,
    sectionGap: 16,
    accent,
    textColor: "#1f2937",
    headingCase: "upper",
    showRule: true,
    columns,
    atsRisk: "none",
    detected: {
      fonts: uniqueFonts.slice(0, 5),
      sizes: unique([...new Set(sizes.map((s) => Math.round(s * 10) / 10))], (s) => String(s)).slice(0, 8),
      margins: marginPx,
      sectionOrder: parsed.sectionOrder,
      colors: layout.colors.slice(0, 5),
      columns,
      confidence: rawText.length > 400 ? 0.72 : 0.4,
    },
  };
}

/* ------------------------------------------------------------------ */
/* DOCX                                                                */
/* ------------------------------------------------------------------ */

async function extractDocx(buffer: Buffer): Promise<{
  rawText: string;
  design: DesignTokens;
  risks: ParseRisk[];
  meta: DocumentExtraction["meta"];
}> {
  const mammothModule = await import("mammoth");
  const mammoth = (mammothModule as unknown as { default?: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }> }; extractRawText?: (input: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }> });
  const extractor = mammoth.extractRawText ?? mammoth.default?.extractRawText;
  if (!extractor) throw new DocumentParseError("The DOCX parser is unavailable.", "CORRUPT");

  let rawText = "";
  try {
    const result = await extractor({ buffer });
    rawText = result.value.replace(/\n{3,}/g, "\n\n").trim();
  } catch (error) {
    throw new DocumentParseError(`The DOCX file could not be read. ${error instanceof Error ? error.message : ""}`.trim(), "CORRUPT");
  }

  const JSZipModule = await import("jszip");
  const JSZip = (JSZipModule as unknown as { default: typeof import("jszip") }).default;
  let documentXml = "";
  let stylesXml = "";
  let headerFooterXml = "";
  const media: string[] = [];
  try {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);
    documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    stylesXml = (await zip.file("word/styles.xml")?.async("string")) ?? "";
    for (const name of entries) {
      if (/^word\/header\d*\.xml$|^word\/footer\d*\.xml$/.test(name)) {
        headerFooterXml += (await zip.file(name)?.async("string")) ?? "";
      }
      if (/^word\/media\//.test(name)) media.push(name);
    }
  } catch {
    // Mammoth already extracted the text, so a zip inspection failure is non-fatal.
  }

  const hasTables = /<w:tbl\b/.test(documentXml);
  const hasColumns = /<w:cols\b[^>]*w:num="([2-9]|\d{2,})"/.test(documentXml);
  const hasTextboxes = /<w:txbxContent\b|<v:textbox\b/.test(documentXml);
  const hasDrawings = /<w:drawing\b|<w:pict\b|<w:object\b/.test(documentXml);
  const hasImages = media.length > 0 || hasDrawings;
  const hasHeaderFooterText = /<w:t[ >]/.test(headerFooterXml);

  const fontsRaw = [...documentXml.matchAll(/<w:rFonts\b[^>]*w:ascii="([^"]+)"/g)].map((m) => m[1]);
  const styleFonts = [...stylesXml.matchAll(/<w:rFonts\b[^>]*w:ascii="([^"]+)"/g)].map((m) => m[1]);
  const allFonts = unique([...fontsRaw, ...styleFonts].filter(Boolean), (f) => f.toLowerCase()).map(cleanFontName);
  const sizesRaw = [...documentXml.matchAll(/<w:sz\b[^>]*w:val="(\d+)"/g)].map((m) => Number(m[1]) / 2);
  const styleSizes = [...stylesXml.matchAll(/<w:sz\b[^>]*w:val="(\d+)"/g)].map((m) => Number(m[1]) / 2);
  const sizes = [...sizesRaw, ...styleSizes].filter((s) => s >= 6 && s <= 30).sort((a, b) => a - b);
  const bodySize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 11;
  const bodyFont = allFonts[0] ?? "Calibri";
  const margins = documentXml.match(/<w:pgMar\b[^>]*w:left="(\d+)"/);
  const marginPx = margins ? clamp(Math.round(Number(margins[1]) / 15), 24, 96) : 56;
  const lineSpacing = documentXml.match(/<w:spacing\b[^>]*w:line="(\d+)"/);
  const lineHeight = lineSpacing ? clamp(Number(lineSpacing[1]) / 240, 1.1, 1.8) : 1.35;
  const colorMatches = [...documentXml.matchAll(/<w:color\b[^>]*w:val="([0-9A-Fa-f]{6})"/g)].map((m) => `#${m[1].toLowerCase()}`);
  const colors = unique(colorMatches.filter((c) => !/^#(?:000000|ffffff|auto)$/i.test(c)), (c) => c).slice(0, 6);
  const parsed = parseResumeHeuristic(rawText);
  const riskFonts = allFonts.filter((f) => !isSafeFont(f));

  const risks: ParseRisk[] = [];
  if (hasTables) {
    risks.push({
      id: "docx-tables",
      label: "Tables detected",
      severity: "warning",
      detail: "ATS parsers often flatten or skip tables. Move content into normal paragraphs with one column.",
      detectedIn: "docx",
    });
  }
  if (hasTextboxes) {
    risks.push({
      id: "docx-textboxes",
      label: "Text boxes detected",
      severity: "warning",
      detail: "Text in boxes may be ignored or appended out of order by ATS software.",
      detectedIn: "docx",
    });
  }
  if (hasColumns) {
    risks.push({
      id: "docx-columns",
      label: "Multiple columns detected",
      severity: "warning",
      detail: "Column layouts can scramble the reading order. Use a single column for the safest parse.",
      detectedIn: "docx",
    });
  }
  if (hasImages) {
    risks.push({
      id: "docx-images",
      label: "Images or graphic elements detected",
      severity: hasDrawings ? "warning" : "info",
      detail: "Images, icons and drawn shapes are not read by ATS software. Keep key text outside graphics.",
      detectedIn: "docx",
      evidence: `${media.length} media files`,
    });
  }
  if (hasHeaderFooterText) {
    risks.push({
      id: "docx-header-footer",
      label: "Header or footer content detected",
      severity: "warning",
      detail: "Content in Word headers and footers is frequently dropped. Put contact details and headings in the document body.",
      detectedIn: "docx",
    });
  }
  if (riskFonts.length) {
    risks.push({
      id: "docx-fonts",
      label: "Unusual fonts detected",
      severity: "info",
      detail: "Non-standard fonts may render differently on the recruiter's machine. Standard fonts preserve your layout.",
      detectedIn: "docx",
      evidence: riskFonts.slice(0, 4).join(", "),
    });
  }
  if (hasDrawings && parsed.data.sectionOrder.includes("skills")) {
    risks.push({
      id: "docx-skill-bars",
      label: "Check for graphic skill ratings",
      severity: "info",
      detail: "The document has drawn elements and a skills section. Rating bars and dots do not export as searchable skill names.",
      detectedIn: "docx",
    });
  }

  const design: DesignTokens = {
    ...defaultDesign,
    templateId: "uploaded",
    fontBody: mapFont(bodyFont),
    fontHeading: mapFont(allFonts[1] ?? bodyFont),
    baseSize: clamp(Math.round(bodySize * 10) / 10, 8, 14),
    lineHeight: Math.round(lineHeight * 100) / 100,
    margin: marginPx,
    sectionGap: 16,
    accent: colors[0] ?? "#111827",
    headingCase: "upper",
    showRule: true,
    columns: hasColumns ? 2 : 1,
    atsRisk: "none",
    detected: {
      fonts: allFonts.slice(0, 5),
      sizes: unique(sizes, (s) => String(s)).slice(0, 8),
      margins: marginPx,
      sectionOrder: parsed.sectionOrder,
      colors,
      columns: hasColumns ? 2 : 1,
      confidence: rawText.length > 400 ? 0.85 : 0.5,
    },
  };

  return {
    rawText,
    design,
    risks,
    meta: {
      fonts: allFonts,
      hasImages,
      hasTables,
      hasColumns,
      hasTextboxes,
      hasHeaderFooter: hasHeaderFooterText,
      colors,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Public entry                                                        */
/* ------------------------------------------------------------------ */

export function detectFileType(fileName: string, mimeType?: string): ResumeFileType {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (["txt", "text", "md", "rtf"].includes(ext) || mimeType?.startsWith("text/")) return "txt";
  throw new DocumentParseError("Unsupported file type. Upload a PDF, DOCX or TXT file.", "UNSUPPORTED");
}

export async function extractDocument(buffer: Buffer, fileName: string, mimeType?: string): Promise<DocumentExtraction> {
  if (buffer.length > 12 * 1024 * 1024) {
    throw new DocumentParseError("File is larger than the 12 MB limit.", "TOO_LARGE");
  }
  const fileType = detectFileType(fileName, mimeType);

  if (fileType === "pdf") {
    const { rawText, layout, pageCount } = await extractPdf(buffer);
    const risks = detectPdfRisks(layout, rawText);
    const design = designFromPdf(layout, rawText);
    if (rawText.trim().length < 50) {
      risks.push({
        id: "pdf-short-text",
        label: "Very little text was extracted",
        severity: "critical",
        detail: "The parser found almost no selectable text. Check the ATS preview before using this file.",
        detectedIn: "pdf",
      });
    }
    return {
      rawText,
      fileType,
      pageCount,
      risks,
      design,
      meta: {
        title: layout.metadata.title,
        author: layout.metadata.author,
        producer: layout.metadata.producer,
        fonts: layout.fonts,
        hasImages: layout.hasImages,
        hasTables: risks.some((r) => r.id === "pdf-table"),
        hasColumns: risks.some((r) => r.id === "pdf-columns"),
        hasTextboxes: risks.some((r) => r.id === "pdf-textbox"),
        hasHeaderFooter: risks.some((r) => r.id === "pdf-header-footer"),
        colors: layout.colors,
      },
    };
  }

  if (fileType === "docx") {
    const { rawText, design, risks, meta } = await extractDocx(buffer);
    if (!rawText.trim()) {
      throw new DocumentParseError("No text was found in the DOCX file.", "EMPTY");
    }
    return { rawText, fileType, pageCount: Math.max(1, Math.round(rawText.split(/\s+/).length / 450)), risks, design, meta };
  }

  const rawText = buffer.toString("utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!rawText) throw new DocumentParseError("The text file is empty.", "EMPTY");
  const parsed = parseResumeHeuristic(rawText, fileName);
  const risks: ParseRisk[] = [];
  if (/[▁▂▃▄▅▆▇█■□●○◆◇★☆]/.test(rawText)) {
    risks.push({
      id: "txt-skill-bars",
      label: "Graphic skill bars or rating icons",
      severity: "warning",
      detail: "Bar and dot ratings do not translate into ATS keywords. Write the skill names as plain text.",
      detectedIn: "text",
    });
  }
  if (/^[A-Z][A-Z\s&]{8,}$/m.test(rawText) === false) {
    risks.push({
      id: "txt-headings",
      label: "Standard section headings not detected",
      severity: "info",
      detail: "ATS parsers map sections through headings such as Experience, Education and Skills. Add plain heading lines.",
      detectedIn: "text",
    });
  }
  return {
    rawText,
    fileType,
    pageCount: Math.max(1, Math.ceil(rawText.split(/\s+/).length / 500)),
    risks,
    design: {
      ...defaultDesign,
      templateId: "uploaded",
      fontBody: "Arial",
      fontHeading: "Arial",
      detected: {
        fonts: [],
        sizes: [],
        margins: 48,
        sectionOrder: parsed.sectionOrder,
        colors: [],
        columns: 1,
        confidence: 0.2,
      },
    },
    meta: {
      fonts: [],
      hasImages: false,
      hasTables: false,
      hasColumns: false,
      hasTextboxes: false,
      hasHeaderFooter: false,
      colors: [],
    },
  };
}

export const __parseInternals = { mapFont, isSafeFont, detectPdfRisks, designFromPdf };
