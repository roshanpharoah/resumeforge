"use client";

import { useState } from "react";
import { Download, FileText, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditorCard } from "@/components/editor/helpers";
import { FactCheckList } from "@/components/fact-check-list";
import { downloadExport, errorMessage, factCheckFromError, filenameFor } from "@/lib/client";
import { api } from "@/lib/client";
import type { DesignTokens, FactCheckResult, ResumeData } from "@/lib/types";
import { toast } from "sonner";

export function ExportPanel({
  resumeId,
  data,
  design,
}: {
  resumeId: string;
  data: ResumeData;
  design: DesignTokens;
}) {
  const [factCheck, setFactCheck] = useState<FactCheckResult | null>(null);
  const [confirmations, setConfirmations] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  async function runFactCheck() {
    setChecking(true);
    try {
      const response = await api<{ factCheck: FactCheckResult }>(`/api/resumes/${resumeId}/fact-check`, {
        method: "POST",
        body: JSON.stringify({ data, confirmations }),
      });
      setFactCheck(response.factCheck);
      toast[response.factCheck.blocking ? "error" : "success"](
        response.factCheck.blocking
          ? `${response.factCheck.blocking} claim${response.factCheck.blocking === 1 ? "" : "s"} need your confirmation.`
          : "Every claim traces back to your own text.",
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  function confirm(fingerprint: string) {
    setConfirmations((current) => [...new Set([...current, fingerprint])]);
    setFactCheck((current) =>
      current
        ? {
            ...current,
            blocking: Math.max(0, current.blocking - current.findings.filter((finding) => finding.fingerprint === fingerprint && finding.blocking && !finding.confirmed).length),
            findings: current.findings.map((finding) =>
              finding.fingerprint === fingerprint ? { ...finding, confirmed: true, blocking: false } : finding,
            ),
          }
        : current,
    );
  }

  async function download(format: "pdf" | "docx" | "txt") {
    setExporting(format);
    try {
      await downloadExport(
        `/api/resumes/${resumeId}/export`,
        { format, data, design, confirmations },
        filenameFor(format, data.contact.fullName),
      );
      toast.success("Download ready.");
    } catch (err) {
      const check = factCheckFromError(err);
      if (check) setFactCheck(check);
      toast.error(errorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  const formats = [
    { id: "pdf" as const, title: "PDF", detail: "Best for applying. Rendered from the same layout you see here.", icon: FileText },
    { id: "docx" as const, title: "DOCX", detail: "Best when a recruiter or portal asks for Word. Editable and parseable.", icon: FileText },
    { id: "txt" as const, title: "Plain text", detail: "Best for pasting into a portal. No styling at all.", icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <EditorCard
        title="Truth check before export"
        description="Every number, employer, title, date and credential is compared with your source text. Export stays blocked until nothing is unsupported."
        action={
          <Button size="sm" variant="outline" onClick={() => void runFactCheck()} disabled={checking}>
            {checking ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {checking ? "Checking..." : "Run fact check"}
          </Button>
        }
      >
        {factCheck ? (
          <FactCheckList result={factCheck} onConfirm={confirm} onRecheck={() => void runFactCheck()} confirming={checking} />
        ) : (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-forge-600" />
            <p>The check runs again automatically on every export. You can run it now to fix claims before downloading.</p>
          </div>
        )}
        {confirmations.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">{confirmations.length} finding{confirmations.length === 1 ? "" : "s"} confirmed as accurate on this device.</p>
        )}
      </EditorCard>

      <EditorCard title="Export" description="The file uses your current content and design. Unsaved edits are included.">
        <div className="grid gap-3 sm:grid-cols-3">
          {formats.map((format) => (
            <div key={format.id} className="flex flex-col rounded-lg border p-4">
              <format.icon className="h-5 w-5 text-forge-600 dark:text-forge-400" />
              <div className="mt-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{format.title}</h3>
                {format.id === "pdf" && <Badge variant="forge">Recommended</Badge>}
              </div>
              <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted-foreground">{format.detail}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => void download(format.id)}
                disabled={exporting !== null}
              >
                {exporting === format.id ? <Loader2 className="animate-spin" /> : <Download />}
                {exporting === format.id ? "Preparing..." : `Download ${format.title}`}
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          PDF needs a local Chrome build. If the server cannot render it, DOCX and TXT still work and the error message explains what is missing.
        </p>
      </EditorCard>

      <EditorCard title="Share instead" description="A read only link keeps the design, hides your private notes and can expire automatically.">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Use Share in the top toolbar or the Versions tab. Sharing runs the same fact check and refuses links with unsupported claims.
        </p>
      </EditorCard>
    </div>
  );
}
