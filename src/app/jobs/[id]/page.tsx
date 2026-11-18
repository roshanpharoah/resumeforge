import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { JobDetailView } from "@/components/job-detail-view";

export const metadata: Metadata = { title: "Application" };
export const dynamic = "force-dynamic";

export default function JobDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <JobDetailView jobId={params.id} />
    </AppShell>
  );
}
