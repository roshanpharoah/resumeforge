import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("h-8 w-8", className)}>
      <defs>
        <linearGradient id="rf-mark" x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0b8f7b" />
          <stop offset="1" stopColor="#0e4b45" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#rf-mark)" />
      <path d="M12 11.5h12.2c2.4 0 4.3 1.9 4.3 4.3 0 2.2-1.6 4-3.7 4.3l4 8.4h-4.3l-3.6-8h-4.6v8H12V11.5Z" fill="white" fillOpacity="0.95" />
      <path d="M16.3 15.3h7.3c.9 0 1.6.7 1.6 1.6 0 .9-.7 1.6-1.6 1.6h-7.3v-3.2Z" fill="#0b8f7b" />
      <circle cx="29.5" cy="10.5" r="2.2" fill="#5eead4" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[17px] font-semibold tracking-tight">
        Resume<span className="text-forge-600 dark:text-forge-400">Forge</span>
      </span>
    </span>
  );
}
