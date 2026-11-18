"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  Bot,
  Check,
  CircleDashed,
  Database,
  FileJson,
  HardDrive,
  LogOut,
  Mail,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorPanel, LoadingPanel } from "@/components/load-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers";
import { api, errorMessage } from "@/lib/client";
import type { SessionUser } from "@/lib/types";
import { initials } from "@/lib/utils";
import { toast } from "sonner";

interface IntegrationConfig {
  googleEnabled: boolean;
  llmConfigured: boolean;
  emailConfigured: boolean;
  storage: "s3" | "local";
  databaseConfigured: boolean;
  devOtp: boolean;
}

interface MeResponse {
  user: SessionUser | null;
  config: IntegrationConfig;
}

const writingRules = [
  "No em dashes, double hyphens or decorative separators anywhere in the copy.",
  "Banned phrases include results driven, team player, passionate, dynamic, go getter and responsible for.",
  "Every bullet starts with a varied action verb and carries one idea.",
  "Current roles use present tense. Past roles use past tense.",
  "Numbers must come from you. The app asks before it places a metric.",
  "Nothing is exported while a claim has no source in your own words.",
];

export function SettingsView() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await api<MeResponse>("/api/me");
      setUser(response.user);
      setConfig(response.config);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function exportData() {
    setExporting(true);
    try {
      const response = await fetch("/api/me/export");
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Export failed.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = match?.[1] ?? "resumeforge-export.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Try again.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Account" title="Settings" description="Integrations, appearance and your data." />
        <LoadingPanel label="Loading your settings" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Account" title="Settings" description="Integrations, appearance and your data." />
        <ErrorPanel message={error ?? "Settings could not be loaded."} onRetry={() => void load()} />
      </div>
    );
  }

  const integrations = [
    {
      label: "Database",
      icon: Database,
      ok: config.databaseConfigured,
      detail: config.databaseConfigured ? "PostgreSQL connected. Resumes, versions and applications persist." : "Add DATABASE_URL, then run npm run db:push.",
      env: "DATABASE_URL",
    },
    {
      label: "AI drafting",
      icon: Bot,
      ok: config.llmConfigured,
      detail: config.llmConfigured ? "LLM drafting is on. Rules still decide the score and the fact check." : "No LLM key. Every generator falls back to deterministic rules.",
      env: "LLM_API_KEY",
    },
    {
      label: "Email delivery",
      icon: Mail,
      ok: config.emailConfigured,
      detail: config.emailConfigured ? "Sign in codes are delivered by SMTP." : config.devOtp ? "Development mode: the sign in code is shown in the app and the server log." : "Add SMTP settings or users cannot receive a sign in code.",
      env: "SMTP_HOST",
    },
    {
      label: "File storage",
      icon: HardDrive,
      ok: config.storage === "s3",
      detail: config.storage === "s3" ? "S3 compatible storage holds original uploads." : "Original uploads are stored on the local disk under .data/uploads.",
      env: "S3_BUCKET",
    },
    {
      label: "Google sign in",
      icon: ShieldCheck,
      ok: config.googleEnabled,
      detail: config.googleEnabled ? "Google OAuth is configured." : "Email sign in remains available. Add Google credentials to enable the button.",
      env: "GOOGLE_CLIENT_ID",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="What is connected, how the app writes, and how to take your data with you."
        actions={
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut /> Sign out
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-forge-600" />
              <h2 className="text-sm font-semibold">Account</h2>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold">
                {user?.image ? (
                  <img src={user.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(user?.name, user?.email ?? "")
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{user?.name || "Your account"}</div>
                <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">Sign in</span>
                <Badge variant="outline">Email code</Badge>
                {config.googleEnabled && <Badge variant="outline">Google</Badge>}
              </div>
              <p>
                Sessions last seven days. Signing out clears the session cookie on this device only.
              </p>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <CircleDashed className="h-4 w-4 text-forge-600" />
              <h2 className="text-sm font-semibold">Integrations</h2>
            </div>
            <div className="mt-4 divide-y">
              {integrations.map((integration) => {
                const Icon = integration.icon;
                return (
                  <div key={integration.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="mt-0.5 rounded-lg border bg-muted/40 p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold">{integration.label}</span>
                        <Badge variant={integration.ok ? "success" : "warning"}>
                          {integration.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          {integration.ok ? "Connected" : "Not configured"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{integration.detail}</p>
                      {!integration.ok && (
                        <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{integration.env}</code>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-forge-600" />
              <h2 className="text-sm font-semibold">Your data</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Download a JSON copy of your account, resumes, versions, analyses, applications, cover letters and gap plans.
              Share tokens and OAuth tokens are excluded on purpose.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => void exportData()} disabled={exporting}>
              <ArrowDownToLine /> {exporting ? "Preparing export..." : "Export my data"}
            </Button>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-forge-600" />
              <h2 className="text-sm font-semibold">Appearance</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">The choice is stored on this device.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left text-xs transition ${theme === "light" ? "border-forge-400 bg-forge-50/50 dark:border-forge-700 dark:bg-forge-950/30" : "hover:bg-accent"}`}
                aria-pressed={theme === "light"}
              >
                <Sun className="h-4 w-4" /> Light
                {theme === "light" && <Check className="ml-auto h-3.5 w-3.5 text-forge-600" />}
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left text-xs transition ${theme === "dark" ? "border-forge-400 bg-forge-50/50 dark:border-forge-700 dark:bg-forge-950/30" : "hover:bg-accent"}`}
                aria-pressed={theme === "dark"}
              >
                <Moon className="h-4 w-4" /> Dark
                {theme === "dark" && <Check className="ml-auto h-3.5 w-3.5 text-forge-600" />}
              </button>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-forge-600" />
              <h2 className="text-sm font-semibold">Writing rules</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">These rules apply to every generator and export.</p>
            <ul className="mt-3 space-y-2">
              {writingRules.map((rule) => (
                <li key={rule} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-forge-600" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Privacy</h2>
            <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <li>Resumes and job descriptions are visible only to your account.</li>
              <li>Share links are public, read only and expire. Downloads still run the fact check.</li>
              <li>Original uploads stay in storage until you delete the resume.</li>
              <li>AI calls send only the resume and job text needed for the request.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
