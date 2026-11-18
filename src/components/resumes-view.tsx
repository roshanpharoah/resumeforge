"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FileSearch,
  FileText,
  MoreHorizontal,
  Plus,
  Sparkles,
  Star,
  Target,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ErrorPanel, LoadingPanel } from "@/components/load-state";
import { ShareDialog } from "@/components/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, errorMessage } from "@/lib/client";
import type { ResumeSummaryDto } from "@/lib/serializers";
import { pluralize, relativeTime, scoreTone } from "@/lib/utils";
import { toast } from "sonner";

export function ResumesView() {
  const [resumes, setResumes] = useState<ResumeSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ resumes: ResumeSummaryDto[] }>("/api/resumes");
      setResumes(response.resumes);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api(`/api/resumes/${id}`, { method: "DELETE" });
      setResumes((current) => current.filter((resume) => resume.id !== id));
      toast.success("Resume deleted.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  }

  async function makePrimary(id: string) {
    setBusyId(id);
    try {
      await api(`/api/resumes/${id}`, { method: "PATCH", body: JSON.stringify({ isPrimary: true }) });
      setResumes((current) => current.map((resume) => ({ ...resume, isPrimary: resume.id === id })));
      toast.success("Primary resume updated.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Library"
        title="Resumes"
        description="Every version of your story. Edit the base, tailor a copy, then keep only what stays true."
        actions={
          <Link href="/onboarding">
            <Button variant="forge">
              <Plus /> New resume
            </Button>
          </Link>
        }
      />

      {loading ? (
        <LoadingPanel label="Loading your resumes" />
      ) : error ? (
        <ErrorPanel message={error} onRetry={() => void load()} />
      ) : !resumes.length ? (
        <EmptyState
          icon={FileText}
          title="Your library is empty"
          description="Add the resume you already have. You can keep your design or start from a clean ATS template."
          action={
            <Link href="/onboarding">
              <Button variant="forge">
                <Plus /> Add your first resume
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resumes.map((resume) => {
            const tone = resume.latestScore !== null ? scoreTone(resume.latestScore) : null;
            return (
              <div key={resume.id} className="group relative flex flex-col rounded-xl border bg-card p-5 transition hover:border-forge-300 dark:hover:border-forge-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">{resume.title}</h2>
                      {resume.isPrimary && <Badge variant="forge">Primary</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pluralize(resume.versionCount, "version")}, {pluralize(resume.gapCount, "gap")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Updated {relativeTime(resume.updatedAt)}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${resume.title}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!resume.isPrimary && (
                        <DropdownMenuItem onClick={() => void makePrimary(resume.id)} disabled={busyId === resume.id}>
                          <Star /> Make primary
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={`/resumes/${resume.id}/analyze`}>
                          <Target /> Analyze
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/resumes/${resume.id}/tailor`}>
                          <Sparkles /> Tailor to a job
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(resume.id)} disabled={busyId === resume.id}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <div className={`text-3xl font-semibold tabular-nums ${tone?.className ?? ""}`}>
                      {resume.latestScore ?? "Not scored"}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {resume.latestScore !== null ? tone?.label : "Run an analysis"}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {resume.designSource === "upload" ? "My design" : resume.templateId.replace("ats-", "").replace("designer-", "")}
                  </Badge>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  <Link href={`/resumes/${resume.id}/editor`} className="flex-1">
                    <Button variant="forge" size="sm" className="w-full">
                      <FileText /> Edit
                    </Button>
                  </Link>
                  <Link href={`/resumes/${resume.id}/analyze`}>
                    <Button variant="outline" size="sm">
                      <FileSearch /> Report
                    </Button>
                  </Link>
                  <ShareDialog
                    resumeId={resume.id}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <ArrowUpRight /> Share
                      </Button>
                    }
                  />
                </div>

                <AlertDialog open={deleting === resume.id} onOpenChange={(open) => setDeleting(open ? resume.id : null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {resume.title}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the resume, its versions, analyses and gap history. It cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={(event) => {
                          event.preventDefault();
                          void remove(resume.id);
                        }}
                        disabled={busyId === resume.id}
                      >
                        {busyId === resume.id ? "Deleting..." : "Delete resume"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
