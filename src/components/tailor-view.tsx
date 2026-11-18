"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { diffWords } from "diff";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorPanel, LoadingPanel } from "@/components/load-state";
import { FactCheckList } from "@/components/fact-check-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadExport, errorMessage, factCheckFromError } from "@/lib/client";
import type { CommitTailorResponse, TailorResponse } from "@/lib/api-types";
import type { JobSummaryDto, ResumeDetailDto } from "@/lib/serializers";
import type { FactCheckResult, TailorChange } from "@/lib/types";
import { scoreTone } from "@/lib/utils";
import { toast } from "sonner";

const changeLabels: Record<string, string> = {
  summary: "Summary",
  bullet_rewrite: "Bullet rewrite",
  bullet_reorder: "Bullet order",
  section_reorder: "Section order",
  skills_reorder: "Skills order",
  experience_reorder: "Role order",
  keyword_insert: "Keyword wording",
};

export function TailorView({ resumeId, initialJobId = "none" }: { resumeId: string; initialJobId?: string }) {
  const [resume, setResume] = useState<ResumeDetailDto | null>(null);
  const [jobs, setJobs] = useState<JobSummaryDto[]>([]);
  const [selectedJob, setSelectedJob] = useState(initialJobId);
  const [jdText, setJdText] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [useLlm, setUseLlm] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TailorResponse["result"] | null>(null);
  const [base, setBase] = useState<TailorResponse["base"] | null>(null);
  const [design, setDesign] = useState<TailorResponse["design"] | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitTailorResponse | null>(null);
  const [confirmations, setConfirmations] = useState<string[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportFactCheck, setExportFactCheck] = useState<FactCheckResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumeResponse, jobsResponse] = await Promise.all([
        api<{ resume: ResumeDetailDto }>(`/api/resumes/${resumeId}`),
        api<{ jobs: JobSummaryDto[] }>("/api/jobs"),
      ]);
      setResume(resumeResponse.resume);
      setJobs(jobsResponse.jobs);
      if (initialJobId === "none" && jobsResponse.jobs.length) setSelectedJob("none");
      const active = jobsResponse.jobs.find((job) => job.id === selectedJob);
      setLabel(active ? `${active.company} ${active.title}` : `Tailored ${new Date().toISOString().slice(0, 10)}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [resumeId, initialJobId, selectedJob]);

  useEffect(() => {
    void load();
    // Load once. Selection changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  const selected = useMemo(() => jobs.find((job) => job.id === selectedJob) ?? null, [jobs, selectedJob]);

  async function runTailor() {
    if (selectedJob === "none" && jdText.trim().length < 80) {
      toast.error("Choose a saved job or paste a job description first.");
      return;
    }
    setRunning(true);
    setCommitResult(null);
    setExportFactCheck(null);
    try {
      const response = await api<TailorResponse>(`/api/resumes/${resumeId}/tailor`, {
        method: "POST",
        body: JSON.stringify({
          jobId: selectedJob === "none" ? undefined : selectedJob,
          jdText: selectedJob === "none" ? jdText.trim() : undefined,
          company: selectedJob === "none" ? company.trim() || undefined : undefined,
          title: selectedJob === "none" ? role.trim() || undefined : undefined,
          useLlm,
        }),
      });
      setResult(response.result);
      setBase(response.base);
      setDesign(response.design);
      setAccepted(new Set(response.result.changes.map((change) => change.id)));
      setLabel(
        selectedJob !== "none"
          ? `${selected?.company ?? response.result.job.company} ${selected?.title ?? response.result.job.role}`
          : `Tailored ${new Date().toISOString().slice(0, 10)}`,
      );
      toast.success(`Draft ready with ${response.result.changes.length} change${response.result.changes.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  function toggle(id: string) {
    setAccepted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function commit() {
    if (!result) return;
    if (!accepted.size) {
      toast.error("Accept at least one change to save a version.");
      return;
    }
    setCommitting(true);
    try {
      const response = await api<CommitTailorResponse>(`/api/resumes/${resumeId}/tailor/commit`, {
        method: "POST",
        body: JSON.stringify({
          jobId: selectedJob === "none" ? undefined : selectedJob,
          label: label.trim() || "Tailored version",
          acceptedChangeIds: [...accepted],
          changes: result.changes,
        }),
      });
      setCommitResult(response);
      setLabel(response.version.label);
      toast.success("Tailored version saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCommitting(false);
    }
  }

  async function download(format: "pdf" | "docx" | "txt") {
    if (!commitResult) return;
    setExporting(format);
    setExportFactCheck(null);
    try {
      await downloadExport(
        `/api/resumes/${resumeId}/export`,
        { format, versionId: commitResult.version.id, confirmations },
        `resume.${format}`,
      );
      toast.success("Download ready.");
    } catch (err) {
      const check = factCheckFromError(err);
      if (check) setExportFactCheck(check);
      toast.error(errorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tailor" description="Loading your resume and saved roles." />
        <LoadingPanel label="Loading tailoring workspace" />
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tailor" description="The resume could not be loaded." />
        <ErrorPanel message={error ?? "Resume not found."} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/resumes/${resumeId}/editor`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the editor
        </Link>
      </div>

      <PageHeader
        eyebrow="Tailoring"
        title="Tailor without inventing"
        description="The engine proposes changes that stay inside your evidence. You accept each line or leave it out."
        actions={
          <Button variant="forge" onClick={() => void runTailor()} disabled={running}>
            {running ? <Loader2 className="animate-spin" /> : <Sparkles />} {running ? "Reading the role..." : result ? "Run again" : "Tailor this resume"}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-forge-600" /> Target role</h2>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Saved job</Label>
                <Select value={selectedJob} onValueChange={setSelectedJob}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Paste a description instead</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>{job.title} at {job.company}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedJob === "none" ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Company</Label>
                      <Input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Northwind Labs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Role title</Label>
                      <Input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Product Analyst" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Job description</Label>
                    <Textarea value={jdText} onChange={(event) => setJdText(event.target.value)} placeholder="Paste the full description here." className="min-h-[220px]" />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <div className="font-medium">{selected?.title}</div>
                  <div className="text-muted-foreground">{selected?.company}{selected?.location ? ` | ${selected.location}` : ""}</div>
                  <Link href={`/jobs/${selected?.id}`} className="mt-2 inline-flex items-center gap-1 text-forge-700 underline underline-offset-4 dark:text-forge-300">
                    Open the application <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              <label className="flex items-start gap-2 rounded-lg border p-3 text-xs">
                <Checkbox checked={useLlm} onCheckedChange={(value) => setUseLlm(value === true)} className="mt-0.5" />
                <span>
                  <span className="font-medium text-foreground">Use the AI reviewer</span>
                  <span className="block text-muted-foreground">It adds judgment, but every change still passes the fact guard. Turn it off to use only the rules engine.</span>
                </span>
              </label>

              <Button className="w-full" variant="forge" onClick={() => void runTailor()} disabled={running}>
                {running ? <Loader2 className="animate-spin" /> : <Sparkles />} {running ? "Building the draft..." : "Build the draft"}
              </Button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                The base resume is never overwritten. Accepting changes saves a separate tailored version.
              </p>
            </div>
          </div>

          {result && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Score movement</h2>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-center">
                  <div className={`text-3xl font-semibold tabular-nums ${scoreTone(result.scoreBefore).className}`}>{result.scoreBefore}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">before</div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <div className={`text-3xl font-semibold tabular-nums ${scoreTone(result.scoreAfter).className}`}>{result.scoreAfter}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">after</div>
                </div>
                <Badge variant={result.generatedBy === "llm" ? "forge" : "outline"}>{result.generatedBy === "llm" ? "AI plus rules" : "Rules only"}</Badge>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Covered keywords</span>
                  <span className="font-medium">{result.coveredKeywords.length}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Still missing</span>
                  <span className="font-medium">{result.uncoveredKeywords.length}</span>
                </div>
              </div>
              {result.uncoveredKeywords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {result.uncoveredKeywords.slice(0, 10).map((keyword) => <Badge key={keyword} variant="outline">{keyword}</Badge>)}
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!result ? (
            <div className="rounded-xl border border-dashed bg-card/40 p-10 text-center">
              <Sparkles className="mx-auto h-7 w-7 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold">Your diff will appear here</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Pick a target and run the tailor. Every proposed edit keeps a source line, a reason and a risk level.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
                <div>
                  <h2 className="text-sm font-semibold">Review changes</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{accepted.size} of {result.changes.length} accepted</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAccepted(new Set(result.changes.map((change) => change.id)))}>
                    <CheckCheck /> Accept all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAccepted(new Set())}>
                    <X /> Clear
                  </Button>
                </div>
              </div>

              {result.changes.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <ShieldCheck className="mb-1 h-4 w-4" />
                  <p className="font-medium">No safe change was found.</p>
                  <p className="mt-1 text-xs opacity-80">Your resume already matches the role as far as the evidence allows, or the wording risk was too high.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.changes.map((change) => (
                    <ChangeCard key={change.id} change={change} accepted={accepted.has(change.id)} onToggle={() => toggle(change.id)} />
                  ))}
                </div>
              )}

              {result.changes.length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="text-sm font-semibold">Save the accepted version</h3>
                  <div className="mt-3 space-y-1.5">
                    <Label className="text-xs">Version label</Label>
                    <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Company role, date" />
                  </div>
                  <Button className="mt-3 w-full" variant="forge" onClick={() => void commit()} disabled={committing || !accepted.size}>
                    {committing ? <Loader2 className="animate-spin" /> : <Check />} {committing ? "Saving version..." : `Save ${accepted.size} change${accepted.size === 1 ? "" : "s"} as a version`}
                  </Button>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    The fact check runs on save. Export is blocked until every unsupported claim is fixed or confirmed.
                  </p>
                </div>
              )}

              {commitResult && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{commitResult.version.label}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Saved version, score {commitResult.score}. Base resume untouched.</p>
                    </div>
                    {selectedJob !== "none" && selected && (
                      <Link href={`/jobs/${selected.id}`}>
                        <Button size="sm" variant="outline">Back to application</Button>
                      </Link>
                    )}
                  </div>
                  <div className="mt-4">
                    <FactCheckList
                      result={commitResult.factCheck}
                      onConfirm={(fingerprint) => setConfirmations((current) => [...new Set([...current, fingerprint])])}
                    />
                  </div>
                  {exportFactCheck && (
                    <div className="mt-4">
                      <FactCheckList
                        result={exportFactCheck}
                        onConfirm={(fingerprint) => setConfirmations((current) => [...new Set([...current, fingerprint])])}
                        onRecheck={() => void download("docx")}
                      />
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                    <Button size="sm" variant="forge" onClick={() => void download("pdf")} disabled={exporting !== null}>
                      {exporting === "pdf" ? <Loader2 className="animate-spin" /> : <Download />} PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void download("docx")} disabled={exporting !== null}>
                      {exporting === "docx" ? <Loader2 className="animate-spin" /> : <FileText />} DOCX
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void download("txt")} disabled={exporting !== null}>
                      {exporting === "txt" ? <Loader2 className="animate-spin" /> : <FileText />} TXT
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChangeCard({ change, accepted, onToggle }: { change: TailorChange; accepted: boolean; onToggle: () => void }) {
  const parts = useMemo(() => diffWords(change.before || "", change.after || ""), [change.before, change.after]);
  return (
    <div className={`rounded-xl border p-4 transition ${accepted ? "border-forge-300 bg-forge-50/20 dark:border-forge-800 dark:bg-forge-950/20" : "bg-card opacity-80"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <label className="flex items-start gap-2.5">
          <Checkbox checked={accepted} onCheckedChange={onToggle} className="mt-0.5" />
          <span>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold">{changeLabels[change.kind] ?? change.kind}</span>
              <Badge variant={change.risk === "high" ? "destructive" : change.risk === "medium" ? "warning" : "outline"}>{change.risk} risk</Badge>
              <Badge variant="secondary">{change.section}</Badge>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{change.rationale}</span>
          </span>
        </label>
        <span className="text-[10px] text-muted-foreground">Source: {change.source}</span>
      </div>

      {(change.before || change.after) && (
        <div className="mt-3 rounded-lg border bg-card p-3 text-xs leading-relaxed">
          {parts.map((part, index) =>
            part.added ? (
              <ins key={index} className="bg-emerald-100 text-emerald-900 no-underline dark:bg-emerald-950/60 dark:text-emerald-200">{part.value}</ins>
            ) : part.removed ? (
              <del key={index} className="bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200">{part.value}</del>
            ) : (
              <span key={index}>{part.value}</span>
            ),
          )}
        </div>
      )}

      {change.kind.includes("reorder") && change.beforeOrder && change.afterOrder && (
        <div className="mt-2 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
          <div><span className="font-medium text-foreground">Before: </span>{change.beforeOrder.length} items</div>
          <div><span className="font-medium text-foreground">After: </span>{change.afterOrder.length} items, reordered for relevance</div>
        </div>
      )}
    </div>
  );
}
