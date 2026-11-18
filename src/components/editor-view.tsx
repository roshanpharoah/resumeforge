"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  FileSearch,
  FileText,
  Loader2,
  Save,
  Share2,
  Sparkles,
  Target,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorPanel, LoadingPanel } from "@/components/load-state";
import { ResumePreview } from "@/components/resume-preview";
import { ShareDialog } from "@/components/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentPanel } from "@/components/editor/content-panel";
import { DesignPanel } from "@/components/editor/design-panel";
import { VersionsPanel } from "@/components/editor/versions-panel";
import { ExportPanel } from "@/components/editor/export-panel";
import { BulletRewriteDialog, type BulletContext } from "@/components/editor/bullet-dialog";
import { SummaryDialog } from "@/components/editor/summary-dialog";
import { estimateVisualPages } from "@/components/editor/helpers";
import { api, errorMessage } from "@/lib/client";
import type { UpdateResumeResponse } from "@/lib/api-types";
import type { JobSummaryDto, ResumeDetailDto, VersionDto } from "@/lib/serializers";
import type { DesignTokens, ResumeData, SkillGroup } from "@/lib/types";
import { relativeTime, scoreTone } from "@/lib/utils";
import { toast } from "sonner";

type EditorTab = "content" | "design" | "versions" | "export";

function normalizeTab(value?: string): EditorTab {
  return value === "design" || value === "versions" || value === "export" ? value : "content";
}

