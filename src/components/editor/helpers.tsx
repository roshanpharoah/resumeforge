"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resumeToPlainText, type DesignTokens, type ResumeData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[11px]">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} />
      {hint && <p className="text-[10px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className,
  rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label className="text-[11px]">{label}</Label>}
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} />
    </div>
  );
}

export function EditorCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b p-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function MoveButtons({
  index,
  length,
  onMove,
  onRemove,
  removeLabel = "Delete",
}: {
  index: number;
  length: number;
  onMove: (from: number, to: number) => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label="Move up">
        <ChevronUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(index, index + 1)} disabled={index === length - 1} aria-label="Move down">
        <ChevronDown />
      </Button>
      {onRemove && (
        <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={removeLabel}>
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

export function CommaListField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [text, setText] = useState(value.join(", "));
  const focused = useRef(false);
  const joined = value.join(", ");

  useEffect(() => {
    if (!focused.current && joined !== text) setText(joined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  function commit() {
    const next = text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    onChange(next);
    setText(next.join(", "));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px]">{label}</Label>
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
      />
      {hint && <p className="text-[10px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A rough layout aware page estimate used by the one-page fit control. */
export function estimateVisualPages(data: ResumeData, design: DesignTokens): number {
  const text = resumeToPlainText(data);
  const chars = Math.max(1, text.length);
  const width = Math.max(120, 816 - design.margin * 2);
  const charsPerLine = Math.max(38, width / (design.baseSize * 0.53));
  const baseLines = chars / charsPerLine;
  const overhead = data.experience.length * 3 + data.education.length * 2 + data.projects.length * 2 + data.skills.length + data.certifications.length + data.awards.length + 8;
  const lines = (baseLines + overhead) * 1.06;
  const lineHeight = design.baseSize * 1.333 * design.lineHeight;
  const usable = Math.max(200, 11 * 96 - design.margin * 2);
  return Math.max(1, Math.ceil((lines * lineHeight) / usable));
}

export function fitToOnePage(data: ResumeData, design: DesignTokens): DesignTokens {
  const next: DesignTokens = { ...design };
  let guard = 0;
  while (estimateVisualPages(data, next) > 1 && guard < 60) {
    if (next.baseSize > 9.25) next.baseSize = Math.round((next.baseSize - 0.25) * 100) / 100;
    else if (next.lineHeight > 1.2) next.lineHeight = Math.round((next.lineHeight - 0.03) * 100) / 100;
    else if (next.margin > 30) next.margin -= 2;
    else if (next.sectionGap > 8) next.sectionGap -= 1;
    else break;
    guard += 1;
  }
  return next;
}
