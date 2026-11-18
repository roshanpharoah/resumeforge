"use client";

import { ArrowRight, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/severity-badge";
import type { AnalysisIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

export function IssueCard({
  issue,
  onFix,
  fixing,
  className,
  compact,
}: {
  issue: AnalysisIssue;
  onFix?: (issue: AnalysisIssue) => void;
  fixing?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={issue.severity} />
        <Badge variant="outline" className="capitalize">
          {issue.category}
        </Badge>
        {issue.location && <span className="truncate text-xs text-muted-foreground">{issue.location}</span>}
      </div>
      <h3 className="mt-2.5 text-sm font-semibold leading-snug">{issue.title}</h3>
      <p className={cn("mt-1 text-sm leading-relaxed text-muted-foreground", compact && "line-clamp-2")}>{issue.why}</p>
      {onFix && issue.fix.kind !== "none" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={issue.fix.kind === "auto" ? "forge" : "outline"} onClick={() => onFix(issue)} disabled={fixing}>
            {fixing ? <Wand2 className="animate-pulse" /> : <Wand2 />}
            {issue.fix.label}
          </Button>
          {issue.fix.kind === "auto" && (
            <span className="text-[11px] text-muted-foreground">
              Saves the change, then rescoring.
            </span>
          )}
          {issue.fix.kind === "ask" && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
        </div>
      )}
    </div>
  );
}
