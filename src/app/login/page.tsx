"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/client";
import { toast } from "sonner";

interface MeResponse {
  user: { id: string; email: string; name: string | null; image: string | null } | null;
  config: { googleEnabled: boolean; devOtp: boolean; databaseConfigured: boolean };
}

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const queryError = params.get("error");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(queryError);
  const [cooldown, setCooldown] = useState(0);
  const [config, setConfig] = useState<MeResponse["config"] | null>(null);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email.trim()), [email]);

  useEffect(() => {
    api<MeResponse>("/api/me")
      .then((response) => setConfig(response.config))
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ ok: true; expiresInMinutes: number; devCode?: string }>("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setStage("code");
      setCooldown(30);
      if (response.devCode) {
        setDevCode(response.devCode);
        setCode(response.devCode);
        toast.success("Email is not configured, so the code is shown here.");
      } else {
        setDevCode(null);
        toast.success("Code sent. Check your inbox.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6 digit code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/verify-code", { method: "POST", body: JSON.stringify({ email: email.trim(), code }) });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-ink-950 p-10 text-ink-100 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-forge-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>
        <div className="relative">
          <Link href="/" aria-label="ResumeForge home">
            <Logo className="text-white" markClassName="h-9 w-9" />
          </Link>
        </div>
        <div className="relative max-w-lg">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-forge-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Every claim has a source
          </div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            A resume tool that refuses to make things up.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-ink-300">
            See the ATS view, fix the deductions, tailor to a role and export only after the fact check passes. Nothing green means nothing invented.
          </p>
          <div className="mt-9 grid gap-3 text-sm">
            {[
              "Eight dimension score with plain language reasons",
              "Per change accept or reject on every tailored version",
              "Four honest paths for a missing skill",
              "PDF, DOCX and TXT with a selectable text layer",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-ink-200">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-forge-500/20">
                  <Check className="h-2.5 w-2.5 text-forge-300" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-forge-500/15">
            <Sparkles className="h-5 w-5 text-forge-300" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Rules based when AI is unavailable</div>
            <div className="mt-0.5 text-[11px] text-ink-400">Parsing, scoring, tailoring and fact checks run without an API key. The app never becomes a dead end.</div>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between p-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:invisible">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16">
          <div className="w-full max-w-sm animate-fade-up">
            <div className="lg:hidden">
              <Logo className="mb-8" />
            </div>
            <div className="eyebrow">{stage === "email" ? "Welcome" : "Check your email"}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {stage === "email" ? "Sign in to ResumeForge" : "Enter your sign in code"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {stage === "email"
                ? "Use a one time code. No password to remember or leak."
                : `We sent a 6 digit code to ${email}. It expires in 10 minutes.`}
            </p>

            {error && (
              <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </div>
            )}

            {config && !config.databaseConfigured && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                The database is not configured yet. Add DATABASE_URL to .env and run npm run db:push before signing in.
              </div>
            )}

            {stage === "email" ? (
              <form onSubmit={requestCode} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" variant="forge" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : null}
                  {loading ? "Sending code..." : "Email me a code"}
                  {!loading && <ArrowRight />}
                </Button>
              </form>
            ) : (
              <form onSubmit={verify} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">6 digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-12 text-center text-xl font-semibold tracking-[0.4em]"
                    placeholder="000000"
                    autoFocus
                    required
                  />
                </div>
                {devCode && (
                  <div className="rounded-lg border border-forge-200 bg-forge-50 px-3 py-2 text-xs text-forge-900 dark:border-forge-900 dark:bg-forge-950/40 dark:text-forge-200">
                    Development code: <span className="font-mono text-sm font-bold">{devCode}</span>
                  </div>
                )}
                <Button type="submit" className="w-full" variant="forge" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : null}
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setStage("email"); setCode(""); setDevCode(null); }}>
                    Use a different email
                  </button>
                  <button
                    type="button"
                    disabled={cooldown > 0 || loading}
                    className="font-medium text-forge-700 disabled:text-muted-foreground dark:text-forge-400"
                    onClick={() => requestCode()}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            )}

            {config?.googleEnabled && (
              <>
                <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
                <a href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
                  <Button type="button" variant="outline" className="w-full">
                    <GoogleIcon /> Continue with Google
                  </Button>
                </a>
              </>
            )}

            <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
              By continuing you agree that ResumeForge may store the resume content you upload so you can edit and export it. See the{" "}
              <Link href="/settings" className="underline underline-offset-2">data controls</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <LoginScreen />
    </Suspense>
  );
}
