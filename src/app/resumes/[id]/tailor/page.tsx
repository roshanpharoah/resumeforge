import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { TailorView } from "@/components/tailor-view";

export const metadata: Metadata = { title: "Tailor resume" };
export const dynamic = "force-dynamic";

export default function TailorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { jobId?: string };
}) {
  return (
    <AppShell>
      <TailorView resumeId={params.id} initialJobId={searchParams.jobId ?? "none"} />
    </AppShell>
  );
}
