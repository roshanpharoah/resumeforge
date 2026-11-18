import type { DesignTokens, TemplateDefinition } from "@/lib/types";
import { defaultDesign, templates } from "@/lib/types";

export const atsTemplates = templates.filter((t) => t.kind === "ats");
export const designerTemplates = templates.filter((t) => t.kind === "designer");

export function findTemplate(id: string): TemplateDefinition | null {
  return templates.find((t) => t.id === id) ?? null;
}

/** Merge a template's tokens over the user's current design, preserving fonts and margins they changed. */
export function applyTemplate(current: DesignTokens, templateId: string): DesignTokens {
  const template = findTemplate(templateId);
  if (!template) return { ...current, templateId };
  return {
    ...defaultDesign,
    ...current,
    ...template.design,
    templateId: template.id,
    atsRisk: template.atsRisk,
    detected: current.detected,
    textColor: current.textColor || "#1f2937",
  };
}

/** Use the fonts and margins detected in the uploaded file, with a clean single-column layout. */
export function keepMyDesign(detected: DesignTokens | null | undefined): DesignTokens {
  if (!detected?.detected) return { ...defaultDesign, templateId: "uploaded" };
  const found = detected.detected;
  const safeFont = found.fonts.find((f) => /^(inter|arial|calibri|georgia|garamond|cambria|lato|helvetica|source sans|times)/i.test(f));
  return {
    ...defaultDesign,
    templateId: "uploaded",
    fontBody: safeFont || detected.fontBody || "Arial",
    fontHeading: safeFont || detected.fontHeading || "Arial",
    margin: Math.min(80, Math.max(32, found.margins || 48)),
    columns: 1,
    showRule: true,
    atsRisk: "low",
    detected: found,
  };
}

export function templateFamily(templateId: string): "ats" | "designer" | "custom" {
  return findTemplate(templateId)?.kind ?? "custom";
}

export const stylePresets = [
  { id: "balanced", label: "Balanced", design: { baseSize: 10.5, lineHeight: 1.4, margin: 48, sectionGap: 16, showRule: true } },
  { id: "compact", label: "Compact", design: { baseSize: 10, lineHeight: 1.3, margin: 38, sectionGap: 11, showRule: true } },
  { id: "airy", label: "Airy", design: { baseSize: 11, lineHeight: 1.52, margin: 58, sectionGap: 20, showRule: false } },
] as const;

export const accentChoices = [
  { label: "Ink", value: "#111827" },
  { label: "Teal", value: "#0f766e" },
  { label: "Navy", value: "#1e3a5f" },
  { label: "Forest", value: "#1f3a34" },
  { label: "Merlot", value: "#6b1f33" },
  { label: "Plum", value: "#5b2a70" },
  { label: "Clay", value: "#7c2d12" },
  { label: "Slate", value: "#334155" },
];