export function EditorView({ resumeId, initialTab }: { resumeId: string; initialTab?: string }) {
  const [resume, setResume] = useState<ResumeDetailDto | null>(null);
  const [data, setData] = useState<ResumeData | null>(null);
  const [design, setDesign] = useState<DesignTokens | null>(null);
  const [title, setTitle] = useState("");
  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [jobs, setJobs] = useState<JobSummaryDto[]>([]);
  const [selectedJob, setSelectedJob] = useState("none");
  const [tab, setTab] = useState<EditorTab>(normalizeTab(initialTab));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulletOpen, setBulletOpen] = useState(false);
  const [bulletContext, setBulletContext] = useState<BulletContext | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumeResponse, versionsResponse, jobsResponse] = await Promise.all([
        api<{ resume: ResumeDetailDto }>(`/api/resumes/${resumeId}`),
        api<{ versions: VersionDto[] }>(`/api/resumes/${resumeId}/versions`),
        api<{ jobs: JobSummaryDto[] }>("/api/jobs"),
      ]);
      setResume(resumeResponse.resume);
      setData(resumeResponse.resume.data);
      setDesign(resumeResponse.resume.design);
      setTitle(resumeResponse.resume.title);
      setVersions(versionsResponse.versions);
      setJobs(jobsResponse.jobs);
      setDirty(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [resumeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!data || !design || !title.trim()) return;
    setSaving(true);
    try {
      const response = await api<UpdateResumeResponse>(`/api/resumes/${resumeId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim(), data, design }),
      });
      setResume(response.resume);
      setTitle(response.resume.title);
      setDirty(false);
      setSavedAt(new Date());
      toast.success("Resume saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [data, design, title, resumeId]);

  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty) void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  function changeData(next: ResumeData) {
    setData(next);
    setDirty(true);
  }

  function changeDesign(next: DesignTokens) {
    setDesign(next);
    setDirty(true);
  }

  function applyBullet(text: string) {
    if (!data || !bulletContext) return;
    if (bulletContext.kind === "experience") {
      changeData({
        ...data,
        experience: data.experience.map((experience) =>
          experience.id === bulletContext.expId
            ? {
                ...experience,
                bullets: experience.bullets.map((bullet) =>
                  bullet.id === bulletContext.bulletId
                    ? { ...bullet, text, source: { type: "user_answer", ref: "AI bullet writer", quote: text }, verified: true }
                    : bullet,
                ),
              }
            : experience,
        ),
      });
    } else {
      changeData({
        ...data,
        projects: data.projects.map((project) =>
          project.id === bulletContext.expId
            ? {
                ...project,
                bullets: project.bullets.map((bullet) =>
                  bullet.id === bulletContext.bulletId
                    ? { ...bullet, text, source: { type: "user_answer", ref: "AI bullet writer", quote: text }, verified: true }
                    : bullet,
                ),
              }
            : project,
        ),
      });
    }
  }

  function applySummary(text: string) {
    if (!data) return;
    changeData({
      ...data,
      summary: text,
      summarySource: { type: "user_answer", ref: "Accepted summary suggestion", quote: text },
    });
  }

  function applySkills(group: SkillGroup) {
    if (!data) return;
    const existing = data.skills.find((item) => item.name.toLowerCase() === group.name.toLowerCase());
    if (existing) {
      changeData({
        ...data,
        skills: data.skills.map((item) => (item.id === existing.id ? { ...item, skills: group.skills } : item)),
      });
    } else {
      changeData({ ...data, skills: [...data.skills, { ...group, id: group.id || `skill_${Date.now()}` }] });
    }
  }

  const pages = useMemo(() => (data && design ? estimateVisualPages(data, design) : 1), [data, design]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resume editor" description="Loading your document, versions and design." />
        <LoadingPanel label="Loading the editor" />
      </div>
    );
  }

  if (error || !resume || !data || !design) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resume editor" description="The document could not be loaded." />
        <ErrorPanel message={error ?? "Resume not found."} onRetry={() => void load()} />
        <Link href="/resumes">
          <Button variant="outline"><ArrowLeft /> Back to resumes</Button>
        </Link>
      </div>
    );
  }

  const tone = resume.latestScore !== null ? scoreTone(resume.latestScore) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/resumes" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to resumes
        </Link>
      </div>

      <PageHeader
        eyebrow="Editor"
        title={title || "Untitled resume"}
        description={dirty ? "Unsaved changes. Press Ctrl and S, or use Save." : savedAt ? `Saved ${relativeTime(savedAt)}.` : "Every change is local until you save."}
        actions={
          <>
            <Button variant="outline" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} {saving ? "Saving..." : "Save"}
            </Button>
            <Link href={`/resumes/${resumeId}/analyze`}>
              <Button variant="outline"><FileSearch /> Analyze</Button>
            </Link>
            <Link href={`/resumes/${resumeId}/tailor`}>
              <Button variant="outline"><Sparkles /> Tailor</Button>
            </Link>
            <ShareDialog
              resumeId={resumeId}
              versions={versions.map((version) => ({ id: version.id, label: version.label }))}
              trigger={<Button variant="forge"><Share2 /> Share</Button>}
            />
          </>
        }
      />

      <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_260px]">
        <div className="space-y-1.5">
          <Label className="text-[11px]">Resume name</Label>
          <Input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
            placeholder="Product analyst, 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">AI target role (optional)</Label>
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No target job</SelectItem>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>{job.title} at {job.company}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div>
          <Tabs value={tab} onValueChange={(value) => setTab(value as EditorTab)}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="versions">Versions <Badge variant="outline" className="ml-1">{versions.length}</Badge></TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-4">
              <ContentPanel
                data={data}
                onChange={changeData}
                onRewrite={(context) => {
                  setBulletContext(context);
                  setBulletOpen(true);
                }}
                onGenerateSummary={() => setSummaryOpen(true)}
              />
            </TabsContent>

            <TabsContent value="design" className="mt-4">
              <DesignPanel data={data} design={design} onChange={changeDesign} />
            </TabsContent>

            <TabsContent value="versions" className="mt-4">
              <VersionsPanel
                resumeId={resumeId}
                data={data}
                design={design}
                versions={versions}
                onVersionsChanged={(next) => setVersions(next)}
                onLoadVersion={(nextData, nextDesign) => {
                  changeData(nextData);
                  changeDesign(nextDesign);
                  setTab("content");
                }}
              />
            </TabsContent>

            <TabsContent value="export" className="mt-4">
              <ExportPanel resumeId={resumeId} data={data} design={design} />
            </TabsContent>
          </Tabs>

          <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Truth rule.</span> If you cannot point to the line in your own history that supports a claim, remove it. A shorter honest resume beats a longer invented one.
          </div>
        </div>

        <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-forge-600 dark:text-forge-400" />
                <span className="text-xs font-semibold">Live preview</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={pages <= 1 ? "success" : "warning"}>{pages} page{pages === 1 ? "" : "s"}</Badge>
                <Badge variant={design.columns === 2 ? "destructive" : "outline"}>ATS {design.columns === 2 ? "risk" : "safe"}</Badge>
              </div>
            </div>
            <div className="paper mx-auto w-full max-w-[560px] rounded-md">
              <ResumePreview data={data} design={design} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t px-1 pt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Latest score:
                <span className={`font-semibold ${tone?.className ?? ""}`}>{resume.latestScore ?? "not scored"}</span>
              </span>
              {resume.latestScore !== null && <span>{tone?.label}</span>}
            </div>
          </div>

          {pages > 1 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>The preview estimates {pages} pages. Open Design and run Fit to one page, or cut a weaker bullet.</p>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Link href={`/resumes/${resumeId}/analyze`}>
              <Button variant="outline" className="w-full justify-start"><FileSearch /> Open the full ATS report</Button>
            </Link>
            <Link href={`/resumes/${resumeId}/tailor`}>
              <Button variant="outline" className="w-full justify-start"><Sparkles /> Tailor to a job</Button>
            </Link>
            <Link href="/jobs">
              <Button variant="ghost" className="w-full justify-start"><Target /> Applications and gaps</Button>
            </Link>
          </div>

          <p className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
            <Check className="h-3 w-3 text-forge-600" /> Standard headings, selectable text and one column parse best.
          </p>
        </div>
      </div>

      <BulletRewriteDialog
        open={bulletOpen}
        onOpenChange={setBulletOpen}
        resumeId={resumeId}
        jobId={selectedJob}
        context={bulletContext}
        onApply={applyBullet}
      />
      <SummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        resumeId={resumeId}
        jobId={selectedJob}
        onApplySummary={applySummary}
        onApplySkills={applySkills}
      />
    </div>
  );
}
