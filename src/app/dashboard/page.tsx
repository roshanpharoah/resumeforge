import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
