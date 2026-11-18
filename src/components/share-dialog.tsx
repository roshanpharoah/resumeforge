"use client";

import { useState } from "react";
import { Check, Copy, Link2, Loader2, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/client";
import { copyText } from "@/lib/utils";
import type { CreateShareResponse } from "@/lib/api-types";
import { toast } from "sonner";

export function ShareDialog({
  resumeId,
  versions = [],
  trigger,
}: {
  resumeId: string;
  versions?: { id: string; label: string }[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [versionId, setVersionId] = useState("base");
  const [days, setDays] = useState("14");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateShareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const response = await api<CreateShareResponse>(`/api/resumes/${resumeId}/share`, {
        method: "POST",
        body: JSON.stringify({ versionId: versionId === "base" ? undefined : versionId, expiresInDays: Number(days) }),
      });
      setResult(response);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    const ok = await copyText(result.url);
    setCopied(ok);
    toast[ok ? "success" : "error"](ok ? "Share link copied." : "Copy failed. Select the link manually.");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setResult(null); setError(null); setCopied(false); } }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Share2 /> Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share a read only resume</DialogTitle>
          <DialogDescription>
            The link shows the exact design, works without an account and expires automatically. The fact check must pass first.
          </DialogDescription>
        </DialogHeader>
        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Version</Label>
              <Select value={versionId} onValueChange={setVersionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base resume</SelectItem>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>{version.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expires in</Label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
            <Button onClick={create} disabled={loading} className="w-full">
              {loading ? <Loader2 className="animate-spin" /> : <Link2 />} {loading ? "Creating link..." : "Create share link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-forge-600" />
              <p className="break-all text-xs leading-relaxed">{result.url}</p>
            </div>
            <Button onClick={copy} variant="outline" className="w-full">
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
            </Button>
            {result.qrDataUrl && (
              <div className="flex flex-col items-center gap-2 rounded-lg border p-3">
                <img src={result.qrDataUrl} alt="QR code for the share link" className="h-40 w-40 rounded" />
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><QrCode className="h-3 w-3" /> Scan to open on a phone</p>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Expires {result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : "never"}. Anyone with the link can view it until it expires, so choose a short window for sensitive resumes.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
