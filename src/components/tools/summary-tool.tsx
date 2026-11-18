"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, EmptyToolState, ToolCard, sourceLine } from "@/components/tools/tool-ui";
import { api, errorMessage } from "@/lib/client";
import type { ResumeDetailDto } from "@/lib/serializers";
import type { SkillGroup } from "@/lib/types";
import { toast } from "sonner";

interface SummaryResult {
  summaries: { text: string; angle: string }[];
  skillsGroups: SkillGroup[];
  generatedBy: "rules" | "llm";
}

export function SummaryTool({
  resume,
  resumeId,
  jobId,
  onChanged,
}: {
  resume: ResumeDetailDto | null;
  resumeId: string;
  jobId: string;
  onChanged: () => void;
}) {
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const response = await api<SummaryResult>("/api/tools/summary", {
        method: "POST",
        body: JSON.stringify({
          resumeId,
          jobId: jobId === "none" ? undefined : jobId,
          jdText: jobId === "none" && jdText.trim().length > 20 ? jdText.trim() : undefined,
        }),
      });
      setResult(response);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveSummary(text: string, index: number) {
    if (!resume) return;
    setSavingIndex(index);
    try {
      await api(`/api/resumes/${resumeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          data: {
            ...resume.data,
            summary: text,
            summarySource: { type: "user_answer", ref: "Saved from summary generator", quote: text },
          },
        }),
      });
      toast.success("Summary saved to the resume.");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingIndex(null);
    }
  }

  if (!resume) {
    return (
      <ToolCard title="Summary generator" description="A short summary that matches the role, built only from your resume.">
        <EmptyToolState title="Choose a resume first" description="The generator will not add experience, tools or numbers that are missing from your resume." />
      </ToolCard>
    );
  }

  return (
    <div className="space-y-5">
      <ToolCard
        title="Target the summary"
        description="Pick a saved job above, or paste a description here. Leave both empty for a general summary."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Paste a job description (optional)</Label>
            <Textarea
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              placeholder="Paste the role, requirements and responsibilities if you have not saved this job yet."
              className="min-h-[130px]"
              disabled={jobId !== "none"}
            />
            {jobId !== "none" && <p className="text-[11px] text-muted-foreground">Using the saved job selected above. Clear that selection to paste a description.</p>}
          </div>
          <Button variant="forge" onClick={() => void generate()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {loading ? "Writing..." : "Generate three summaries"}
          </Button>
        </div>
      </ToolCard>

      {result && (
        <ToolCard
          title="Options"
          description={sourceLine(result.generatedBy)}
          action={<Badge variant={result.generatedBy === "llm" ? "forge" : "outline"}>{result.generatedBy === "llm" ? "AI assisted" : "Rules only"}</Badge>}
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {result.summaries.map((summary, index) => (
              <div key={`${summary.angle}-${index}`} className="flex flex-col rounded-lg border bg-muted/20 p-4">
                <Badge variant="outline" className="self-start capitalize">{summary.angle.replace(/-/g, " ")}</Badge>
                <p className="mt-3 flex-1 text-sm leading-relaxed">{summary.text}</p>
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                  <CopyButton text={summary.text} variant="ghost" />
                  <Button size="sm" variant="outline" onClick={() => void saveSummary(summary.text, index)} disabled={savingIndex !== null}>
                    {savingIndex === index ? <Loader2 className="animate-spin" /> : <Check />} Save to resume
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {!result.summaries.length && (
            <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              There is not enough detail for a useful summary yet. Add a role, a skill or a project first.
            </p>
          )}
        </ToolCard>
      )}

      {result && result.skillsGroups.length > 0 && (
        <ToolCard
          title="Skill groups"
          description="Grouped from skills already on the resume and ordered toward the role. Copy the groups you want to keep."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {result.skillsGroups.map((group) => (
              <div key={group.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{group.name}</span>
                  <CopyButton text={`${group.name}: ${group.skills.join(", ")}`} variant="ghost" label="Copy group" />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{group.skills.join(", ")}</p>
              </div>
            ))}
          </div>
        </ToolCard>
      )}
    </div>
  );
}
