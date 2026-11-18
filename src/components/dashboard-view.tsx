"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  FileText,
  KanbanSquare,
  Layers,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ErrorPanel, LoadingPanel } from "@/components/load-state";
import { IssueCard } from "@/components/issue-card";
import { ScoreRing } from "@/components/score-ring";
import { ScoreSparkline } from "@/components/score-sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api, errorMessage } from "@/lib/client";
import type { DashboardDto } from "@/lib/serializers";
import { applicationStatuses, statusLabels } from "@/lib/status";
import { pluralize, relativeTime, scoreTone } from "@/lib/utils";

export function DashboardView() {
  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<DashboardDto>("/api/dashboard"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Your resume scores, applications and next fixes in one place." />
        <LoadingPanel label="Loading your workspace" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Your resume scores, applications and next fixes in one place." />
        <ErrorPanel message={error} onRetry={() => void load()} />
      </div>
    );
  }

  const resumes = data?.resumes ?? [];
  const active = data?.activeResume ?? null;
  const analysis = data?.latestAnalysis ?? null;
  const tone = analysis ? scoreTone(analysis.score) : null;

  const pipeline = applicationStatuses.map((status) => ({
    status,
    count: (data?.jobs ?? []).filter((job) => job.status === status).length,
  }));

  if (!resumes.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Start with the resume you already have. The first score takes about a minute."
          actions={
            <Link href="/onboarding">
              <Button variant="forge">
                <Plus /> New resume
              </Button>
            </Link>
          }
        />
        <EmptyState
          icon={FileText}
          title="No resume yet"
          description="Upload a PDF or DOCX, or paste your text. We will show you exactly what an ATS reads before scoring anything."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/onboarding">
                <Button variant="forge">
                  <Plus /> Add your resume
                </Button>
              </Link>
              <Link href="/tools">
                <Button variant="outline">
                  <Wand2 /> Explore the tools
                </Button>
              </Link>
            </div>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "See what the ATS sees", body: "Plain text extraction, parse risks and eight score dimensions.", icon: FileSearch },
            { title: "Tailor without inventing", body: "Every tailored line keeps a source trace from your own text.", icon: ShieldCheck },
            { title: "Track the whole search", body: "Applications, gaps, interviews and versions live together.", icon: KanbanSquare },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border bg-card p-5">
              <item.icon className="h-5 w-5 text-forge-600 dark:text-forge-400" />
              <h2 className="mt-3 text-sm font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="Dashboard"
        description={active ? `Your primary resume is ${active.title}.` : "Your resume workspace."}
        actions={
          <>
            <Link href="/onboarding">
              <Button variant="outline">
                <Plus /> New resume
              </Button>
            </Link>
            {active && (
              <Link href={`/resumes/${active.id}/editor`}>
                <Button variant="forge">
                  <Sparkles /> Open editor
                </Button>
              </Link>
            )}
          </>
        }
      />

      {error && <ErrorPanel message={error} onRetry={() => void load()} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow">ATS score</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{analysis ? analysis.score : "No score"}</div>
              <p className="mt-1 text-xs text-muted-foreground">{analysis ? tone?.label : "Run your first analysis"}</p>
            </div>
            <Target className="h-5 w-5 text-forge-600 dark:text-forge-400" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow">Resumes</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{resumes.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">{resumes.length === 1 ? "1 active document" : `${resumes.length} active documents`}</p>
            </div>
            <FileText className="h-5 w-5 text-forge-600 dark:text-forge-400" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow">Applications</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{data?.jobs.length ?? 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {pipeline.find((p) => p.status === "INTERVIEW")?.count ?? 0} in interview
              </p>
            </div>
            <KanbanSquare className="h-5 w-5 text-forge-600 dark:text-forge-400" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow">Skill gaps</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{data?.gapCount ?? 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">{data?.plannedProjects ?? 0} projects planned</p>
            </div>
            <Layers className="h-5 w-5 text-forge-600 dark:text-forge-400" />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="space-y-5">
          <div className="rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <h2 className="text-base font-semibold">Latest report</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {analysis?.generatedBy === "llm" ? "Rules engine plus AI review" : "Deterministic rules engine"}
                  {analysis?.meta.hasJd ? " against your target role" : " for general ATS readiness"}
                </p>
              </div>
              {active && (
                <Link href={`/resumes/${active.id}/analyze`}>
                  <Button size="sm" variant="outline">
                    Full report <ArrowRight />
                  </Button>
                </Link>
              )}
            </div>
            {analysis && active ? (
              <div className="grid gap-5 p-5 md:grid-cols-[150px_1fr]">
                <div className="flex flex-col items-center gap-2">
                  <ScoreRing score={analysis.score} />
                  <span className={`text-xs font-semibold ${tone?.className ?? ""}`}>{tone?.label}</span>
                  <span className="text-[11px] text-muted-foreground">{analysis.meta.wordCount} words, about {analysis.meta.estimatedPages} page{analysis.meta.estimatedPages === 1 ? "" : "s"}</span>
                </div>
                <div className="space-y-2.5">
                  {analysis.breakdown.map((dimension) => (
                    <div key={dimension.key}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium">{dimension.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {dimension.score}/{dimension.max}
                        </span>
                      </div>
                      <Progress value={(dimension.score / Math.max(1, dimension.max)) * 100} className="mt-1 h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-5">
                <p className="text-sm text-muted-foreground">No analysis has been run on this resume yet.</p>
                {active && (
                  <Link href={`/resumes/${active.id}/analyze`} className="mt-3 inline-block">
                    <Button size="sm" variant="forge">
                      <Target /> Run the first analysis
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Fix these first</h2>
              {active && (
                <Link href={`/resumes/${active.id}/analyze`} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  See all issues
                </Link>
              )}
            </div>
            {(data?.topFixes ?? []).length ? (
              <div className="grid gap-3">
                {data?.topFixes.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} compact />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <ShieldCheck className="mb-1 h-4 w-4" />
                <p className="font-medium">No open blockers in the last report.</p>
                <p className="mt-1 text-xs opacity-80">Run the analysis again after your next edit to confirm.</p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Resumes</h2>
              <Link href="/resumes" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                Manage all
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {resumes.slice(0, 4).map((resume) => (
                <Link key={resume.id} href={`/resumes/${resume.id}/editor`} className="group rounded-xl border bg-card p-4 transition hover:border-forge-300 dark:hover:border-forge-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{resume.title}</span>
                        {resume.isPrimary && <Badge variant="forge">Primary</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{pluralize(resume.versionCount, "version")}, {pluralize(resume.gapCount, "gap")}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">Updated {relativeTime(resume.updatedAt)}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold tabular-nums">{resume.latestScore ?? "Not scored"}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">latest</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Score trend</h2>
              <Badge variant="outline">Last 12 runs</Badge>
            </div>
            <div className="mt-3">
              <ScoreSparkline points={data?.scoreHistory ?? []} className="h-20 w-full" />
            </div>
            {analysis && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Last scored {relativeTime(analysis.createdAt)}.
              </p>
            )}
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Pipeline</h2>
              <Link href="/jobs" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                Open tracker
              </Link>
            </div>
            <div className="mt-4 space-y-2.5">
              {pipeline.map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{statusLabels[row.status]}</span>
                  <span className="tabular-nums font-medium">{row.count}</span>
                </div>
              ))}
            </div>
            <Link href="/jobs" className="mt-4 block">
              <Button variant="outline" className="w-full">
                <KanbanSquare /> Manage applications
              </Button>
            </Link>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Saved applications</h2>
            {(data?.jobs ?? []).length ? (
              <div className="mt-3 space-y-2">
                {data?.jobs.slice(0, 4).map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-lg border p-2.5 transition hover:bg-accent">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">{job.title}</span>
                      <Badge variant="secondary">{statusLabels[job.status]}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{job.company}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No applications saved yet.</p>
            )}
            <Link href="/jobs" className="mt-3 block">
              <Button variant="ghost" size="sm" className="w-full">
                <Plus /> Add a role
              </Button>
            </Link>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-forge-50 to-card p-5 dark:from-forge-950/40 dark:to-card">
            <Sparkles className="h-5 w-5 text-forge-600 dark:text-forge-400" />
            <h2 className="mt-2 text-sm font-semibold">One page fit check</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Open the editor and use Fit to one page. It tightens spacing, not content.
            </p>
            {active && (
              <Link href={`/resumes/${active.id}/editor`} className="mt-3 block">
                <Button variant="forge" size="sm" className="w-full">
                  <FileText /> Open editor
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
