"use client";

import { useMemo, useState } from "react";
import { Check, Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton, ToolCard } from "@/components/tools/tool-ui";
import { keywordLibrary, type KeywordLibraryRole } from "@/lib/keywords";
import type { ResumeDetailDto } from "@/lib/serializers";
import { resumeToPlainText } from "@/lib/types";
import { containsPhrase } from "@/lib/text";
import { cn } from "@/lib/utils";

function roleCoverage(role: KeywordLibraryRole, text: string) {
  const all = [...role.core, ...role.tools, ...role.soft];
  const covered = all.filter((keyword) => containsPhrase(text, keyword));
  return { covered: covered.length, total: all.length, coveredSet: new Set(covered.map((keyword) => keyword.toLowerCase())) };
}

export function KeywordLibraryTool({ resume }: { resume: ResumeDetailDto | null }) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const text = useMemo(() => (resume ? resumeToPlainText(resume.data) : ""), [resume]);

  const industries = useMemo(() => [...new Set(keywordLibrary.map((role) => role.industry))].sort(), []);
  const roles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keywordLibrary.filter((role) => {
      const industryMatch = industry === "all" || role.industry === industry;
      const queryMatch =
        !q ||
        role.title.toLowerCase().includes(q) ||
        role.industry.toLowerCase().includes(q) ||
        [...role.core, ...role.tools, ...role.soft].some((keyword) => keyword.toLowerCase().includes(q));
      return industryMatch && queryMatch;
    });
  }, [query, industry]);

  return (
    <div className="space-y-5">
      <ToolCard
        title="Role vocabulary"
        description="Common terms by role, so you can describe real work in the language a screener expects. This is not a list of claims to add."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a role, tool or skill" className="pl-9" />
          </div>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All industries</SelectItem>
              {industries.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Highlighted chips already appear in {resume ? "this resume" : "a resume once you choose one"}. Add a term only after you have done the work it describes.</span>
        </div>
      </ToolCard>

      {!roles.length ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">No role matches that search. Try a broader term.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {roles.map((role) => {
            const coverage = resume ? roleCoverage(role, text) : null;
            const all = [...role.core, ...role.tools, ...role.soft];
            return (
              <section key={role.id} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">{role.title}</h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{role.industry}. {role.description}</p>
                  </div>
                  {coverage && (
                    <Badge variant={coverage.covered === 0 ? "outline" : coverage.covered >= coverage.total / 2 ? "success" : "warning"}>
                      {coverage.covered} of {coverage.total} covered
                    </Badge>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    { label: "Core", items: role.core },
                    { label: "Tools", items: role.tools },
                    { label: "Soft skills", items: role.soft },
                  ].map((group) => (
                    <div key={group.label}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {group.items.map((keyword) => {
                          const covered = coverage?.coveredSet.has(keyword.toLowerCase()) ?? false;
                          return (
                            <span
                              key={keyword}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                                covered
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                                  : "bg-muted/30 text-muted-foreground",
                              )}
                            >
                              {covered && <Check className="h-2.5 w-2.5" />}
                              {keyword}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end border-t pt-3">
                  <CopyButton text={`${role.title} keywords: ${all.join(", ")}`} label="Copy vocabulary" variant="ghost" />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
