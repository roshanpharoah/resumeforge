"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Eye,
  FileSearch,
  Layers,
  ListChecks,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorPanel, LoadingPanel } from "@/components/load-state";
import { IssueCard } from "@/components/issue-card";
import { ScoreRing } from "@/components/score-ring";
import { SeverityBadge } from "@/components/severity-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/client";
import { setByPath } from "@/lib/client";
import type { AnalyzeResponse, LeaderboardResponse } from "@/lib/api-types";
import type { AnalysisResult, AnalysisIssue, ParseRisk } from "@/lib/types";
import type { JobSummaryDto, ResumeDetailDto } from "@/lib/serializers";
import { scoreTone } from "@/lib/utils";
import { toast } from "sonner";

export function AnalyzeView({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const [resume, setResume] = useState<ResumeDetailDto | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [jobs, setJobs] = useState<JobSummaryDto[]>([]);
  const [selectedJob, setSelectedJob] = useState("none");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse["results"] | null>(null);
  const [ranking, setRanking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumeResponse, analysisResponse, jobsResponse] = await Promise.all([
        api<{ resume: ResumeDetailDto }>(`/api/resumes/${resumeId}`),
        api<{ analysis: AnalysisResult | null; report: { jobId: string | null } | null }>(`/api/resumes/${resumeId}/analysis`),
        api<{ jobs: JobSummaryDto[] }>("/api/jobs"),
      ]);
      setResume(resumeResponse.resume);
      setAnalysis(analysisResponse.analysis);
      setJobs(jobsResponse.jobs);
      const reportJobId = analysisResponse.report?.jobId;
      setSelectedJob(reportJobId && jobsResponse.jobs.some((job) => job.id === reportJobId) ? reportJobId : "none");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [resumeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAnalysis(jobId = selectedJob) {
    setRunning(true);
    try {
      const response = await api<AnalyzeResponse>(`/api/resumes/${resumeId}/analyze`, {
        method: "POST",
        body: JSON.stringify({
          jobId: jobId === "none" ? undefined : jobId,
          includeLlm: true,
        }),
      });
      setAnalysis(response.analysis);
      if (response.gaps.length) toast.success(`Report ready. ${response.gaps.length} gaps found.`);
      else toast.success("Report ready.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  async function applyFix(issue: AnalysisIssue) {
    if (!resume) return;
    const patch = issue.fix.patch;
    if (!patch) return;
    if (patch.op === "replace_text" || patch.op === "fill_placeholder") {
      let value = patch.op === "replace_text" ? patch.value : "";
      if (patch.op === "fill_placeholder") {
        const answer = window.prompt(patch.prompt);
        if (!answer?.trim()) return;
        value = answer.trim();
      }
      setFixing(issue.id);
      try {
        const nextData = setByPath(resume.data, patch.path, value);
        const response = await api<{ resume: ResumeDetailDto }>(`/api/resumes/${resumeId}`, {
          method: "PATCH",
          body: JSON.stringify({ data: nextData }),
        });
        setResume(response.resume);
        toast.success("Change saved. Rescoring now.");
        await runAnalysis();
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setFixing(null);
      }
      return;
    }

    if (patch.op === "open_tool") {
      switch (patch.tool) {
        case "summary":
          router.push(`/resumes/${resumeId}/editor?tab=content`);
          return;
        case "design":
        case "one-page":
          router.push(`/resumes/${resumeId}/editor?tab=design`);
          return;
        case "upload":
          router.push("/onboarding");
          return;
        case "proofread":
          router.push("/tools?tab=proofread");
          return;
        case "bullet-rewrite":
          router.push(`/resumes/${resumeId}/editor?tab=content`);
          return;
        case "gap-analysis":
          if (analysis?.meta.hasJd && analysis.keywords) {
            const target = jobs.find((job) => job.matchScore === analysis.score);
            router.push(target ? `/jobs/${target.id}` : "/jobs");
          } else {
            router.push("/jobs");
          }
          return;
        default:
          router.push(`/resumes/${resumeId}/editor`);
      }
      return;
    }

    if (patch.op === "add_section") {
      router.push(`/resumes/${resumeId}/editor?tab=content`);
      return;
    }
    if (patch.op === "set_heading") {
      router.push(`/resumes/${resumeId}/editor?tab=content`);
      return;
    }
  }

  async function rankJobs() {
    setRanking(true);
    try {
      const response = await api<LeaderboardResponse>(`/api/resumes/${resumeId}/leaderboard`, {
        method: "POST",
        body: JSON.stringify({ jobs: [] }),
      });
      setLeaderboard(response.results);
      if (!response.results.length) toast.error("Add a job description before ranking roles.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRanking(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="ATS report" description="Loading your resume and latest report." />
        <LoadingPanel label="Loading the report" />
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="space-y-6">
        <PageHeader title="ATS report" description="The resume could not be loaded." />
        <ErrorPanel message={error ?? "Resume not found."} onRetry={() => void load()} />
      </div>
    );
  }

  const tone = analysis ? scoreTone(analysis.score) : null;
  const parseRisks = (resume.parseRisks as unknown as ParseRisk[]) ?? [];
  const highRisks = parseRisks.filter((risk) => risk.severity !== "info");
  const keywordCoverage = analysis?.keywords;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ATS report"
        title={resume.title}
        description="Eight dimensions, one score, and every fix tied to a line you can change."
        actions={
          <>
            <Link href={`/resumes/${resumeId}/editor`}>
              <Button variant="outline">Open editor</Button>
            </Link>
            <Button variant="forge" onClick={() => void runAnalysis()} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <Play />} {running ? "Scoring..." : "Run analysis"}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <Target className="h-4 w-4 text-forge-600" />
        <span className="text-xs font-medium">Target role</span>
        <Select value={selectedJob} onValueChange={setSelectedJob}>
          <SelectTrigger className="h-8 w-[260px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">General ATS readiness, no job</SelectItem>
            {jobs.map((job) => (
              <SelectItem key={job.id} value={job.id}>{job.title} at {job.company}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => void runAnalysis()} disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <FileSearch />} Score this target
        </Button>
        <Link href="/jobs" className="ml-auto text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Manage saved roles
        </Link>
      </div>

      {!analysis ? (
        <div className="rounded-xl border border-dashed bg-card/40 p-10 text-center">
          <BarChart3 className="mx-auto h-7 w-7 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">No report yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Run the analyzer to see the score, dimension breakdown, keyword coverage and concrete fixes.</p>
          <Button variant="forge" className="mt-4" onClick={() => void runAnalysis()} disabled={running}>
            {running ? <Loader2 className="animate-spin" /> : <Play />} Run the first analysis
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.5fr]">
            <div className="rounded-xl border bg-card p-6">
              <div className="flex flex-col items-center text-center">
                <ScoreRing score={analysis.score} size={156} />
                <div className={`mt-3 text-sm font-semibold ${tone?.className ?? ""}`}>{tone?.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {analysis.generatedBy === "llm" ? "Rules score with AI review notes" : "Rules engine only"}
                </p>
                <div className="mt-4 grid w-full grid-cols-3 gap-2 border-t pt-4 text-center">
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{analysis.meta.wordCount}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">words</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{analysis.meta.bulletCount}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">bullets</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{analysis.meta.estimatedPages}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">pages</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Dimension breakdown</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {analysis.breakdown.map((dimension) => (
                  <div key={dimension.key} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{dimension.label}</span>
                      <span className="tabular-nums text-muted-foreground">{dimension.score}/{dimension.max}</span>
                    </div>
                    <Progress value={(dimension.score / Math.max(1, dimension.max)) * 100} className="mt-2 h-1.5" />
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{dimension.summary}</p>
                    {dimension.details.length > 0 && (
                      <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                        {dimension.details.slice(0, 2).map((detail) => <li key={detail}>{detail}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Tabs defaultValue="issues">
            <TabsList className="flex h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="issues"><ListChecks className="mr-1.5 h-3.5 w-3.5" /> Issues <Badge variant="outline" className="ml-1">{analysis.issues.length}</Badge></TabsTrigger>
              <TabsTrigger value="keywords"><Layers className="mr-1.5 h-3.5 w-3.5" /> Keywords</TabsTrigger>
              <TabsTrigger value="ats"><Eye className="mr-1.5 h-3.5 w-3.5" /> What the ATS sees</TabsTrigger>
              <TabsTrigger value="leaderboard"><Trophy className="mr-1.5 h-3.5 w-3.5" /> Multi-JD rank</TabsTrigger>
            </TabsList>

            <TabsContent value="issues" className="mt-4 space-y-3">
              {analysis.issues.length ? (
                analysis.issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} onFix={applyFix} fixing={fixing === issue.id} />
                ))
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <ShieldCheck className="mb-2 h-5 w-5" />
                  <p className="font-medium">No issues found in this pass.</p>
                  <p className="mt-1 text-xs opacity-80">Keep the resume current, then rescore after edits.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="keywords" className="mt-4 space-y-4">
              {keywordCoverage ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: "Must have coverage", value: keywordCoverage.mustHaveCoverage },
                      { label: "Nice to have", value: keywordCoverage.niceToHaveCoverage },
                      { label: "Hard skills", value: keywordCoverage.hardSkillCoverage },
                      { label: "Soft skills", value: keywordCoverage.softSkillCoverage },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border bg-card p-4">
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                        <div className="mt-1 text-2xl font-semibold tabular-nums">{item.value}%</div>
                        <Progress value={item.value} className="mt-2 h-1.5" />
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border bg-card p-5">
                      <h3 className="text-sm font-semibold">Matched keywords</h3>
                      {keywordCoverage.matched.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {keywordCoverage.matched.map((hit) => (
                            <Badge key={`${hit.keyword}-${hit.matchType}`} variant={hit.matchType === "exact" ? "success" : hit.matchType === "semantic" ? "info" : "secondary"}>
                              {hit.keyword}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No keywords matched yet.</p>
                      )}
                    </div>
                    <div className="rounded-xl border bg-card p-5">
                      <h3 className="text-sm font-semibold">Missing keywords</h3>
                      {keywordCoverage.missing.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {keywordCoverage.missing.map((hit) => (
                            <Badge key={hit.keyword} variant={hit.importance === "must" ? "destructive" : "outline"}>
                              {hit.keyword}{hit.importance === "must" ? " (must)" : ""}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">Every extracted keyword appears in your text.</p>
                      )}
                      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                        Do not paste a missing keyword when the experience is not real. Use the gap workflow to prove, reframe, build or learn it.
                      </p>
                      <Link href="/jobs" className="mt-2 inline-block text-xs text-forge-700 underline underline-offset-4 dark:text-forge-300">
                        Open a job and bridge the gap
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">
                  Add a target job description to unlock keyword coverage. The other seven dimensions still work without one.
                </div>
              )}
            </TabsContent>

            <TabsContent value="ats" className="mt-4 space-y-4">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Plain text extraction</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">This is the text an ATS receives. Formatting does not survive.</p>
                  </div>
                  <Badge variant={highRisks.length ? "warning" : "success"}>
                    {highRisks.length ? `${highRisks.length} layout risk${highRisks.length === 1 ? "" : "s"}` : "No layout risks detected"}
                  </Badge>
                </div>
                <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 font-mono text-[11px] leading-relaxed scrollbar-thin">
                  {resume.rawText || "No raw text saved for this resume."}
                </pre>
              </div>

              {parseRisks.length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-500" /> Parse risks</h3>
                  <div className="mt-3 space-y-2">
                    {parseRisks.map((risk) => (
                      <div key={risk.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={risk.severity} />
                          <span className="text-xs font-medium">{risk.label}</span>
                          <span className="text-[11px] text-muted-foreground">{risk.detectedIn}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{risk.detail}</p>
                        {risk.evidence && <p className="mt-1 font-mono text-[10px] text-muted-foreground">{risk.evidence}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="leaderboard" className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div>
                  <h3 className="text-sm font-semibold">Which saved role fits best?</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Scores this resume against every saved job description and ranks the results.</p>
                </div>
                <Button size="sm" variant="forge" onClick={() => void rankJobs()} disabled={ranking}>
                  {ranking ? <Loader2 className="animate-spin" /> : <Trophy />} {ranking ? "Ranking..." : "Rank saved jobs"}
                </Button>
              </div>

              {leaderboard ? (
                leaderboard.length ? (
                  <div className="overflow-hidden rounded-xl border bg-card">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Score</th>
                          <th className="hidden px-4 py-3 sm:table-cell">Must-have coverage</th>
                          <th className="hidden px-4 py-3 md:table-cell">Top missing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((row, index) => (
                          <tr key={`${row.company}-${row.title}-${index}`} className="border-t">
                            <td className="px-4 py-3">
                              <div className="font-medium">{row.title}</div>
                              <div className="text-xs text-muted-foreground">{row.company}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-lg font-semibold tabular-nums ${scoreTone(row.score).className}`}>{row.score}</span>
                            </td>
                            <td className="hidden px-4 py-3 sm:table-cell">{row.mustHaveCoverage}%</td>
                            <td className="hidden px-4 py-3 md:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {row.missingTop.slice(0, 4).map((keyword) => <Badge key={keyword} variant="outline">{keyword}</Badge>)}
                                {!row.missingTop.length && <span className="text-xs text-muted-foreground">None</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">
                    No saved job descriptions yet. Add roles in the tracker first.
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center">
                  <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">One resume, many roles</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Rank every saved role to decide where this version is strongest before you apply.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
