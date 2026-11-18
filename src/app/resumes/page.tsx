import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ResumesView } from "@/components/resumes-view";

export const metadata: Metadata = { title: "Resumes" };
export const dynamic = "force-dynamic";

export default function ResumesPage() {
  return (
    <AppShell>
      <ResumesView />
    </AppShell>
  );
}
