import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AnalyzeView } from "@/components/analyze-view";

export const metadata: Metadata = { title: "ATS report" };
export const dynamic = "force-dynamic";

export default function AnalyzePage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <AnalyzeView resumeId={params.id} />
    </AppShell>
  );
}
