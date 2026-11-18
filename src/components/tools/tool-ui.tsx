"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/utils";
import { toast } from "sonner";

export function CopyButton({
  text,
  label = "Copy",
  size = "sm",
  variant = "outline",
  className,
}: {
  text: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "forge";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={async () => {
        const ok = await copyText(text);
        setCopied(ok);
        toast[ok ? "success" : "error"](ok ? "Copied." : "Copy failed. Select the text manually.");
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
}

export function ToolCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function EmptyToolState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      {children && <div className="mt-3 flex justify-center">{children}</div>}
    </div>
  );
}

export function sourceLine(generatedBy: "rules" | "llm"): string {
  return generatedBy === "llm"
    ? "Drafted with AI, then checked against your resume text."
    : "Built from rules and your resume text. No AI key is needed.";
}
