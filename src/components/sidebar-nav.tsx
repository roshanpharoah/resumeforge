"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, KanbanSquare, LayoutDashboard, Settings, Sparkles, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: ["/dashboard"] },
  { href: "/resumes", label: "Resumes", icon: FileText, match: ["/resumes"] },
  { href: "/jobs", label: "Applications", icon: KanbanSquare, match: ["/jobs", "/applications"] },
  { href: "/tools", label: "Tools", icon: Wrench, match: ["/tools"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {navItems.map((item) => {
        const active = item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className={cn("h-4 w-4", active ? "text-forge-600 dark:text-forge-400" : "text-muted-foreground group-hover:text-foreground")} />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-forge-600 dark:text-forge-400" />
          Truth first
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Nothing ships until every claim traces back to something you wrote.
        </p>
      </div>
    </nav>
  );
}
