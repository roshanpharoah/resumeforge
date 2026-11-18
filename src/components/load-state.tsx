"use client";

import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoadingPanel({ label = "Loading your data", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border bg-card/40 p-8 text-center", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-forge-600 dark:text-forge-400" />
      <p className="text-sm text-muted-foreground">{label}...</p>
    </div>
  );
}

export function ErrorPanel({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-5 text-sm dark:border-rose-900 dark:bg-rose-950/30", className)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
        <div>
          <p className="font-medium text-rose-900 dark:text-rose-100">Something got in the way</p>
          <p className="mt-1 leading-relaxed text-rose-800/90 dark:text-rose-200/90">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw /> Try again
        </Button>
      )}
    </div>
  );
}
