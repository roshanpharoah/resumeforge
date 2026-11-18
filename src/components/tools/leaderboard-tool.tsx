"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyToolState, ToolCard } from "@/components/tools/tool-ui";
import { api, errorMessage } from "@/lib/client";
import type { LeaderboardResponse } from "@/lib/api-types";
import { scoreTone } from "@/lib/utils";
import { toast } from "sonner";

export function LeaderboardTool({ resumeId }: { resumeId: string }) {
  const [results, setResults] = useState<LeaderboardResponse["results"] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const response = await api<LeaderboardResponse>(`/api/resumes/${resumeId}/leaderboard`, {
        method: "POST",
        body: JSON.stringify({ resumeId }),
      });
      setResults(response.results);
      if (!response.results.length) toast.message("No saved jobs to score yet.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <ToolCard
        title="Compare saved jobs"
        description="One resume, every saved role. Scores are deterministic and use the same eight dimensions as the analyzer."
        action={
          <Button variant="forge" onClick={() => void run()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Trophy />} {loading ? "Scoring..." : "Score saved jobs"}
          </Button>
        }
      >
        <div className="rounded-lg border bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Up to twelve recent roles are scored. Each row also updates the match score shown in the tracker.
        </div>
      </ToolCard>

      {!results && !loading && (
        <ToolCard title="Results">
          <EmptyToolState title="No ranking yet" description="Save a few roles first, then score them against this resume. The list is sorted by fit.">
            <Link href="/jobs"><Button variant="outline" size="sm">Go to applications <ArrowUpRight /></Button></Link>
          </EmptyToolState>
        </ToolCard>
      )}

      {loading && (
        <ToolCard title="Results">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-forge-600" /> Reading each job description...
          </div>
        </ToolCard>
      )}

      {results && !loading && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-[42px_1fr_74px_110px] gap-3 border-b bg-muted/40 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid-cols-[42px_1.4fr_1fr_74px_110px]">
            <span>Rank</span>
            <span>Role</span>
            <span className="hidden sm:block">Missing must haves</span>
            <span>Coverage</span>
            <span className="text-right">Score</span>
          </div>
          {results.map((row, index) => {
            const tone = scoreTone(row.score);
            return (
              <div key={`${row.company}-${row.title}-${index}`} className="grid grid-cols-[42px_1fr_74px_110px] items-center gap-3 border-b px-4 py-3 last:border-0 sm:grid-cols-[42px_1.4fr_1fr_74px_110px]">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${index === 0 ? "bg-forge-100 text-forge-800 dark:bg-forge-950 dark:text-forge-200" : "bg-muted text-muted-foreground"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{row.title || "Untitled role"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{row.company || "Unknown company"}</div>
                  {row.jobId && (
                    <Link href={`/jobs/${row.jobId}`} className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-forge-700 hover:underline dark:text-forge-300">
                      Open application <ArrowUpRight className="h-2.5 w-2.5" />
                    </Link>
                  )}
                </div>
                <div className="hidden flex-wrap gap-1 sm:flex">
                  {row.missingTop.length ? row.missingTop.slice(0, 3).map((keyword) => (
                    <Badge key={keyword} variant="outline" className="text-[10px]">{keyword}</Badge>
                  )) : <span className="text-[11px] text-muted-foreground">None</span>}
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{Math.round(row.mustHaveCoverage)}%</span>
                <span className={`text-right text-lg font-semibold tabular-nums ${tone.className}`}>{row.score}</span>
              </div>
            );
          })}
          {!results.length && (
            <div className="p-6 text-center text-xs text-muted-foreground">No saved jobs were available to score.</div>
          )}
        </div>
      )}
    </div>
  );
}
