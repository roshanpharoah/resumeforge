import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ToolsView } from "@/components/tools-view";

export const metadata: Metadata = { title: "Tools" };
export const dynamic = "force-dynamic";

export default function ToolsPage({ searchParams }: { searchParams: { tab?: string } }) {
  return (
    <AppShell>
      <ToolsView initialTab={searchParams.tab} />
    </AppShell>
  );
}
