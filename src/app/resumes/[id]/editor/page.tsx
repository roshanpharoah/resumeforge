import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { EditorView } from "@/components/editor-view";

export const metadata: Metadata = { title: "Resume editor" };
export const dynamic = "force-dynamic";

export default function EditorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  return (
    <AppShell>
      <EditorView resumeId={params.id} initialTab={searchParams.tab} />
    </AppShell>
  );
}
