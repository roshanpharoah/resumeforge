import type { DesignTokens, ResumeData } from "@/lib/types";
import { resumeToPlainText } from "@/lib/types";
import { env } from "@/lib/env";

const FONT_STACKS: Record<string, string> = {
  Inter: '"Inter", Arial, sans-serif',
  "Source Sans 3": '"Source Sans 3", Arial, sans-serif',
  Georgia: "Georgia, 'Times New Roman', serif",
  Garamond: "Garamond, 'Times New Roman', serif",
  "Times New Roman": "'Times New Roman', serif",
  Arial: "Arial, Helvetica, sans-serif",
  Calibri: "Calibri, Arial, sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  Cambria: "Cambria, Georgia, serif",
  Lato: "Lato, Arial, sans-serif",
};

function stack(font: string): string {
  return FONT_STACKS[font] ?? `"${font.replace(/"/g, "")}", Arial, sans-serif`;
}

function esc(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

/** DOCX colors must be exactly six hex digits, so strip alpha and expand shorthand. */
function sixDigitHex(value: string, fallback: string): string {
  const safe = safeColor(value, fallback).slice(1);
  const expanded = safe.length === 3 || safe.length === 4
    ? safe.slice(0, 3).split("").map((character) => character + character).join("")
    : safe.slice(0, 6);
  return expanded.length === 6 ? expanded : fallback.slice(1);
}

function headingHtml(text: string, design: DesignTokens, pt: number): string {
  const transform = design.headingCase === "upper" ? "uppercase" : "none";
  return `<h2 style="margin:0 0 5pt;padding-bottom:${
    design.showRule ? "3pt" : "0"
  };border-bottom:${design.showRule ? `0.75pt solid ${esc(design.accent)}40` : "none"};font-family:${esc(
    stack(design.fontHeading),
  )};font-size:${pt}pt;font-weight:700;letter-spacing:${transform === "uppercase" ? "0.08em" : "0.01em"};text-transform:${transform};color:${esc(
    safeColor(design.accent, "#111827"),
  )};line-height:1.25">${esc(text)}</h2>`;
}

function rowHtml(left: string, right: string): string {
  if (!right) return `<div>${left}</div>`;
  return `<div style="display:flex;justify-content:space-between;gap:18pt;align-items:baseline"><div>${left}</div><div style="white-space:nowrap;opacity:0.78;font-size:0.92em">${right}</div></div>`;
}

function bulletsHtml(items: string[]): string {
  if (!items.length) return "";
  return `<ul style="margin:3pt 0 0;padding-left:14pt">${items
    .map((item) => `<li style="margin:0 0 1.6pt;padding-left:2pt">${esc(item)}</li>`)
    .join("")}</ul>`;
}

function sectionHtml(key: (typeof sectionOrder)[number], data: ResumeData, design: DesignTokens): string {
  const headingPt = design.baseSize * 1.06;
  const gap = `${Math.max(6, design.sectionGap * 0.75)}pt`;
  switch (key) {
    case "summary":
      if (!data.summary) return "";
      return `<section style="margin-top:${gap}">${headingHtml("Summary", design, headingPt)}<p style="margin:0">${esc(data.summary)}</p></section>`;
    case "experience":
      if (!data.experience.length) return "";
      return `<section style="margin-top:${gap}">${headingHtml("Experience", design, headingPt)}<div>${data.experience
        .map((exp) => {
          const dates = `${esc(exp.startDate)}${exp.startDate && (exp.endDate || exp.current) ? " to " : ""}${exp.current ? "Present" : esc(exp.endDate)}`;
          const subtitle = [esc(exp.company), esc(exp.location)].filter(Boolean).join(", ");
          return `<div style="margin-bottom:6pt;break-inside:avoid">${rowHtml(
            `<span style="font-weight:600">${esc(exp.title || "Title")}</span>${subtitle ? `<span>, ${subtitle}</span>` : ""}`,
            dates,
          )}${bulletsHtml(exp.bullets.map((b) => b.text))}</div>`;
        })
        .join("")}</div></section>`;
    case "projects":
      if (!data.projects.length) return "";
      return `<section style="margin-top:${gap}">${headingHtml("Projects", design, headingPt)}<div>${data.projects
        .map((project) => {
          const meta = [esc(project.role), esc(project.url ? project.url.replace(/^https?:\/\//, "") : "")].filter(Boolean).join(" · ");
          const dates = `${esc(project.startDate)}${project.startDate && project.endDate ? " to " : ""}${esc(project.endDate)}`;
          return `<div style="margin-bottom:6pt;break-inside:avoid">${rowHtml(
            `<span style="font-weight:600">${esc(project.name)}</span>${meta ? `<span style="opacity:0.8"> · ${meta}</span>` : ""}`,
            dates,
          )}${project.description ? `<div style="margin-top:1pt">${esc(project.description)}</div>` : ""}${bulletsHtml(
            project.bullets.map((b) => b.text),
          )}</div>`;
        })
        .join("")}</div></section>`;
    case "education":
      if (!data.education.length) return "";
      return `<section style="margin-top:${gap}">${headingHtml("Education", design, headingPt)}<div>${data.education
        .map((edu) => {
          const degree = [esc(edu.degree), esc(edu.field)].filter(Boolean).join(", ");
          const label = degree || esc(edu.institution);
          return `<div style="margin-bottom:4pt;break-inside:avoid">${rowHtml(
            `<span style="font-weight:600">${label}</span>${degree && edu.institution ? `<span> · ${esc(edu.institution)}</span>` : ""}`,
            `${esc(edu.startDate)}${edu.startDate && edu.endDate ? " to " : ""}${esc(edu.endDate)}`,
          )}${edu.details ? `<div style="opacity:0.85;font-size:0.95em">${esc(edu.details)}</div>` : ""}</div>`;
        })
        .join("")}</div></section>`;
    case "skills":
      if (!data.skills.length) return "";
      return `<section style="margin-top:${gap}">${headingHtml("Skills", design, headingPt)}${data.skills
        .map((group) => `<div style="margin:0 0 1.5pt"><span style="font-weight:600">${esc(group.name)}:</span> ${esc(group.skills.join(", "))}</div>`)
        .join("")}</section>`;
    case "certifications":
      if (!data.certifications.length) return "";
      return `<section style="margin-top:${gap}">${headingHtml("Certifications", design, headingPt)}${data.certifications
        .map((cert) =>
          rowHtml(
            `<span style="font-weight:600">${esc(cert.name)}</span>${cert.issuer ? ` · ${esc(cert.issuer)}` : ""}`,
            esc(cert.issueDate),
          ),
        )
        .join("")}</section>`;
    case "awards":
      if (!data.awards.length) return "";
      return `<section style="margin-top:${gap}">${headingHtml("Awards", design, headingPt)}${data.awards
        .map((award) =>
          rowHtml(
            `<span style="font-weight:600">${esc(award.name)}</span>${award.issuer ? ` · ${esc(award.issuer)}` : ""}${
              award.description ? ` · ${esc(award.description)}` : ""
            }`,
            esc(award.date),
          ),
        )
        .join("")}</section>`;
    case "custom":
      if (!data.custom.length) return "";
      return data.custom
        .map(
          (section) =>
            `<section style="margin-top:${gap}">${headingHtml(section.title || "Additional", design, headingPt)}<p style="margin:0;white-space:pre-wrap">${esc(
              section.content,
            )}</p></section>`,
        )
        .join("");
    default:
      return "";
  }
}

const sectionOrder = ["summary", "experience", "projects", "education", "skills", "certifications", "awards", "custom"] as const;

export function renderResumeHtml(data: ResumeData, design: DesignTokens, options: { watermark?: string } = {}): string {
  const marginIn = Math.max(0.25, design.margin / 96);
  const accent = safeColor(design.accent, "#111827");
  const text = safeColor(design.textColor, "#1f2937");
  const contact = [data.contact.email, data.contact.phone, data.contact.location, data.contact.linkedin, data.contact.website, data.contact.github]
    .filter(Boolean)
    .map(esc)
    .join(" &nbsp;|&nbsp; ");
  const ordered = data.sectionOrder.filter((key): key is (typeof sectionOrder)[number] => (sectionOrder as readonly string[]).includes(key));
  for (const key of sectionOrder) if (!ordered.includes(key)) ordered.push(key);

  const body = ordered.map((key) => sectionHtml(key, data, design)).join("");
  const font = esc(stack(design.fontBody));
  const headingFont = esc(stack(design.fontHeading));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(data.contact.fullName || "Resume")}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    color: ${esc(text)};
    font-family: ${font};
    font-size: ${design.baseSize}pt;
    line-height: ${design.lineHeight};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { margin: 0; font-family: ${headingFont}; color: ${esc(accent)}; font-size: ${design.baseSize * (design.templateId === "designer-bold" ? 2.1 : 1.75)}pt; line-height: 1.08; letter-spacing: 0.01em; }
  ul { margin: 3pt 0 0; padding-left: 14pt; }
  li { margin: 0 0 1.6pt; }
  a { color: inherit; }
  .headline { margin-top: 2pt; font-size: ${design.baseSize * 1.04}pt; font-weight: 500; }
  .contact { margin-top: 4pt; font-size: ${design.baseSize * 0.9}pt; color: #4b5563; }
  .watermark { position: fixed; right: 18pt; top: 14pt; font-size: 7pt; color: #9ca3af; letter-spacing: 0.08em; }
  @page { size: Letter; margin: ${marginIn}in; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
${options.watermark ? `<div class="watermark">${esc(options.watermark)}</div>` : ""}
<header>
  <h1>${esc(data.contact.fullName || "Your Name")}</h1>
  ${data.contact.headline ? `<div class="headline">${esc(data.contact.headline)}</div>` : ""}
  ${contact ? `<div class="contact">${contact}</div>` : ""}
</header>
${body}
</body>
</html>`;
}

export async function renderResumePdf(data: ResumeData, design: DesignTokens): Promise<Buffer> {
  const html = renderResumeHtml(data, design);
  const puppeteer = (await import("puppeteer")).default;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      executablePath: env().PUPPETEER_EXECUTABLE_PATH || env().CHROME_PATH || undefined,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown PDF engine error.";
    throw new Error(`PDF rendering is unavailable. ${detail}`);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function renderResumeDocx(data: ResumeData, design: DesignTokens): Promise<Buffer> {
  const docx = await import("docx");
  const {
    AlignmentType,
    BorderStyle,
    Document,
    LevelFormat,
    Packer,
    Paragraph,
    TabStopType,
    TextRun,
    convertInchesToTwip,
  } = docx;

  const halfPoints = Math.round(design.baseSize * 2);
  const accent = sixDigitHex(design.accent, "#111827");
  const marginTwips = Math.round((design.margin / 96) * 1440);
  const bodyFont = design.fontBody;
  const headingFont = design.fontHeading;

  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: Math.round(design.sectionGap * 10), after: 80 },
      border: design.showRule
        ? { bottom: { color: accent, size: 4, style: BorderStyle.SINGLE, space: 3 } }
        : undefined,
      children: [
        new TextRun({
          text: design.headingCase === "upper" ? text.toUpperCase() : text,
          bold: true,
          size: Math.round(halfPoints * 1.08),
          color: accent,
          font: headingFont,
          characterSpacing: design.headingCase === "upper" ? 20 : 0,
        }),
      ],
    });

  const entry = (left: string, right: string) =>
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: convertInchesToTwip(8.5 - (design.margin / 96) * 2) }],
      spacing: { before: 40, after: 20 },
      children: [
        new TextRun({ text: left, bold: true, size: halfPoints, font: bodyFont }),
        ...(right ? [new TextRun({ text: `\t${right}`, size: Math.round(halfPoints * 0.92), color: "666666", font: bodyFont })] : []),
      ],
    });

  const body = (text: string, opts: { italics?: boolean; muted?: boolean } = {}) =>
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({
          text,
          size: halfPoints,
          font: bodyFont,
          italics: opts.italics,
          color: opts.muted ? "555555" : undefined,
        }),
      ],
    });

  const bulletList = (items: string[], reference = "rf-bullets") =>
    items.map(
      (item) =>
        new Paragraph({
          numbering: { reference, level: 0 },
          spacing: { after: 20 },
          children: [new TextRun({ text: item, size: halfPoints, font: bodyFont })],
        }),
    );

  const children: InstanceType<typeof Paragraph>[] = [];
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: data.contact.fullName || "Your Name",
          bold: true,
          size: Math.round(halfPoints * (design.templateId === "designer-bold" ? 2.1 : 1.8)),
          color: accent,
          font: headingFont,
        }),
      ],
    }),
  );
  if (data.contact.headline) children.push(body(data.contact.headline, { muted: true }));
  const contact = [data.contact.email, data.contact.phone, data.contact.location, data.contact.linkedin, data.contact.website, data.contact.github]
    .filter(Boolean)
    .join("  |  ");
  if (contact) children.push(body(contact, { muted: true }));

  for (const key of data.sectionOrder) {
    if (key === "summary" && data.summary) {
      children.push(heading("Summary"), body(data.summary));
    } else if (key === "experience" && data.experience.length) {
      children.push(heading("Experience"));
      for (const exp of data.experience) {
        children.push(
          entry(
            [exp.title, exp.company, exp.location].filter(Boolean).join(", "),
            `${exp.startDate}${exp.startDate && (exp.endDate || exp.current) ? " to " : ""}${exp.current ? "Present" : exp.endDate}`,
          ),
          ...bulletList(exp.bullets.map((b) => b.text)),
        );
      }
    } else if (key === "projects" && data.projects.length) {
      children.push(heading("Projects"));
      for (const project of data.projects) {
        children.push(
          entry([project.name, project.role, project.url].filter(Boolean).join(", "), [project.startDate, project.endDate].filter(Boolean).join(" to ")),
        );
        if (project.description) children.push(body(project.description));
        children.push(...bulletList(project.bullets.map((b) => b.text)));
      }
    } else if (key === "education" && data.education.length) {
      children.push(heading("Education"));
      for (const edu of data.education) {
        children.push(
          entry(
            [[edu.degree, edu.field].filter(Boolean).join(", "), edu.institution].filter(Boolean).join(" · "),
            [edu.startDate, edu.endDate].filter(Boolean).join(" to "),
          ),
        );
        if (edu.details) children.push(body(edu.details, { muted: true }));
      }
    } else if (key === "skills" && data.skills.length) {
      children.push(heading("Skills"));
      for (const group of data.skills) {
        children.push(
          new Paragraph({
            spacing: { after: 20 },
            children: [
              new TextRun({ text: `${group.name}: `, bold: true, size: halfPoints, font: bodyFont }),
              new TextRun({ text: group.skills.join(", "), size: halfPoints, font: bodyFont }),
            ],
          }),
        );
      }
    } else if (key === "certifications" && data.certifications.length) {
      children.push(heading("Certifications"));
      for (const cert of data.certifications) {
        children.push(entry([cert.name, cert.issuer].filter(Boolean).join(" · "), cert.issueDate));
      }
    } else if (key === "awards" && data.awards.length) {
      children.push(heading("Awards"));
      for (const award of data.awards) {
        children.push(entry([award.name, award.issuer, award.description].filter(Boolean).join(" · "), award.date));
      }
    } else if (key === "custom") {
      for (const section of data.custom) {
        children.push(heading(section.title || "Additional"), body(section.content));
      }
    }
  }

  const doc = new Document({
    creator: "ResumeForge",
    title: data.contact.fullName || "Resume",
    styles: {
      default: {
        document: {
          run: { font: bodyFont, size: halfPoints },
          paragraph: { spacing: { line: Math.round(design.lineHeight * 240) } },
        },
      },
      paragraphStyles: [
        {
          id: "rf-heading",
          name: "RF Heading",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { bold: true, font: headingFont },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "rf-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: convertInchesToTwip(0.2), hanging: convertInchesToTwip(0.16) } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
            margin: { top: marginTwips, right: marginTwips, bottom: marginTwips, left: marginTwips },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export function renderResumeTxt(data: ResumeData): Buffer {
  return Buffer.from(resumeToPlainText(data), "utf8");
}
