"use client";

import { useState } from "react";
import { AlertCircle, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/severity-badge";
import type { FactCheckResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FactCheckList({
  result,
  onConfirm,
  onRecheck,
  confirming,
  compact,
}: {
  result: FactCheckResult;
  onConfirm?: (fingerprint: string) => void;
  onRecheck?: () => void;
  confirming?: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (result.passed && !result.findings.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Every claim traces back to your own text.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {result.blocking > 0 ? (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" /> {result.blocking} blocking
            </Badge>
          ) : (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" /> No blockers
            </Badge>
          )}
          {result.warnings > 0 && <Badge variant="warning">{result.warnings} warning{result.warnings === 1 ? "" : "s"}</Badge>}
          {result.passed && (
            <Badge variant="success">
              <ShieldCheck className="mr-1 h-3 w-3" /> Passed
            </Badge>
          )}
        </div>
        {onRecheck && (
          <Button type="button" size="sm" variant="outline" onClick={onRecheck} disabled={confirming}>
            {confirming ? "Checking..." : "Run check again"}
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        {result.findings.slice(0, compact ? 4 : 40).map((finding) => {
          const open = expanded === finding.fingerprint;
          return (
            <div
              key={finding.fingerprint}
              className={cn(
                "rounded-lg border p-3 text-sm",
                finding.confirmed
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
                  : finding.blocking
                    ? "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20"
                    : "bg-card",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={finding.severity} />
                {finding.confirmed && (
                  <Badge variant="success" className="gap-1">
                    <Check className="h-3 w-3" /> Confirmed
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{finding.location}</span>
              </div>
              <p className="mt-1.5 font-medium leading-snug">{"\u201c"}{finding.claim}{"\u201d"}</p>
              <button type="button" onClick={() => setExpanded(open ? null : finding.fingerprint)} className="mt-1 text-xs text-muted-foreground underline underline-offset-2">
                {open ? "Hide detail" : "Why was this flagged?"}
              </button>
              {open && (
                <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                  <p>{finding.reason}</p>
                  {finding.supportedBy && <p>Supported by: {finding.supportedBy}</p>}
                  <p className="text-foreground">{finding.suggestion}</p>
                </div>
              )}
              {finding.blocking && finding.confirmable === false && !finding.confirmed && (
                <p className="mt-2 text-xs text-muted-foreground">This finding cannot be confirmed. Fix the resume content to resolve it.</p>
              )}
              {finding.blocking && finding.confirmable !== false && onConfirm && !finding.confirmed && (
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => onConfirm(finding.fingerprint)} disabled={confirming}>
                  This is accurate, confirm it
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
