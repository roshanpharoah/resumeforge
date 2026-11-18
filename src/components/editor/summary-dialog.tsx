"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, errorMessage } from "@/lib/client";
import type { SkillGroup } from "@/lib/types";
import { toast } from "sonner";

interface SummaryResponse {
  summaries: { text: string; angle: string }[];
  skillsGroups: SkillGroup[];
  generatedBy: "rules" | "llm";
}

export function SummaryDialog({
  open,
  onOpenChange,
  resumeId,
  jobId,
  onApplySummary,
  onApplySkills,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeId: string;
  jobId?: string;
  onApplySummary: (text: string) => void;
  onApplySkills: (group: SkillGroup) => void;
}) {
  const [result, setResult] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [jdText, setJdText] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api<SummaryResponse>("/api/tools/summary", {
        method: "POST",
        body: JSON.stringify({
          resumeId,
          jobId: jobId === "none" ? undefined : jobId,
          jdText: jobId === "none" && jdText.trim() ? jdText.trim() : undefined,
        }),
      });
      setResult(response);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [resumeId, jobId, jdText]);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);

  function close() {
    onOpenChange(false);
    setResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-forge-600" /> Summary and skills</DialogTitle>
          <DialogDescription>
            Four angles built from your own evidence. Applying one treats it as your accepted wording.
          </DialogDescription>
        </DialogHeader>

        {jobId === "none" && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <button type="button" onClick={() => setShowPaste((value) => !value)} className="text-xs font-medium underline underline-offset-4">
              {showPaste ? "Hide target description" : "Add a job description for a role specific angle"}
            </button>
            {showPaste && (
              <div className="mt-2 space-y-2">
                <Input
                  value={jdText}
                  onChange={(event) => setJdText(event.target.value)}
                  placeholder="Or paste a short target description"
                />
                <Button size="sm" variant="outline" onClick={() => void run()} disabled={loading || jdText.trim().length < 20}>
                  <RefreshCw /> Regenerate for this target
                </Button>
              </div>
            )}
          </div>
        )}

        {loading && !result ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-forge-600" /> Reading your resume...
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={result.generatedBy === "llm" ? "forge" : "outline"}>{result.generatedBy === "llm" ? "AI draft" : "Rules draft"}</Badge>
              <Button size="sm" variant="ghost" onClick={() => void run()} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Regenerate
              </Button>
            </div>

            <div className="space-y-2">
              {result.summaries.map((summary) => (
                <div key={summary.angle} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="capitalize">{summary.angle.replace("-", " ")}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onApplySummary(summary.text);
                        close();
                        toast.success("Summary applied in the editor. Save to keep it.");
                      }}
                    >
                      <Check /> Use
                    </Button>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{summary.text}</p>
                </div>
              ))}
            </div>

            {result.skillsGroups.length > 0 && (
              <div>
                <Label className="text-xs">Suggested skills groups</Label>
                <div className="mt-2 space-y-2">
                  {result.skillsGroups.map((group) => (
                    <div key={group.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{group.name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onApplySkills(group);
                            toast.success(`${group.name} skills applied. Save to keep them.`);
                          }}
                        >
                          <Check /> Use group
                        </Button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {group.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={close}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
