"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FactCheckList } from "@/components/fact-check-list";
import { CopyButton, EmptyToolState, ToolCard, sourceLine } from "@/components/tools/tool-ui";
import { api, errorMessage } from "@/lib/client";
import type { ResumeDetailDto } from "@/lib/serializers";
import type { BulletRewriteResult } from "@/lib/types";
import { toast } from "sonner";

interface BulletChoice {
  id: string;
  text: string;
  role: string;
  company: string;
  current: boolean;
}

export function BulletWriterTool({ resume, resumeId, jobId }: { resume: ResumeDetailDto | null; resumeId: string; jobId: string }) {
  const choices = useMemo<BulletChoice[]>(() => {
    if (!resume) return [];
    return resume.data.experience.flatMap((role) =>
      role.bullets
        .filter((bullet) => bullet.text.trim())
        .map((bullet) => ({
          id: bullet.id,
          text: bullet.text,
          role: role.title,
          company: role.company,
          current: role.current,
        })),
    );
  }, [resume]);

  const [bulletId, setBulletId] = useState("custom");
  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [current, setCurrent] = useState(false);
  const [askMetric, setAskMetric] = useState(false);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<BulletRewriteResult | null>(null);
  const [loading, setLoading] = useState(false);

  function loadChoice(id: string) {
    setBulletId(id);
    const choice = choices.find((item) => item.id === id);
    if (!choice) return;
    setText(choice.text);
    setRole(choice.role);
    setCompany(choice.company);
    setCurrent(choice.current);
    setResult(null);
  }

  async function run() {
    if (text.trim().length < 10) {
      toast.error("Add a little more detail first. At least ten characters.");
      return;
    }
    setLoading(true);
    try {
      const response = await api<{ result: BulletRewriteResult }>("/api/tools/bullet-rewrite", {
        method: "POST",
        body: JSON.stringify({
          resumeId,
          jobId: jobId === "none" ? undefined : jobId,
          bulletId: bulletId === "custom" ? undefined : bulletId,
          bulletText: text.trim(),
          role: role.trim(),
          company: company.trim(),
          current,
          userAnswer: answer.trim() || undefined,
          askMetric,
        }),
      });
      setResult(response.result);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function confirm(fingerprint: string) {
    if (!result) return;
    const findings = result.factCheck.findings.map((finding) =>
      finding.fingerprint === fingerprint ? { ...finding, confirmed: true, blocking: false } : finding,
    );
    setResult({ ...result, factCheck: { ...result.factCheck, findings, blocking: findings.filter((finding) => finding.blocking).length } });
  }

  if (!resume) {
    return (
      <ToolCard title="Bullet writer" description="Turn a rough line into three clear, truthful variations.">
        <EmptyToolState title="Choose a resume first" description="The writer reads your roles and evidence so it does not invent detail." />
      </ToolCard>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <ToolCard
        title="Your original line"
        description="Start with what you actually did. The writer keeps the meaning and improves the shape."
      >
        <div className="space-y-4">
          {choices.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Load a bullet from this resume</Label>
              <Select value={bulletId} onValueChange={loadChoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a bullet or write your own" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Write my own</SelectItem>
                  {choices.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.text.length > 90 ? `${choice.text.slice(0, 90)}...` : choice.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[11px]">Bullet text</Label>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ran the weekly sales report in Excel for the regional team."
              className="min-h-[110px]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Role</Label>
              <Input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Sales Analyst" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Company</Label>
              <Input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Northwind" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={current} onCheckedChange={(value) => setCurrent(value === true)} />
            This is my current role
          </label>

          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">What is missing from the line? (optional)</Label>
              <Textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="A real tool, scope, number or outcome. If you do not know a number, leave it blank."
                className="min-h-[70px]"
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <Checkbox checked={askMetric} onCheckedChange={(value) => setAskMetric(value === true)} />
              Ask me for a real metric
            </label>
          </div>

          <Button variant="forge" onClick={() => void run()} disabled={loading} className="w-full">
            {loading ? <Loader2 className="animate-spin" /> : result ? <RefreshCw /> : <Wand2 />}
            {loading ? "Writing..." : result ? "Write again" : "Write three variations"}
          </Button>
        </div>
      </ToolCard>

      <div className="space-y-4">
        {!result && !loading && (
          <ToolCard title="Variations" description="Each version keeps your evidence and follows one idea per line.">
            <EmptyToolState title="Nothing written yet" description="Add a line and run the writer. You will see three options, the formula used and any question worth answering." />
          </ToolCard>
        )}

        {loading && !result && (
          <ToolCard title="Variations">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-forge-600" /> Building options from your evidence...
            </div>
          </ToolCard>
        )}

        {result && (
          <>
            <ToolCard
              title="Variations"
              description={sourceLine(result.generatedBy)}
              action={<Badge variant={result.generatedBy === "llm" ? "forge" : "outline"}>{result.generatedBy === "llm" ? "AI assisted" : "Rules only"}</Badge>}
            >
              <div className="space-y-2">
                {result.variations.map((variation, index) => (
                  <div key={`${variation.text}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forge-100 text-[10px] font-semibold text-forge-800 dark:bg-forge-950 dark:text-forge-200">
                        {index + 1}
                      </span>
                      <Badge variant="outline">{variation.formula}</Badge>
                      {variation.needsMetric && (
                        <Badge variant="warning">
                          <AlertTriangle className="h-3 w-3" /> Add a real number if you have one
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">{variation.text}</p>
                    <div className="mt-2">
                      <CopyButton text={variation.text} variant="ghost" />
                    </div>
                  </div>
                ))}
                {!result.variations.length && (
                  <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                    The writer could not produce a clean variation without breaking a writing rule. Add a specific action and try again.
                  </p>
                )}
              </div>
            </ToolCard>

            {result.followUpQuestions.length > 0 && (
              <ToolCard title="Questions worth answering" description="Real detail makes the next version stronger. Guessing does not.">
                <ul className="space-y-2">
                  {result.followUpQuestions.map((question) => (
                    <li key={question} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forge-500" />
                      {question}
                    </li>
                  ))}
                </ul>
              </ToolCard>
            )}

            <ToolCard title="Source check" description="Suggestions are not facts. Confirm only what is true.">
              <FactCheckList result={result.factCheck} onConfirm={confirm} />
            </ToolCard>
          </>
        )}
      </div>
    </div>
  );
}
