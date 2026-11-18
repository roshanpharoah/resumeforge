"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Landmark,
  Library,
  Linkedin,
  Loader2,
  Plus,
  Send,
  SpellCheck,
  TextQuote,
  Trophy,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorPanel, LoadingPanel } from "@/components/load-state";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulletWriterTool } from "@/components/tools/bullet-writer";
import { SummaryTool } from "@/components/tools/summary-tool";
import { ProofreaderTool } from "@/components/tools/proofreader";
import { LinkedInTool } from "@/components/tools/linkedin-tool";
import { KeywordLibraryTool } from "@/components/tools/keyword-library";
import { LeaderboardTool } from "@/components/tools/leaderboard-tool";
import { SalaryInsightsTool } from "@/components/tools/salary-insights";
import { OutreachTool } from "@/components/tools/outreach-tool";
import { api, errorMessage } from "@/lib/client";
import type { JobSummaryDto, ResumeDetailDto, ResumeSummaryDto } from "@/lib/serializers";

type ToolTab = "bullets" | "summary" | "proofread" | "linkedin" | "keywords" | "leaderboard" | "salary" | "outreach";

const tabItems: { value: ToolTab; label: string; icon: typeof Wand2 }[] = [
  { value: "bullets", label: "Bullet writer", icon: Wand2 },
  { value: "summary", label: "Summary", icon: TextQuote },
  { value: "proofread", label: "Proofreader", icon: SpellCheck },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "keywords", label: "Keyword library", icon: Library },
  { value: "leaderboard", label: "Leaderboard", icon: Trophy },
  { value: "salary", label: "Salary", icon: Landmark },
  { value: "outreach", label: "Outreach", icon: Send },
];

function normalizeTab(value?: string): ToolTab {
  return tabItems.some((item) => item.value === value) ? (value as ToolTab) : "bullets";
}

export function ToolsView({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<ToolTab>(normalizeTab(initialTab));
  const [resumes, setResumes] = useState<ResumeSummaryDto[]>([]);
  const [jobs, setJobs] = useState<JobSummaryDto[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [jobId, setJobId] = useState("none");
  const [resume, setResume] = useState<ResumeDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumeResponse, jobsResponse] = await Promise.all([
        api<{ resumes: ResumeSummaryDto[] }>("/api/resumes"),
        api<{ jobs: JobSummaryDto[] }>("/api/jobs"),
      ]);
      setResumes(resumeResponse.resumes);
      setJobs(jobsResponse.jobs);
      setResumeId((current) => current || resumeResponse.resumes[0]?.id || "");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadResume = useCallback(async (id: string) => {
    setResumeLoading(true);
    try {
      const response = await api<{ resume: ResumeDetailDto }>(`/api/resumes/${id}`);
      setResume(response.resume);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResumeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!resumeId) {
      setResume(null);
      return;
    }
    setResume((current) => (current?.id === resumeId ? current : null));
    void loadResume(resumeId);
  }, [resumeId, loadResume]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Workbench" title="Tools" description="Writers and checks that use your real resume as the only source." />
        <LoadingPanel label="Loading your resumes and applications" />
      </div>
    );
  }

  if (error && !resumes.length) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Workbench" title="Tools" description="Writers and checks that use your real resume as the only source." />
        <ErrorPanel message={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (!resumes.length) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Workbench" title="Tools" description="Writers and checks that use your real resume as the only source." />
        <EmptyState
          icon={FileText}
          title="Add a resume to unlock the tools"
          description="The bullet writer, summary generator, LinkedIn optimizer and keyword coverage all read from a resume you own."
          action={
            <Link href="/onboarding">
              <Button variant="forge"><Plus /> Add your resume</Button>
            </Link>
          }
        />
        <ProofreaderTool resume={null} />
      </div>
    );
  }

  const selectedJob = jobs.find((job) => job.id === jobId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workbench"
        title="Tools"
        description="Everything here reads from your resume and the job you choose. Nothing is invented to fill a template."
        actions={
          resumeId ? (
            <Link href={`/resumes/${resumeId}/editor`}>
              <Button variant="outline"><FileText /> Open editor</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              Resume
              {resumeLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            <Select value={resumeId} onValueChange={setResumeId}>
              <SelectTrigger><SelectValue placeholder="Choose a resume" /></SelectTrigger>
              <SelectContent>
                {resumes.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground">Target job (optional)</div>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger><SelectValue placeholder="No job selected" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No job, general writing</SelectItem>
                {jobs.map((job) => <SelectItem key={job.id} value={job.id}>{job.title} at {job.company}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedJob && (
              <p className="text-[10px] text-muted-foreground">
                {selectedJob.status.toLowerCase()} application. <Link href={`/jobs/${selectedJob.id}`} className="text-forge-700 hover:underline dark:text-forge-300">Open it</Link>.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(normalizeTab(value))}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger key={item.value} value={item.value} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="bullets" className="mt-5">
          <BulletWriterTool resume={resume} resumeId={resumeId} jobId={jobId} />
        </TabsContent>
        <TabsContent value="summary" className="mt-5">
          <SummaryTool resume={resume} resumeId={resumeId} jobId={jobId} onChanged={() => void loadResume(resumeId)} />
        </TabsContent>
        <TabsContent value="proofread" className="mt-5">
          <ProofreaderTool resume={resume} />
        </TabsContent>
        <TabsContent value="linkedin" className="mt-5">
          <LinkedInTool resume={resume} resumeId={resumeId} jobId={jobId} jobsCount={jobs.length} />
        </TabsContent>
        <TabsContent value="keywords" className="mt-5">
          <KeywordLibraryTool resume={resume} />
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-5">
          <LeaderboardTool resumeId={resumeId} />
        </TabsContent>
        <TabsContent value="salary" className="mt-5">
          <SalaryInsightsTool jobs={jobs} />
        </TabsContent>
        <TabsContent value="outreach" className="mt-5">
          <OutreachTool resume={resume} jobs={jobs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
