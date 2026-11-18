import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsView />
    </AppShell>
  );
}
