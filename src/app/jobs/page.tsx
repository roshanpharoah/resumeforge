import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { JobsView } from "@/components/jobs-view";

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

export default function JobsPage() {
  return (
    <AppShell>
      <JobsView />
    </AppShell>
  );
}
