"use client";

import { useState } from "react";
import { AlertTriangle, Check, LayoutTemplate, Palette, RotateCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { EditorCard, estimateVisualPages, fitToOnePage } from "@/components/editor/helpers";
import { accentChoices, applyTemplate, keepMyDesign, stylePresets } from "@/lib/templates";
import { fontChoices, templates, type DesignTokens, type ResumeData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DesignPanel({
  data,
  design,
  onChange,
}: {
  data: ResumeData;
  design: DesignTokens;
  onChange: (next: DesignTokens) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const pages = estimateVisualPages(data, design);

  function applyFit() {
    const next = fitToOnePage(data, design);
    onChange(next);
    const after = estimateVisualPages(data, next);
    setMessage(after <= 1 ? "Fitted to one page. Review the preview for crowding." : "The content is still over one page after safe spacing changes. Cut content instead of shrinking further.");
    window.setTimeout(() => setMessage(null), 5000);
  }

  return (
    <div className="space-y-4">
      <EditorCard
        title="Templates"
        description="All templates are single column at heart. Designer options look sharper but carry more parser risk."
        action={<Badge variant="outline"><LayoutTemplate className="h-3 w-3" /> {templates.length} designs</Badge>}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((template) => {
            const active = design.templateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  onChange(applyTemplate(design, template.id));
                  setMessage(`${template.name} applied. Save when you like it.`);
                }}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  active ? "border-forge-400 bg-forge-50/50 dark:border-forge-700 dark:bg-forge-950/30" : "hover:border-forge-200 dark:hover:border-forge-800",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{template.name}</span>
                  {active ? <Check className="h-3.5 w-3.5 text-forge-600" /> : <Badge variant={template.atsRisk === "none" ? "success" : template.atsRisk === "low" ? "info" : template.atsRisk === "medium" ? "warning" : "destructive"}>ATS {template.atsRisk}</Badge>}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{template.description}</p>
              </button>
            );
          })}
        </div>
        {design.detected && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              onChange(keepMyDesign(design));
              setMessage("Detected fonts and margins restored with a clean single column layout.");
            }}
          >
            <RotateCcw /> Keep the design from my upload
          </Button>
        )}
      </EditorCard>

      <EditorCard
        title="One page fit"
        description="Tightens spacing and type size within readable limits. It never deletes content."
        action={<Badge variant={pages <= 1 ? "success" : "warning"}>{pages} page{pages === 1 ? "" : "s"} estimated</Badge>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="forge" onClick={applyFit}>
            <Sparkles /> Fit to one page
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({ ...design, baseSize: 10.5, lineHeight: 1.4, margin: 48, sectionGap: 16 })
            }
          >
            Reset spacing
          </Button>
        </div>
        {message && <p className="mt-2 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">{message}</p>}
        {pages > 1 && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Most early career resumes read better at one page. Cut a weak bullet before going below 9.5pt.
          </p>
        )}
      </EditorCard>

      <EditorCard title="Style" description="Controls apply to the live preview and every export." action={<Palette className="h-4 w-4 text-muted-foreground" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Heading font</Label>
            <Select value={design.fontHeading} onValueChange={(value) => onChange({ ...design, fontHeading: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {fontChoices.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Body font</Label>
            <Select value={design.fontBody} onValueChange={(value) => onChange({ ...design, fontBody: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {fontChoices.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">Base size</span>
              <span className="tabular-nums text-muted-foreground">{design.baseSize.toFixed(2)} pt</span>
            </div>
            <Slider min={8} max={14} step={0.25} value={[design.baseSize]} onValueChange={([value]) => onChange({ ...design, baseSize: value })} className="mt-2" />
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">Line height</span>
              <span className="tabular-nums text-muted-foreground">{design.lineHeight.toFixed(2)}</span>
            </div>
            <Slider min={1.1} max={1.9} step={0.02} value={[design.lineHeight]} onValueChange={([value]) => onChange({ ...design, lineHeight: value })} className="mt-2" />
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">Page margin</span>
              <span className="tabular-nums text-muted-foreground">{design.margin} px</span>
            </div>
            <Slider min={24} max={96} step={2} value={[design.margin]} onValueChange={([value]) => onChange({ ...design, margin: value })} className="mt-2" />
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">Section gap</span>
              <span className="tabular-nums text-muted-foreground">{design.sectionGap}</span>
            </div>
            <Slider min={8} max={32} step={1} value={[design.sectionGap]} onValueChange={([value]) => onChange({ ...design, sectionGap: value })} className="mt-2" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label className="text-[11px]">Accent colour</Label>
          <div className="flex flex-wrap items-center gap-2">
            {accentChoices.map((accent) => (
              <button
                key={accent.value}
                type="button"
                onClick={() => onChange({ ...design, accent: accent.value })}
                className={cn("h-7 w-7 rounded-full border-2 transition", design.accent === accent.value ? "border-foreground" : "border-transparent")}
                style={{ backgroundColor: accent.value }}
                aria-label={accent.label}
                title={accent.label}
              />
            ))}
            <input
              type="color"
              value={design.accent}
              onChange={(event) => onChange({ ...design, accent: event.target.value })}
              className="h-7 w-10 cursor-pointer rounded border bg-transparent p-0.5"
              aria-label="Custom accent colour"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Heading case</Label>
            <Select value={design.headingCase} onValueChange={(value) => onChange({ ...design, headingCase: value as DesignTokens["headingCase"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upper">Uppercase</SelectItem>
                <SelectItem value="title">Title case</SelectItem>
                <SelectItem value="none">As written</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Columns</Label>
            <Select value={String(design.columns)} onValueChange={(value) => onChange({ ...design, columns: Number(value) as 1 | 2 })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">One column, safest</SelectItem>
                <SelectItem value="2">Two columns, higher risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-xs font-medium">Section rules</div>
            <div className="text-[10px] text-muted-foreground">A thin rule under each heading.</div>
          </div>
          <Switch checked={design.showRule} onCheckedChange={(checked) => onChange({ ...design, showRule: checked })} />
        </div>

        {design.columns === 2 && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Some ATS parsers read two column layouts out of order. Use this only when the design matters more than the parser.
          </p>
        )}
      </EditorCard>

      <EditorCard title="Presets" description="Three spacing presets that stay readable.">
        <div className="grid gap-2 sm:grid-cols-3">
          {stylePresets.map((preset) => (
            <Button key={preset.id} variant="outline" size="sm" onClick={() => onChange({ ...design, ...preset.design })}>
              {preset.label}
            </Button>
          ))}
        </div>
      </EditorCard>
    </div>
  );
}
