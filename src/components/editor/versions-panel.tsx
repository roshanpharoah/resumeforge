"use client";

import { useMemo, useState } from "react";
import { diffLines } from "diff";
import { Check, Columns2, Download, Eye, GitCompareArrows, Loader2, Save, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditorCard } from "@/components/editor/helpers";
import { FactCheckList } from "@/components/fact-check-list";
import { ResumePreview } from "@/components/resume-preview";
import { ShareDialog } from "@/components/share-dialog";
import { api, downloadExport, errorMessage } from "@/lib/client";
import type { CreateVersionResponse } from "@/lib/api-types";
import type { VersionDto } from "@/lib/serializers";
import type { DesignTokens, ResumeData } from "@/lib/types";
import { relativeTime, scoreTone } from "@/lib/utils";
import { toast } from "sonner";

export function VersionsPanel({
  resumeId,
  data,
  design,
  versions,
  onVersionsChanged,
  onLoadVersion,
}: {
  resumeId: string;
  data: ResumeData;
  design: DesignTokens;
  versions: VersionDto[];
  onVersionsChanged: (versions: VersionDto[]) => void;
  onLoadVersion: (data: ResumeData, design: DesignTokens) => void;
}) {
  const [label, setLabel] = useState(`Snapshot ${new Date().toISOString().slice(0, 10)}`);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreateVersionResponse | null>(null);
  const [compareA, setCompareA] = useState(versions[0]?.id ?? "base");
  const [compareB, setCompareB] = useState(versions[1]?.id ?? versions[0]?.id ?? "base");
  const [compareOpen, setCompareOpen] = useState(false);

  async function saveVersion() {
    if (!label.trim()) {
      toast.error("Give the version a label.");
      return;
    }
    setSaving(true);
    try {
      const response = await api<CreateVersionResponse>(`/api/resumes/${resumeId}/versions`, {
        method: "POST",
        body: JSON.stringify({ label: label.trim(), data, design, source: "BASE" }),
      });
      setCreated(response);
      onVersionsChanged([response.version, ...versions]);
      setLabel(`Snapshot ${new Date().toISOString().slice(0, 10)}`);
      toast.success("Version saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const a = useMemo(() => resolveVersion(compareA, data, design, versions), [compareA, data, design, versions]);
  const b = useMemo(() => resolveVersion(compareB, data, design, versions), [compareB, data, design, versions]);
  const diff = useMemo(() => diffLines(textOf(a.data), textOf(b.data)), [a.data, b.data]);

  return (
    <div className="space-y-4">
      <EditorCard title="Save a version" description="A snapshot keeps the full document and design. Use it before risky edits or after a tailoring pass.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-[11px]">Version label</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Before the rewrite" />
          </div>
          <Button variant="forge" onClick={() => void saveVersion()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} {saving ? "Saving..." : "Save snapshot"}
          </Button>
          <ShareDialog
            resumeId={resumeId}
            versions={versions.map((version) => ({ id: version.id, label: version.label }))}
            trigger={
              <Button variant="outline">
                <Share2 /> Share
              </Button>
            }
          />
        </div>
        {created && (
          <div className="mt-4 space-y-3">
            <FactCheckList
              result={created.factCheck}
              onConfirm={(fingerprint) => {
                setCreated({
                  ...created,
                  factCheck: {
                    ...created.factCheck,
                    findings: created.factCheck.findings.map((finding) =>
                      finding.fingerprint === fingerprint ? { ...finding, confirmed: true, blocking: false } : finding,
                    ),
                    blocking: Math.max(0, created.factCheck.blocking - created.factCheck.findings.filter((finding) => finding.fingerprint === fingerprint && finding.blocking).length),
                  },
                });
              }}
            />
          </div>
        )}
      </EditorCard>

      <EditorCard
        title="Version history"
        description="Base versions and tailored copies live together. Loading a version does not overwrite the base until you save."
        action={<Badge variant="outline">{versions.length} saved</Badge>}
      >
        {!versions.length ? (
          <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">No versions saved yet.</p>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => {
              const tone = version.matchScore !== null ? scoreTone(version.matchScore) : null;
              return (
                <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-xs font-semibold">{version.label}</span>
                      <Badge variant={version.source === "TAILORED" ? "forge" : "outline"}>{version.source.toLowerCase()}</Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {relativeTime(version.createdAt)}
                      {version.company ? ` for ${version.company}` : ""}
                      {version.jobTitle ? `, ${version.jobTitle}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold tabular-nums ${tone?.className ?? ""}`}>{version.matchScore ?? "Not scored"}</span>
                    <VersionPreview resumeId={resumeId} version={version} />
                    <Button size="sm" variant="ghost" onClick={() => { onLoadVersion(version.data, version.design); toast.success("Version loaded into the editor. Save to keep it."); }}>
                      Load
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </EditorCard>

      <EditorCard title="Compare versions" description="See exactly what changed in plain text. Deleted lines are red, added lines are green.">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-[11px]">From</Label>
            <Select value={compareA} onValueChange={setCompareA}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Current editor</SelectItem>
                {versions.map((version) => <SelectItem key={version.id} value={version.id}>{version.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">To</Label>
            <Select value={compareB} onValueChange={setCompareB}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Current editor</SelectItem>
                {versions.map((version) => <SelectItem key={version.id} value={version.id}>{version.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!versions.length}>
                <GitCompareArrows /> Compare
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{a.label} to {b.label}</DialogTitle>
                <DialogDescription>A line level view of the visible resume text.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-card p-3 font-mono text-[11px] leading-relaxed scrollbar-thin">
                {diff.map((part, index) => (
                  <div
                    key={index}
                    className={part.added ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200" : part.removed ? "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200" : ""}
                  >
                    {part.value.split("\n").filter((line, lineIndex, all) => !(line === "" && lineIndex === all.length - 1)).map((line, lineIndex) => (
                      <div key={`${index}-${lineIndex}`} className="whitespace-pre-wrap">
                        {part.added ? "+ " : part.removed ? "- " : "  "}
                        {line}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setCompareA("base")} className="rounded-lg border p-2 text-left text-[11px] text-muted-foreground hover:bg-accent">Current editor: {data.contact.fullName || "Untitled"}</button>
          <button type="button" onClick={() => setCompareB("base")} className="rounded-lg border p-2 text-left text-[11px] text-muted-foreground hover:bg-accent">Compare against the current editor</button>
        </div>
      </EditorCard>
    </div>
  );
}

function resolveVersion(id: string, current: ResumeData, currentDesign: DesignTokens, versions: VersionDto[]) {
  if (id === "base") return { data: current, design: currentDesign, label: "Current editor" };
  const version = versions.find((item) => item.id === id);
  return version ? { data: version.data, design: version.design, label: version.label } : { data: current, design: currentDesign, label: "Current editor" };
}

function textOf(data: ResumeData): string {
  const lines: string[] = [];
  if (data.contact.fullName) lines.push(data.contact.fullName);
  if (data.summary) lines.push("", "SUMMARY", data.summary);
  if (data.experience.length) {
    lines.push("", "EXPERIENCE");
    for (const role of data.experience) {
      lines.push(`${role.title} at ${role.company} | ${role.startDate} to ${role.current ? "Present" : role.endDate}`);
      for (const bullet of role.bullets) lines.push(`- ${bullet.text}`);
    }
  }
  if (data.education.length) {
    lines.push("", "EDUCATION");
    for (const item of data.education) lines.push(`${item.degree} ${item.field} | ${item.institution} | ${item.endDate}`);
  }
  if (data.skills.length) {
    lines.push("", "SKILLS");
    for (const group of data.skills) lines.push(`${group.name}: ${group.skills.join(", ")}`);
  }
  if (data.projects.length) {
    lines.push("", "PROJECTS");
    for (const project of data.projects) {
      lines.push(project.name);
      for (const bullet of project.bullets) lines.push(`- ${bullet.text}`);
    }
  }
  return lines.join("\n");
}

function VersionPreview({ resumeId, version }: { resumeId: string; version: VersionDto }) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      await downloadExport(
        `/api/resumes/${resumeId}/export`,
        { format: "pdf", versionId: version.id },
        `${version.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${version.id}.pdf`,
      );
      toast.success("PDF downloaded.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Eye /> Preview</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{version.label} <Badge variant="outline">{version.source.toLowerCase()}</Badge></DialogTitle>
        </DialogHeader>
        <div className="paper mx-auto w-full max-w-2xl rounded-md">
          <ResumePreview data={version.data} design={version.design} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => void download()} disabled={downloading}>
            {downloading ? <Loader2 className="animate-spin" /> : <Download />} {downloading ? "Preparing..." : "Download PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
