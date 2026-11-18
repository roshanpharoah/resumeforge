"use client";

import { useState } from "react";
import { FileText, Loader2, ShieldCheck, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SeverityBadge } from "@/components/severity-badge";
import { CopyButton, EmptyToolState, ToolCard } from "@/components/tools/tool-ui";
import { api, errorMessage } from "@/lib/client";
import type { ResumeDetailDto } from "@/lib/serializers";
import { resumeToPlainText } from "@/lib/types";
import { toast } from "sonner";

interface ProofIssue {
  severity: "critical" | "warning" | "info";
  category: "spelling" | "grammar" | "style" | "punctuation";
  title: string;
  detail: string;
  quote: string;
  suggestion: string;
}

interface ProofResult {
  issues: ProofIssue[];
  counts: { blocking: number; warnings: number; info: number };
  cleaned: string;
}

export function ProofreaderTool({ resume }: { resume: ResumeDetailDto | null }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ProofResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function check() {
    if (!text.trim()) {
      toast.error("Paste or load some text first.");
      return;
    }
    setLoading(true);
    try {
      const response = await api<ProofResult>("/api/tools/proofread", {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), resumeId: resume?.id }),
      });
      setResult(response);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <ToolCard
        title="Text to check"
        description="Paste a summary, a bullet or a whole resume. The checker reads for spelling, grammar, banned phrases and punctuation."
        action={
          resume ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setText(resumeToPlainText(resume.data));
                setResult(null);
              }}
            >
              <FileText /> Load this resume
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <Label className="text-[11px]">Text</Label>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste the text you want checked."
            className="min-h-[280px] font-mono text-xs"
          />
          <Button variant="forge" onClick={() => void check()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Wand2 />} {loading ? "Checking..." : "Check the writing"}
          </Button>
        </div>
      </ToolCard>

      <div className="space-y-4">
        {!result && !loading && (
          <ToolCard title="Results" description="Findings are suggestions. You decide what to change.">
            <EmptyToolState title="No check yet" description="Paste text or load a resume, then run the checker." />
          </ToolCard>
        )}

        {loading && (
          <ToolCard title="Results">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-forge-600" /> Reading the text...
            </div>
          </ToolCard>
        )}

        {result && !loading && (
          <>
            <ToolCard
              title="Results"
              action={
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={result.counts.warnings ? "warning" : "success"}>{result.counts.warnings} warning{result.counts.warnings === 1 ? "" : "s"}</Badge>
                  <Badge variant="outline">{result.counts.info} note{result.counts.info === 1 ? "" : "s"}</Badge>
                </div>
              }
            >
              {!result.issues.length ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <ShieldCheck className="h-4 w-4" /> No spelling, grammar or style issues matched the rules.
                </div>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                  {result.issues.map((issue, index) => (
                    <div key={`${issue.category}-${issue.title}-${index}`} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={issue.severity} />
                        <Badge variant="outline" className="capitalize">{issue.category}</Badge>
                        <span className="text-xs font-medium">{issue.title}</span>
                      </div>
                      {issue.quote && (
                        <p className="mt-2 rounded bg-muted/50 px-2 py-1 font-mono text-[11px]">{issue.quote}</p>
                      )}
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{issue.detail}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-foreground">{issue.suggestion}</p>
                    </div>
                  ))}
                </div>
              )}
            </ToolCard>

            <ToolCard
              title="Cleaned version"
              description="Removes banned phrasing and normalizes punctuation. Review it before you use it."
              action={<CopyButton text={result.cleaned} label="Copy cleaned text" />}
            >
              <div className="max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed scrollbar-thin">
                {result.cleaned || "Nothing left after cleaning."}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setText(result.cleaned); setResult(null); toast.success("Cleaned text moved into the editor."); }}>
                Keep editing this version
              </Button>
            </ToolCard>
          </>
        )}
      </div>
    </div>
  );
}
