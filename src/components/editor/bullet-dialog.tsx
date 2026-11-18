"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FactCheckList } from "@/components/fact-check-list";
import { Badge } from "@/components/ui/badge";
import { api, errorMessage } from "@/lib/client";
import type { BulletRewriteResult } from "@/lib/types";
import { toast } from "sonner";

export interface BulletContext {
  kind: "experience" | "project";
  expId: string;
  bulletId: string;
  text: string;
  role: string;
  company: string;
  current: boolean;
}

export function BulletRewriteDialog({
  open,
  onOpenChange,
  resumeId,
  jobId,
  context,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeId: string;
  jobId?: string;
  context: BulletContext | null;
  onApply: (text: string) => void;
}) {
  const [result, setResult] = useState<BulletRewriteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [askMetric, setAskMetric] = useState(false);

  const run = useCallback(
    async (withAnswer?: string) => {
      if (!context) return;
      setLoading(true);
      try {
        const response = await api<{ result: BulletRewriteResult }>("/api/tools/bullet-rewrite", {
          method: "POST",
          body: JSON.stringify({
            resumeId,
            jobId: jobId === "none" ? undefined : jobId,
            bulletId: context.bulletId,
            bulletText: context.text,
            role: context.role,
            company: context.company,
            current: context.current,
            userAnswer: withAnswer?.trim() || undefined,
            askMetric,
          }),
        });
        setResult(response.result);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [context, resumeId, jobId, askMetric],
  );

  useEffect(() => {
    if (!open || !context) return;
    setResult(null);
    setAnswer("");
    setAskMetric(false);
    void run();
    // Only rerun when the target bullet changes, not when the callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, context?.bulletId]);

  function close() {
    onOpenChange(false);
    setResult(null);
    setAnswer("");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-forge-600" /> Bullet writer</DialogTitle>
          <DialogDescription>
            Three variations, each built from your original line. Nothing is added unless you wrote it or confirmed it.
          </DialogDescription>
        </DialogHeader>

        {context && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Original line</div>
            <p className="mt-1 text-sm leading-relaxed">{context.text || "No text yet. Write a rough line first, or answer below."}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">What did you actually do that is missing here? (optional)</Label>
          <Textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="A real tool, scope, number or outcome. If you do not know a metric, leave it blank."
            className="min-h-[70px]"
          />
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={askMetric} onCheckedChange={(value) => setAskMetric(value === true)} />
            Push me for a real metric
          </label>
          <Button size="sm" variant="outline" onClick={() => void run(answer)} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} {loading ? "Writing..." : answer.trim() ? "Use my answer" : "Regenerate"}
          </Button>
        </div>

        {loading && !result && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-forge-600" /> Building variations from your evidence...
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={result.generatedBy === "llm" ? "forge" : "outline"}>{result.generatedBy === "llm" ? "AI draft" : "Rules draft"}</Badge>
              <span className="text-[11px] text-muted-foreground">Pick one, then edit it if needed.</span>
            </div>
            <div className="space-y-2">
              {result.variations.map((variation, index) => (
                <div key={`${variation.text}-${index}`} className="rounded-lg border p-3">
                  <p className="text-sm leading-relaxed">{variation.text}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Badge variant="outline">{variation.formula}</Badge>
                      {variation.needsMetric && <Badge variant="warning">Add a real number</Badge>}
                    </div>
                    <Button
                      size="sm"
                      variant="forge"
                      onClick={() => {
                        onApply(variation.text);
                        close();
                        toast.success("Bullet updated in the editor. Save to keep it.");
                      }}
                    >
                      <Sparkles /> Use this line
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {result.followUpQuestions.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="font-semibold">Answer these before you finalize:</div>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {result.followUpQuestions.map((question) => <li key={question}>{question}</li>)}
                </ul>
              </div>
            )}

            <FactCheckList result={result.factCheck} compact />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={close}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
