import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";
import { DatabaseZap, Plus } from "lucide-react";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const dbConfigured = Boolean(process.env.DATABASE_URL);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-card/60 px-4 py-5 backdrop-blur lg:flex">
        <Link href="/dashboard" className="px-2" aria-label="ResumeForge dashboard">
          <Logo />
        </Link>
        <div className="mt-7 flex-1">
          <SidebarNav />
        </div>
        <div className="border-t pt-4">
          <Link href="/onboarding" className="block">
            <Button variant="forge" className="w-full justify-start gap-2">
              <Plus className="h-4 w-4" /> New resume
            </Button>
          </Link>
          <div className="mt-4 flex items-center justify-between px-1">
            <UserMenu user={user} />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur lg:hidden">
          <Link href="/dashboard" aria-label="ResumeForge dashboard">
            <Logo markClassName="h-7 w-7" />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
            <MobileNav />
          </div>
        </header>

        {!dbConfigured && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="mx-auto flex max-w-7xl items-center gap-2">
              <DatabaseZap className="h-3.5 w-3.5 shrink-0" />
              <span>
                Database not configured. Add <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">DATABASE_URL</code> to{" "}
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">.env</code> and run{" "}
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">npm run db:push</code>. Pages will load, saves will not persist.
              </span>
            </div>
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
