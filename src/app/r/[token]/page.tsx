import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Download, Link2Off, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { ResumePreview } from "@/components/resume-preview";
import { db } from "@/lib/db";
import { toDesign, toResumeData } from "@/lib/serializers";
import { formatDate } from "@/lib/utils";
import type { DesignTokens, ResumeData } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shared resume",
  description: "A read only resume shared through ResumeForge.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface SharedResume {
  data: ResumeData;
  design: DesignTokens;
  title: string;
  versionLabel: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

async function loadShare(token: string): Promise<{ share: SharedResume | null; error: "missing" | "expired" | "unavailable" | null }> {
  try {
    const link = await db().shareLink.findUnique({
      where: { token },
      include: { resume: true, version: true },
    });
    if (!link || link.revokedAt) return { share: null, error: "missing" };
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return { share: null, error: "expired" };
    const parse = (value: unknown) => {
      try {
        return { data: toResumeData(value), design: toDesign(link.version ? link.version.design : link.resume.design) };
      } catch {
        return null;
      }
    };
    const content = parse(link.version ? link.version.data : link.resume.parsed);
    if (!content) return { share: null, error: "unavailable" };
    return {
      share: {
        ...content,
        title: link.version?.label || link.resume.title,
        versionLabel: link.version?.label ?? null,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
      },
      error: null,
    };
  } catch {
    return { share: null, error: "unavailable" };
  }
}

function Unavailable({ kind }: { kind: "missing" | "expired" | "unavailable" }) {
  const copy =
    kind === "expired"
      ? { title: "This link has expired", body: "Ask the owner for a fresh link. Shared resumes expire so old copies do not stay public." }
      : kind === "unavailable"
        ? { title: "This resume could not be loaded", body: "The link is valid but the file is temporarily unavailable. Try again in a moment." }
        : { title: "This link is not available", body: "It may have been removed, revoked or mistyped. Ask the owner to create a new link." };
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full border bg-card p-4">
        <Link2Off className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="mt-4 text-xl font-semibold">{copy.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      <Link href="/" className="mt-5 inline-flex items-center gap-1.5 text-xs text-forge-700 hover:underline dark:text-forge-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Go to ResumeForge
      </Link>
    </div>
  );
}

export default async function SharedResumePage({ params }: { params: { token: string } }) {
  const { share, error } = await loadShare(params.token);

  if (!share || error) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background/80 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <Logo />
            <span className="text-[11px] text-muted-foreground">Read only share</span>
          </div>
        </header>
        <Unavailable kind={error ?? "missing"} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <Logo />
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-forge-600" /> Read only share
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{share.title}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>Shared {formatDate(share.createdAt)}</span>
              {share.expiresAt && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> Expires {formatDate(share.expiresAt)}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/share/${params.token}/export?format=pdf`} className="inline-flex items-center gap-1.5 rounded-lg bg-forge-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-forge-800">
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
            <a href={`/api/share/${params.token}/export?format=docx`} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-medium transition hover:bg-accent">
              <Download className="h-3.5 w-3.5" /> DOCX
            </a>
            <a href={`/api/share/${params.token}/export?format=txt`} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-medium transition hover:bg-accent">
              <Download className="h-3.5 w-3.5" /> TXT
            </a>
          </div>
        </div>

        <div className="paper overflow-hidden rounded-lg border shadow-lift">
          <ResumePreview data={share.data} design={share.design} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>The owner controls this link. Downloads run a final source check.</span>
          <Link href="/" className="text-forge-700 hover:underline dark:text-forge-300">Built with ResumeForge</Link>
        </div>
      </main>
    </div>
  );
}
