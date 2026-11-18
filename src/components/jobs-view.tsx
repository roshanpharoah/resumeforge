"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, ExternalLink, Loader2, MapPin, Plus, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ErrorPanel, LoadingPanel } from "@/components/load-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client";
import type { JobSummaryDto } from "@/lib/serializers";
import { applicationStatuses, statusAccent, statusDescriptions, statusLabels, type ApplicationStatus } from "@/lib/status";
import { relativeTime, scoreTone } from "@/lib/utils";
import type { CreateJobResponse } from "@/lib/api-types";
import { toast } from "sonner";

const blankForm = {
  company: "",
  title: "",
  jdText: "",
  url: "",
  location: "",
  status: "SAVED" as ApplicationStatus,
  notes: "",
};

export function JobsView() {
  const [jobs, setJobs] = useState<JobSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(blankForm);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ jobs: JobSummaryDto[] }>("/api/jobs");
      setJobs(response.jobs);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter((job) => `${job.company} ${job.title} ${job.location ?? ""}`.toLowerCase().includes(needle));
  }, [jobs, query]);

  const columns = applicationStatuses.map((status) => ({
    status,
    jobs: filtered.filter((job) => job.status === status),
  }));

  async function createJob() {
    if (!form.company.trim() || !form.title.trim() || form.jdText.trim().length < 40) {
      toast.error("Add a company, a role title and the job description.");
      return;
    }
    setSaving(true);
    try {
      const response = await api<CreateJobResponse>("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          company: form.company.trim(),
          title: form.title.trim(),
          jdText: form.jdText.trim(),
          url: form.url.trim() || undefined,
          location: form.location.trim() || undefined,
          status: form.status,
          notes: form.notes.trim() || undefined,
        }),
      });
      setJobs((current) => [
        {
          id: response.job.id,
          company: response.job.company,
          title: response.job.title,
          status: response.job.status,
          matchScore: response.job.matchScore,
          location: response.job.location,
          url: response.job.url,
          salaryMin: response.job.salaryMin,
          salaryMax: response.job.salaryMax,
          currency: response.job.currency,
          salaryRange: response.job.salaryRange,
          createdAt: response.job.createdAt,
          updatedAt: response.job.updatedAt,
        },
        ...current,
      ]);
      setOpen(false);
      setForm(blankForm);
      setImportUrl("");
      toast.success("Application saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function importJd() {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const result = await api<{ text: string; extracted: { role: string; company: string; location?: string } }>("/api/analyze/jd-url", {
        method: "POST",
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      setForm((current) => ({
        ...current,
        jdText: result.text,
        title: current.title || result.extracted.role || "",
        company: current.company || result.extracted.company || "",
        location: current.location || result.extracted.location || "",
        url: current.url || importUrl.trim(),
      }));
      toast.success("Job description imported.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  async function changeStatus(job: JobSummaryDto, status: ApplicationStatus) {
    const previous = job.status;
    setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, status } : item)));
    try {
      await api(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success(`Moved to ${statusLabels[status]}.`);
    } catch (err) {
      setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, status: previous } : item)));
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipeline"
        title="Applications"
        description="A calm kanban for the whole search. Move a card when reality changes, not when you hope it did."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="forge">
                <Plus /> Add application
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add an application</DialogTitle>
                <DialogDescription>
                  Paste the job description so the analyzer and tailor can use it later. Nothing is scored until you ask.
                </DialogDescription>
              </DialogHeader>
              <div className="grid max-h-[62vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="job-company">Company</Label>
                  <Input id="job-company" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Northwind Labs" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-title">Role title</Label>
                  <Input id="job-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Product Analyst" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-location">Location</Label>
                  <Input id="job-location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Chicago, IL or Remote" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as ApplicationStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {applicationStatuses.map((status) => (
                        <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="job-url">Posting link</Label>
                  <div className="flex gap-2">
                    <Input id="job-url" value={importUrl || form.url} onChange={(event) => { setImportUrl(event.target.value); setForm({ ...form, url: event.target.value }); }} placeholder="https://company.com/careers/role" />
                    <Button type="button" variant="outline" onClick={() => void importJd()} disabled={importing || !importUrl.trim()}>
                      {importing ? <Loader2 className="animate-spin" /> : <ExternalLink />} Import
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Import reads public pages only. If a site blocks it, paste the text below.</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="job-jd">Job description</Label>
                  <Textarea id="job-jd" value={form.jdText} onChange={(event) => setForm({ ...form, jdText: event.target.value })} placeholder="Paste the responsibilities, requirements and keywords." className="min-h-[180px]" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="job-notes">Private notes</Label>
                  <Textarea id="job-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Referral name, recruiter email, questions to ask." className="min-h-[70px]" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="forge" onClick={() => void createJob()} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Plus />} {saving ? "Saving..." : "Save application"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, role or location" className="pl-9" />
        </div>
        <Badge variant="outline">{jobs.length} tracked</Badge>
        <Link href="/tools">
          <Button variant="outline" size="sm">
            <Sparkles /> Tailoring tools
          </Button>
        </Link>
      </div>

      {loading ? (
        <LoadingPanel label="Loading your applications" />
      ) : error ? (
        <ErrorPanel message={error} onRetry={() => void load()} />
      ) : !jobs.length ? (
        <EmptyState
          icon={Briefcase}
          title="No applications tracked yet"
          description="Add the first role. The tracker keeps the job description, gap plan, cover letter and interview prep in one place."
          action={
            <Button variant="forge" onClick={() => setOpen(true)}>
              <Plus /> Add your first application
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {columns.map((column) => (
            <div key={column.status} className="flex min-h-[240px] flex-col rounded-xl border bg-muted/30">
              <div className={`flex items-center justify-between gap-2 border-t-4 bg-card px-4 py-3 ${statusAccent[column.status]} rounded-t-xl`}>
                <div>
                  <div className="text-sm font-semibold">{statusLabels[column.status]}</div>
                  <div className="text-[10px] text-muted-foreground">{statusDescriptions[column.status]}</div>
                </div>
                <Badge variant="outline">{column.jobs.length}</Badge>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2.5">
                {column.jobs.map((job) => {
                  const tone = job.matchScore !== null ? scoreTone(job.matchScore) : null;
                  return (
                    <div key={job.id} className="rounded-lg border bg-card p-3 shadow-sm">
                      <Link href={`/jobs/${job.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-snug hover:text-forge-700 dark:hover:text-forge-300">{job.title}</h3>
                          {job.matchScore !== null && (
                            <span className={`text-sm font-semibold tabular-nums ${tone?.className ?? ""}`}>{job.matchScore}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{job.company}</div>
                        {job.location && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {job.location}
                          </div>
                        )}
                      </Link>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
                        <Select value={job.status} onValueChange={(value) => void changeStatus(job, value as ApplicationStatus)}>
                          <SelectTrigger className="h-7 w-[110px] border-0 bg-transparent px-1 text-[11px] shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {applicationStatuses.map((status) => (
                              <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Link href={`/jobs/${job.id}`} className="text-[11px] text-muted-foreground hover:text-foreground">
                          Open <ArrowRight className="inline h-3 w-3" />
                        </Link>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">Updated {relativeTime(job.updatedAt)}</div>
                    </div>
                  );
                })}
                {!column.jobs.length && (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">
                    Nothing here.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
