"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  Mail,
  MessageSquareQuote,
  Sparkles,
  Target,
  Trash2,
  UserRoundSearch,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorPanel, LoadingPanel } from "@/components/load-state";
import { FactCheckList } from "@/components/fact-check-list";
import { ResumePreview } from "@/components/resume-preview";
import { SeverityBadge } from "@/components/severity-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { api, errorMessage } from "@/lib/client";
import type { CoverLetterResponse, InterviewPrepResponse, LinkedInResponse, UpdateJobResponse } from "@/lib/api-types";
import type { GapDto, JobDetailDto, ResumeDetailDto, ResumeSummaryDto, VersionDto } from "@/lib/serializers";
import type { FactCheckResult, GapOptions } from "@/lib/types";
import { applicationStatuses, gapStatusLabels, statusLabels } from "@/lib/status";
import { cn, copyText, downloadBlob, relativeTime, scoreTone, slugifyFileName } from "@/lib/utils";
import { toast } from "sonner";
import { outreachTemplates } from "@/lib/outreach";

type JobDetailResponse = { job: JobDetailDto };

interface InterviewQuestionView {
  question: string;
  category: string;
  why: string;
  framework: string;
  talkingPoints: string[];
}

type GapTab = "already" | "reframe" | "build" | "learn";

