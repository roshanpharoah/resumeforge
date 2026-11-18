"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, label = false }: { className?: string; label?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size={label ? "sm" : "icon"}
      onClick={toggleTheme}
      className={cn("text-muted-foreground", className)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {label && <span>{dark ? "Light mode" : "Dark mode"}</span>}
    </Button>
  );
}
