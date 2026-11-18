"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SidebarNav } from "@/components/sidebar-nav";
import { Logo } from "@/components/logo";
import Link from "next/link";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-full w-[290px] max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-4">
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <Link href="/dashboard" onClick={() => setOpen(false)} className="mb-6 inline-block">
          <Logo />
        </Link>
        <SidebarNav onNavigate={() => setOpen(false)} />
        <div className="mt-6 border-t pt-4">
          <Link href="/onboarding" onClick={() => setOpen(false)}>
            <Button variant="forge" className="w-full">
              New resume
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
