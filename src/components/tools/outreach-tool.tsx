"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton, ToolCard } from "@/components/tools/tool-ui";
import { outreachTemplates } from "@/lib/outreach";
import type { JobSummaryDto, ResumeDetailDto } from "@/lib/serializers";

export function OutreachTool({ resume, jobs }: { resume: ResumeDetailDto | null; jobs: JobSummaryDto[] }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState("none");

  const displayName = name.trim() || resume?.data.contact.fullName || "";
  const templates = outreachTemplates(company, role, displayName);

  function loadJob(id: string) {
    setJobId(id);
    const job = jobs.find((item) => item.id === id);
    if (!job) return;
    setCompany(job.company);
    setRole(job.title);
  }

  return (
    <div className="space-y-5">
      <ToolCard
        title="Message details"
        description="Plain templates you fill in. No fake familiarity, no invented referral and no pressure language."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Load from a saved job</Label>
            <Select value={jobId} onValueChange={loadJob}>
              <SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {jobs.map((job) => <SelectItem key={job.id} value={job.id}>{job.title} at {job.company}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Company</Label>
            <Input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Role</Label>
            <Input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Role title" />
          </div>
        </div>
        <div className="mt-3 max-w-sm space-y-1.5">
          <Label className="text-[11px]">Your name in the message</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={resume?.data.contact.fullName || "Your name"} />
        </div>
      </ToolCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <section key={template.label} className="flex flex-col rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{template.label}</h2>
              <Badge variant="outline">{template.channel}</Badge>
            </div>
            <p className="mt-3 flex-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{template.body}</p>
            <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Mail className="h-3 w-3" /> Edit brackets before sending</span>
              <CopyButton text={template.body} variant="ghost" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
