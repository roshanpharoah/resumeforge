"use client";

import Link from "next/link";
import { ArrowUpRight, Landmark, Scale, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyToolState, ToolCard } from "@/components/tools/tool-ui";
import type { JobSummaryDto } from "@/lib/serializers";
import { cn } from "@/lib/utils";

interface SalaryRow {
  job: JobSummaryDto;
  min: number | null;
  max: number | null;
  currency: string;
  source: "entered" | "posting" | "none";
  midpoint: number | null;
}

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function toRows(jobs: JobSummaryDto[]): SalaryRow[] {
  return jobs.map((job) => {
    const entered = job.salaryMin !== null || job.salaryMax !== null;
    const posted = job.salaryRange && (job.salaryRange.min !== undefined || job.salaryRange.max !== undefined);
    const min = entered ? job.salaryMin : posted ? (job.salaryRange?.min ?? null) : null;
    const max = entered ? job.salaryMax : posted ? (job.salaryRange?.max ?? null) : null;
    const currency = (entered ? job.currency : job.salaryRange?.currency ?? job.currency) || "USD";
    const midpoint = min !== null && max !== null ? Math.round((min + max) / 2) : min ?? max;
    return {
      job,
      min,
      max,
      currency: currency.toUpperCase().slice(0, 3),
      source: entered ? "entered" : posted ? "posting" : "none",
      midpoint,
    };
  });
}

export function SalaryInsightsTool({ jobs }: { jobs: JobSummaryDto[] }) {
  const rows = toRows(jobs);
  const withRanges = rows.filter((row) => row.source !== "none" && row.midpoint !== null);

  const byCurrency = new Map<string, number[]>();
  for (const row of withRanges) {
    if (row.midpoint === null) continue;
    const list = byCurrency.get(row.currency) ?? [];
    list.push(row.midpoint);
    byCurrency.set(row.currency, list);
  }

  return (
    <div className="space-y-5">
      <ToolCard
        title="Your saved ranges"
        description="A view of the numbers you entered or the posting stated. No external salary database is used."
        action={<Badge variant="outline"><Landmark className="h-3 w-3" /> {withRanges.length} with a range</Badge>}
      >
        {!jobs.length ? (
          <EmptyToolState title="No applications yet" description="Save a role and add its salary range. This tool will then compare the ranges you have seen.">
            <Link href="/jobs"><Button variant="outline" size="sm">Go to applications <ArrowUpRight /></Button></Link>
          </EmptyToolState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...byCurrency.entries()].map(([currency, values]) => {
              const mid = median(values);
              const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
              return (
                <div key={currency} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Scale className="h-3 w-3" /> {currency} observed
                  </div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums">{money(mid, currency)}</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Median midpoint across {values.length} role{values.length === 1 ? "" : "s"}. Average {money(average, currency)}.</p>
                  {values.length < 3 && <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-300">Too few roles to read as a market signal.</p>}
                </div>
              );
            })}
            {!byCurrency.size && (
              <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                None of your saved roles has a salary range yet. Open a role and add one, or paste a posting that includes a range.
              </div>
            )}
          </div>
        )}
      </ToolCard>

      {jobs.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
            <TrendingUp className="h-3.5 w-3.5 text-forge-600" />
            <span className="text-xs font-semibold">Ranges by role</span>
          </div>
          <div className="divide-y">
            {rows.map((row) => (
              <div key={row.job.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{row.job.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{row.job.company}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={row.source === "entered" ? "forge" : row.source === "posting" ? "info" : "outline"}>
                    {row.source === "entered" ? "Entered by you" : row.source === "posting" ? "From posting" : "No range"}
                  </Badge>
                  <span className={cn("min-w-[150px] text-right text-xs tabular-nums", row.source === "none" ? "text-muted-foreground" : "font-medium")}>
                    {row.source === "none"
                      ? "Add a range"
                      : row.min !== null && row.max !== null
                        ? `${money(row.min, row.currency)} to ${money(row.max, row.currency)}`
                        : money(row.min ?? row.max ?? 0, row.currency)}
                  </span>
                  <Link href={`/jobs/${row.job.id}`} className="text-forge-700 hover:underline dark:text-forge-300">
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Salary data here is only what you saved. Treat a small sample as a conversation starter, not a benchmark. For market data, use a source that publishes its method and sample size.
      </p>
    </div>
  );
}