export function JobDetailView({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobDetailDto | null>(null);
  const [resumes, setResumes] = useState<ResumeSummaryDto[]>([]);
  const [resume, setResume] = useState<ResumeDetailDto | null>(null);
  const [resumeId, setResumeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [gapTab, setGapTab] = useState<Record<string, GapTab>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [addToResume, setAddToResume] = useState<Record<string, boolean>>({});
  const [experienceId, setExperienceId] = useState("");
  const [gapFactCheck, setGapFactCheck] = useState<FactCheckResult | null>(null);

  const [salary, setSalary] = useState({ min: "", max: "", currency: "USD" });
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  const [coverLetter, setCoverLetter] = useState<CoverLetterResponse["coverLetter"] | null>(null);
  const [coverForm, setCoverForm] = useState({ hiringManager: "", tone: "direct" });
  const [interview, setInterview] = useState<InterviewQuestionView[]>(
    (Array.isArray((job?.interviewPrep as { questions?: InterviewQuestionView[] } | null)?.questions)
      ? ((job?.interviewPrep as { questions?: InterviewQuestionView[] }).questions ?? [])
      : []),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobResponse, resumeResponse] = await Promise.all([
        api<JobDetailResponse>(`/api/jobs/${jobId}`),
        api<{ resumes: ResumeSummaryDto[] }>("/api/resumes"),
      ]);
      setJob(jobResponse.job);
      setResumes(resumeResponse.resumes);
      const preferred = resumeResponse.resumes.find((item) => item.isPrimary) ?? resumeResponse.resumes[0];
      if (preferred) setResumeId(preferred.id);
      setSalary({
        min: jobResponse.job.salaryMin?.toString() ?? "",
        max: jobResponse.job.salaryMax?.toString() ?? "",
        currency: jobResponse.job.currency ?? "USD",
      });
      setNotes(jobResponse.job.notes ?? "");
      const prep = jobResponse.job.interviewPrep as { questions?: InterviewQuestionView[] } | null;
      if (prep?.questions?.length) setInterview(prep.questions);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!resumeId) return;
    let active = true;
    api<{ resume: ResumeDetailDto }>(`/api/resumes/${resumeId}`)
      .then((response) => {
        if (!active) return;
        setResume(response.resume);
        setExperienceId(response.resume.data.experience.find((exp) => exp.current)?.id ?? response.resume.data.experience[0]?.id ?? "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [resumeId]);

  async function patchJob(body: Record<string, unknown>, key: string) {
    if (!job) return;
    setBusy(key);
    try {
      const response = await api<UpdateJobResponse>(`/api/jobs/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setJob(response.job);
      toast.success("Application updated.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(status: string) {
    await patchJob({ status }, "status");
  }

  async function saveSalary() {
    await patchJob(
      {
        salaryMin: salary.min.trim() ? Number(salary.min) : null,
        salaryMax: salary.max.trim() ? Number(salary.max) : null,
        currency: salary.currency,
      },
      "salary",
    );
  }

  async function deleteJob() {
    if (!job) return;
    if (!window.confirm(`Delete the ${job.company} application? Its gaps, cover letters and interview prep will be removed.`)) return;
    setBusy("delete");
    try {
      await api(`/api/jobs/${job.id}`, { method: "DELETE" });
      toast.success("Application deleted.");
      window.location.href = "/jobs";
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  }

  async function generateGaps() {
    if (!job || !resumeId) {
      toast.error("Add a resume before generating gaps.");
      return;
    }
    setBusy("gaps");
    try {
      await api<{ gaps: GapDto[] }>(`/api/jobs/${job.id}/gaps`, {
        method: "POST",
        body: JSON.stringify({ resumeId, useLlm: true }),
      });
      const response = await api<JobDetailResponse>(`/api/jobs/${job.id}`);
      setJob(response.job);
      toast.success("Gap options are ready.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function answerGap(gap: GapDto) {
    const answer = answers[gap.id]?.trim();
    if (!answer) {
      toast.error("Write what you actually did first.");
      return;
    }
    setBusy(`answer:${gap.id}`);
    try {
      const response = await api<{ gap: GapDto; factCheck: FactCheckResult }>(`/api/gaps/${gap.id}/answer`, {
        method: "POST",
        body: JSON.stringify({
          questionId: gap.questions[0]?.id,
          answer,
          addToResume: Boolean(addToResume[gap.id]),
          experienceId: experienceId || undefined,
        }),
      });
      setGapFactCheck(response.factCheck);
      setAnswers((current) => ({ ...current, [gap.id]: "" }));
      await reloadJob();
      toast.success("Answer saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function reframeGap(gap: GapDto, index: number) {
    setBusy(`reframe:${gap.id}`);
    try {
      await api(`/api/gaps/${gap.id}/reframe`, {
        method: "POST",
        body: JSON.stringify({ index, experienceId: experienceId || undefined }),
      });
      await reloadJob();
      toast.success("Reframed bullet added to your resume.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function savePlan(gap: GapDto, status: "PLANNED" | "IN_PROGRESS" | "DONE", link: string, include: boolean) {
    setBusy(`plan:${gap.id}`);
    try {
      const response = await api<{ gap: GapDto; warning?: string }>(`/api/gaps/${gap.id}/plan`, {
        method: "POST",
        body: JSON.stringify({ gapId: gap.id, status, link, addToResume: include }),
      });
      await reloadJob();
      toast.success(response.warning ?? "Project plan saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function updateGapStatus(gap: GapDto, status: "OPEN" | "PLANNED" | "DONE" | "DISMISSED") {
    setBusy(`status:${gap.id}`);
    try {
      await api(`/api/gaps/${gap.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await reloadJob();
      toast.success("Gap updated.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function reloadJob() {
    const response = await api<JobDetailResponse>(`/api/jobs/${jobId}`);
    setJob(response.job);
  }

  async function generateCoverLetter() {
    if (!job) return;
    setBusy("cover");
    try {
      const response = await api<CoverLetterResponse>(`/api/jobs/${job.id}/cover-letter`, {
        method: "POST",
        body: JSON.stringify({
          jobId: job.id,
          resumeId: resumeId || undefined,
          hiringManager: coverForm.hiringManager.trim() || undefined,
          tone: coverForm.tone,
          useLlm: true,
        }),
      });
      setCoverLetter(response.coverLetter);
      await reloadJob();
      toast.success("Cover letter drafted.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function generateInterview() {
    if (!job) return;
    setBusy("interview");
    try {
      const response = await api<InterviewPrepResponse>(`/api/jobs/${job.id}/interview`, {
        method: "POST",
        body: JSON.stringify({ jobId: job.id, resumeId: resumeId || undefined, useLlm: true }),
      });
      setInterview(response.interview.questions);
      toast.success("Interview questions ready.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const outreach = useMemo(() => outreachTemplates(job?.company ?? "", job?.title ?? "", resume?.data.contact.fullName ?? ""), [job?.company, job?.title, resume?.data.contact.fullName]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Application" description="Loading the role, gaps and drafts." />
        <LoadingPanel label="Loading this application" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <PageHeader title="Application" description="The role could not be loaded." />
        <ErrorPanel message={error ?? "Application not found."} onRetry={() => void load()} />
        <Link href="/jobs">
          <Button variant="outline"><ArrowLeft /> Back to applications</Button>
        </Link>
      </div>
    );
  }

  const tone = job.matchScore !== null ? scoreTone(job.matchScore) : null;
  const extracted = job.extracted;
  const activeGaps = job.gaps.filter((gap) => gap.status !== "DISMISSED");
  const salaryMidpoint =
    job.salaryMin !== null && job.salaryMax !== null ? Math.round((job.salaryMin + job.salaryMax) / 2) : null;
  const currency = job.currency ?? "USD";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to applications
        </Link>
      </div>

      <PageHeader
        eyebrow={`${statusLabels[job.status as keyof typeof statusLabels] ?? job.status}${job.location ? ` | ${job.location}` : ""}`}
        title={job.title}
        description={`${job.company}. ${extracted?.seniority ? `${extracted.seniority} level. ` : ""}${extracted?.summary ?? ""}`}
        actions={
          <>
            <Select value={job.status} onValueChange={(value) => void changeStatus(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {applicationStatuses.map((status) => (
                  <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {job.url && (
              <a href={job.url} target="_blank" rel="noreferrer">
                <Button variant="outline"><ExternalLink /> Posting</Button>
              </a>
            )}
            {resumeId && (
              <Link href={`/resumes/${resumeId}/tailor?jobId=${job.id}`}>
                <Button variant="forge"><Sparkles /> Tailor resume</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="eyebrow">Match score</div>
          <div className={`mt-2 text-3xl font-semibold tabular-nums ${tone?.className ?? ""}`}>{job.matchScore ?? "Not scored"}</div>
          <p className="mt-1 text-xs text-muted-foreground">{tone?.label ?? "Run the analyzer against this role"}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="eyebrow">Resume</div>
          <div className="mt-2 text-sm font-semibold">{resume?.title ?? "No resume selected"}</div>
          <Select value={resumeId} onValueChange={setResumeId}>
            <SelectTrigger className="mt-2 h-8 text-xs"><SelectValue placeholder="Choose a resume" /></SelectTrigger>
            <SelectContent>
              {resumes.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="eyebrow">Open gaps</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{activeGaps.filter((gap) => gap.status !== "DONE").length}</div>
          <p className="mt-1 text-xs text-muted-foreground">{activeGaps.filter((gap) => gap.status === "DONE").length} closed</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="eyebrow">Versions</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{job.versions.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">Tailored copies saved</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gaps">Gaps <Badge variant="outline" className="ml-1">{activeGaps.length}</Badge></TabsTrigger>
          <TabsTrigger value="cover">Cover letter</TabsTrigger>
          <TabsTrigger value="interview">Interview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Job description</h2>
                <Badge variant="outline">{job.jdText.split(/\s+/).filter(Boolean).length} words</Badge>
              </div>
              <div className="mt-3 max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground scrollbar-thin">
                {job.jdText}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold">What the role asks for</h2>
                {extracted ? (
                  <div className="mt-3 space-y-3 text-xs">
                    {extracted.requiredSkills.length > 0 && (
                      <div>
                        <div className="font-medium text-foreground">Required</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {extracted.requiredSkills.slice(0, 18).map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                        </div>
                      </div>
                    )}
                    {extracted.preferredSkills.length > 0 && (
                      <div>
                        <div className="font-medium text-foreground">Preferred</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {extracted.preferredSkills.slice(0, 14).map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}
                        </div>
                      </div>
                    )}
                    {extracted.tools.length > 0 && (
                      <div>
                        <div className="font-medium text-foreground">Tools</div>
                        <p className="mt-1 text-muted-foreground">{extracted.tools.join(", ")}</p>
                      </div>
                    )}
                    {extracted.companyValues.length > 0 && (
                      <div>
                        <div className="font-medium text-foreground">Values language</div>
                        <p className="mt-1 text-muted-foreground">{extracted.companyValues.join(", ")}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No extracted requirements yet. Update the job description to refresh it.</p>
                )}
              </div>

              <div className="rounded-xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Landmark className="h-4 w-4 text-forge-600" /> Salary insights</h2>
                <div className="mt-3 grid grid-cols-[1fr_1fr_90px] gap-2">
                  <div>
                    <Label className="text-[11px]">Minimum</Label>
                    <Input type="number" value={salary.min} onChange={(event) => setSalary({ ...salary, min: event.target.value })} placeholder="90000" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Maximum</Label>
                    <Input type="number" value={salary.max} onChange={(event) => setSalary({ ...salary, max: event.target.value })} placeholder="120000" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Currency</Label>
                    <Input value={salary.currency} onChange={(event) => setSalary({ ...salary, currency: event.target.value.toUpperCase().slice(0, 3) })} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {salaryMidpoint ? `Midpoint ${currency} ${salaryMidpoint.toLocaleString()}. ` : ""}
                    Based on the range you enter or the posting, not external market data.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => void saveSalary()} disabled={busy === "salary"}>
                    {busy === "salary" ? <Loader2 className="animate-spin" /> : <Check />} Save
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Outreach templates</h2>
            <p className="mt-1 text-xs text-muted-foreground">Edit the bracketed parts before sending. These are starting points, not finished messages.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {outreach.map((template) => (
                <div key={template.label} className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="text-xs font-semibold">{template.label}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{template.body}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={async () => {
                      const ok = await copyText(template.body);
                      toast[ok ? "success" : "error"](ok ? "Template copied." : "Copy failed.");
                    }}
                  >
                    <Copy /> Copy
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Private notes</h2>
              <Button
                size="sm"
                variant="outline"
                disabled={!notesDirty || busy === "notes"}
                onClick={() => {
                  void patchJob({ notes }, "notes").then(() => setNotesDirty(false));
                }}
              >
                {busy === "notes" ? <Loader2 className="animate-spin" /> : <Check />} Save notes
              </Button>
            </div>
            <Textarea
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setNotesDirty(true);
              }}
              placeholder="Referral contact, recruiter email, questions to ask."
              className="mt-3 min-h-[100px]"
            />
          </div>
        </TabsContent>

        <TabsContent value="gaps" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div>
              <h2 className="text-sm font-semibold">Skill gap bridge</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Four honest paths: prove it, reframe it, build it or learn it. No invented claims.</p>
            </div>
            <Button variant="forge" size="sm" onClick={() => void generateGaps()} disabled={busy === "gaps" || !resumeId}>
              {busy === "gaps" ? <Loader2 className="animate-spin" /> : <Wand2 />} {busy === "gaps" ? "Analyzing..." : "Find gaps"}
            </Button>
          </div>

          {job.gaps.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center">
              <Target className="mx-auto h-6 w-6 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-semibold">No gaps analyzed yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Run the gap analysis to compare this role with your resume. Each missing must have gets a real plan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {job.gaps.map((gap) => {
                const options = gap.options as GapOptions | null;
                const tab = gapTab[gap.id] ?? "already";
                return (
                  <div key={gap.id} className="rounded-xl border bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{gap.skill}</h3>
                        <Badge variant={gap.importance === "must" ? "destructive" : "outline"}>{gap.importance === "must" ? "Must have" : "Nice to have"}</Badge>
                        <Badge variant="secondary" className="capitalize">{gap.category}</Badge>
                        <Badge variant={gap.status === "DONE" ? "success" : gap.status === "DISMISSED" ? "outline" : "warning"}>
                          {gapStatusLabels[gap.status] ?? gap.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {gap.status !== "DISMISSED" ? (
                          <Button size="sm" variant="ghost" onClick={() => void updateGapStatus(gap, "DISMISSED")} disabled={busy === `status:${gap.id}`}>
                            Dismiss
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => void updateGapStatus(gap, "OPEN")} disabled={busy === `status:${gap.id}`}>
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>

                    {gap.evidence && <div className="border-b bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">Evidence: {gap.evidence}</div>}

                    <div className="p-4">
                      <Tabs value={tab} onValueChange={(value) => setGapTab((current) => ({ ...current, [gap.id]: value as GapTab }))}>
                        <TabsList className="flex h-auto flex-wrap justify-start">
                          <TabsTrigger value="already">I may already have it</TabsTrigger>
                          <TabsTrigger value="reframe">Reframe existing work</TabsTrigger>
                          <TabsTrigger value="build">Build a project</TabsTrigger>
                          <TabsTrigger value="learn">Learn it</TabsTrigger>
                        </TabsList>

                        <TabsContent value="already" className="mt-3 space-y-3">
                          <p className="text-xs text-muted-foreground">{options?.mayAlreadyHave?.note ?? "Answer these honestly. If the work is real, we can add it with your own words."}</p>
                          <ul className="space-y-1.5 text-xs text-muted-foreground">
                            {(options?.mayAlreadyHave?.questions ?? gap.questions.map((question) => question.question)).map((question) => (
                              <li key={question} className="flex gap-2"><span className="text-forge-600">?</span> {question}</li>
                            ))}
                          </ul>
                          <Textarea
                            value={answers[gap.id] ?? ""}
                            onChange={(event) => setAnswers((current) => ({ ...current, [gap.id]: event.target.value }))}
                            placeholder="Describe what you actually did, where, and what changed. No guesses."
                            className="min-h-[90px]"
                          />
                          <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2 text-xs">
                              <Checkbox checked={Boolean(addToResume[gap.id])} onCheckedChange={(value) => setAddToResume((current) => ({ ...current, [gap.id]: value === true }))} />
                              Add this answer to my resume
                            </label>
                            {addToResume[gap.id] && resume && (
                              <Select value={experienceId} onValueChange={setExperienceId}>
                                <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                                <SelectContent>
                                  {resume.data.experience.map((experience) => (
                                    <SelectItem key={experience.id} value={experience.id}>
                                      {experience.title} at {experience.company}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Button size="sm" variant="forge" onClick={() => void answerGap(gap)} disabled={busy === `answer:${gap.id}`}>
                              {busy === `answer:${gap.id}` ? <Loader2 className="animate-spin" /> : <Check />} Save answer
                            </Button>
                          </div>
                          {gapFactCheck && <FactCheckList result={gapFactCheck} compact />}
                        </TabsContent>

                        <TabsContent value="reframe" className="mt-3 space-y-3">
                          {options?.reframe?.length ? (
                            options.reframe.map((option, index) => (
                              <div key={`${option.source}-${index}`} className="rounded-lg border p-3">
                                <div className="text-[11px] text-muted-foreground">Existing line</div>
                                <p className="mt-0.5 text-xs">{option.source}</p>
                                <div className="mt-2 text-[11px] text-muted-foreground">Reframed honestly</div>
                                <p className="mt-0.5 text-xs font-medium">{option.after}</p>
                                <Button size="sm" variant="outline" className="mt-2" onClick={() => void reframeGap(gap, index)} disabled={busy === `reframe:${gap.id}`}>
                                  {busy === `reframe:${gap.id}` ? <Loader2 className="animate-spin" /> : <ArrowRight />} Use this reframe
                                </Button>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">No reframe was found in your current text for this gap.</p>
                          )}
                        </TabsContent>

                        <TabsContent value="build" className="mt-3 space-y-3">
                          {options?.build ? (
                            <BuildPlan gap={gap} plan={options.build} busy={busy} onSave={savePlan} />
                          ) : (
                            <p className="text-xs text-muted-foreground">No project plan is available for this gap.</p>
                          )}
                        </TabsContent>

                        <TabsContent value="learn" className="mt-3 space-y-3">
                          <div>
                            <div className="text-xs font-medium">Learning path</div>
                            <ol className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                              {(options?.learn?.path ?? []).map((step, index) => (
                                <li key={step} className="flex gap-2"><span className="font-mono text-forge-600">{String(index + 1).padStart(2, "0")}</span> {step}</li>
                              ))}
                            </ol>
                          </div>
                          {options?.learn?.certifications?.length ? (
                            <div>
                              <div className="text-xs font-medium">Certifications to consider</div>
                              <div className="mt-1.5 space-y-2">
                                {options.learn.certifications.map((cert) => (
                                  <div key={cert.name} className="rounded-lg border p-3 text-xs">
                                    <div className="font-medium">{cert.name}</div>
                                    <div className="text-muted-foreground">{cert.provider}</div>
                                    <p className="mt-1 text-[11px] text-muted-foreground">{cert.note}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => void updateGapStatus(gap, "PLANNED")} disabled={busy === `status:${gap.id}`}>
                            {busy === `status:${gap.id}` ? <Loader2 className="animate-spin" /> : <Check />} Save as a learning plan
                          </Button>
                          <p className="text-[11px] text-muted-foreground">A course only goes on the resume when you finish it and can describe the work.</p>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cover" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Cover letter</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Generated from your resume and this job description. Check every claim before sending.</p>
              </div>
              <Button variant="forge" size="sm" onClick={() => void generateCoverLetter()} disabled={busy === "cover"}>
                {busy === "cover" ? <Loader2 className="animate-spin" /> : <Mail />} {busy === "cover" ? "Writing..." : "Generate draft"}
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Hiring manager name (optional)</Label>
                <Input value={coverForm.hiringManager} onChange={(event) => setCoverForm({ ...coverForm, hiringManager: event.target.value })} placeholder="Morgan Lee" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tone</Label>
                <Select value={coverForm.tone} onValueChange={(value) => setCoverForm({ ...coverForm, tone: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="curious">Curious</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {coverLetter ? (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="forge">{coverLetter.generatedBy === "llm" ? "AI draft" : "Rules draft"}</Badge>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const text = `${coverLetter.greeting}\n\n${coverLetter.content}`;
                      const ok = await copyText(text);
                      toast[ok ? "success" : "error"](ok ? "Cover letter copied." : "Copy failed.");
                    }}
                  >
                    <Copy /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadBlob(new Blob([`${coverLetter.greeting}\n\n${coverLetter.content}`], { type: "text/plain" }), `${slugifyFileName(`${job.company}-cover-letter`)}.txt`)}
                  >
                    <Download /> Download
                  </Button>
                </div>
              </div>
              <div className="mt-4 whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed">
                {coverLetter.greeting}
                {"\n\n"}
                {coverLetter.content}
              </div>
              <div className="mt-4">
                <FactCheckList result={coverLetter.factCheck} />
              </div>
            </div>
          ) : job.coverLetters.length ? (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold">Recent drafts</h3>
              <div className="mt-3 space-y-2">
                {job.coverLetters.map((letter) => (
                  <div key={letter.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <Badge variant="outline">{letter.tone}</Badge>
                      <span className="text-muted-foreground">{relativeTime(letter.createdAt)}</span>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{letter.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No cover letter yet. Generate a draft when you are ready to review it line by line.
            </div>
          )}
        </TabsContent>

        <TabsContent value="interview" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div>
              <h2 className="text-sm font-semibold">Interview prep</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Questions grounded in this role, your resume and the gaps you need to address.</p>
            </div>
            <Button variant="forge" size="sm" onClick={() => void generateInterview()} disabled={busy === "interview"}>
              {busy === "interview" ? <Loader2 className="animate-spin" /> : <MessageSquareQuote />} {busy === "interview" ? "Preparing..." : "Generate questions"}
            </Button>
          </div>

          {interview.length ? (
            <Accordion type="multiple" className="rounded-xl border bg-card px-4">
              {interview.map((question, index) => (
                <AccordionItem key={`${question.question}-${index}`} value={`q-${index}`}>
                  <AccordionTrigger className="text-left text-sm">
                    <span className="flex flex-1 items-start gap-2">
                      <Badge variant="outline" className="mt-0.5 capitalize">{question.category}</Badge>
                      <span>{question.question}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 text-xs">
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Why it comes up: </span>{question.why}</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Structure: </span>{question.framework}</p>
                    <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                      {question.talkingPoints.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No interview questions yet. Generate a set when an interview is scheduled.
            </div>
          )}
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          {job.versions.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {job.versions.map((version) => (
                <VersionCard key={version.id} version={version} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center">
              <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-semibold">No tailored versions yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Tailor your resume to this role and save the changes you accept as a version.</p>
              {resumeId && (
                <Link href={`/resumes/${resumeId}/tailor?jobId=${job.id}`} className="mt-4 inline-block">
                  <Button variant="forge" size="sm"><Sparkles /> Tailor now</Button>
                </Link>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
        <div>
          <h2 className="text-sm font-semibold text-rose-900 dark:text-rose-100">Remove this application</h2>
          <p className="text-xs text-rose-800/80 dark:text-rose-200/80">Deletes the role, its gap plans, drafts and prep history.</p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => void deleteJob()} disabled={busy === "delete"}>
          {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
        </Button>
      </div>
    </div>
  );
}

function BuildPlan({
  gap,
  plan,
  busy,
  onSave,
}: {
  gap: GapDto;
  plan: NonNullable<GapOptions["build"]>;
  busy: string | null;
  onSave: (gap: GapDto, status: "PLANNED" | "IN_PROGRESS" | "DONE", link: string, include: boolean) => Promise<void>;
}) {
  const [status, setStatus] = useState<"PLANNED" | "IN_PROGRESS" | "DONE">(
    (gap.plannedProject?.status as "PLANNED" | "IN_PROGRESS" | "DONE" | undefined) ?? "PLANNED",
  );
  const [link, setLink] = useState(gap.plannedProject?.link ?? "");
  const [include, setInclude] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">{plan.title}</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{plan.scope}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {plan.stack.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
      </div>
      <div>
        <div className="text-xs font-medium">Build plan</div>
        <ol className="mt-1.5 space-y-1 text-xs text-muted-foreground">
          {plan.plan.map((step, index) => (
            <li key={step} className="flex gap-2"><span className="font-mono text-forge-600">{String(index + 1).padStart(2, "0")}</span> {step}</li>
          ))}
        </ol>
      </div>
      <div>
        <div className="text-xs font-medium">Repository shape</div>
        <div className="mt-1.5 rounded-lg bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {plan.repoStructure.map((line) => <div key={line}>{line}</div>)}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Project status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PLANNED">Planned</SelectItem>
              <SelectItem value="IN_PROGRESS">In progress</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Public link (required when done)</Label>
          <Input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://github.com/you/project" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={include} onCheckedChange={(value) => setInclude(value === true)} />
        Add the finished project to my resume
      </label>
      <Button size="sm" variant="forge" onClick={() => void onSave(gap, status, link.trim(), include)} disabled={busy === `plan:${gap.id}`}>
        {busy === `plan:${gap.id}` ? <Loader2 className="animate-spin" /> : <Check />} Save project plan
      </Button>
      <p className="text-[11px] text-muted-foreground">A plan stays off your resume until it is done and has a public link you can show.</p>
    </div>
  );
}

function VersionCard({ version }: { version: VersionDto }) {
  const [open, setOpen] = useState(false);
  const tone = version.matchScore !== null ? scoreTone(version.matchScore) : null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{version.label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{relativeTime(version.createdAt)}</div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-semibold tabular-nums ${tone?.className ?? ""}`}>{version.matchScore ?? "Not scored"}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">match</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <Badge variant="outline">{version.data.contact.fullName || "Untitled"}</Badge>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><UserRoundSearch /> Preview</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>{version.label}</DialogTitle></DialogHeader>
            <div className="paper mx-auto w-full max-w-2xl rounded-md">
              <ResumePreview data={version.data} design={version.design} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
