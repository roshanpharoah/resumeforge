"use client";

import { useState } from "react";
import { Linkedin, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FactCheckList } from "@/components/fact-check-list";
import { CopyButton, EmptyToolState, ToolCard, sourceLine } from "@/components/tools/tool-ui";
import { api, errorMessage } from "@/lib/client";
import type { LinkedInResponse } from "@/lib/api-types";
import type { ResumeDetailDto } from "@/lib/serializers";
import type { LinkedInResult } from "@/lib/types";
import { toast } from "sonner";

export function LinkedInTool({
  resume,
  resumeId,
  jobId,
  jobsCount,
}: {
  resume: ResumeDetailDto | null;
  resumeId: string;
  jobId: string;
  jobsCount: number;
}) {
  const [linkedin, setLinkedin] = useState<LinkedInResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const response = await api<LinkedInResponse>("/api/tools/linkedin", {
        method: "POST",
        body: JSON.stringify({ resumeId, jobId }),
      });
      setLinkedin(response.linkedin);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function confirm(fingerprint: string) {
    if (!linkedin) return;
    const findings = linkedin.factCheck.findings.map((finding) =>
      finding.fingerprint === fingerprint ? { ...finding, confirmed: true, blocking: false } : finding,
    );
    setLinkedin({ ...linkedin, factCheck: { ...linkedin.factCheck, findings, blocking: findings.filter((finding) => finding.blocking).length } });
  }

  if (!resume) {
    return (
      <ToolCard title="LinkedIn optimizer" description="A headline, About section and skills list built from your resume and one target role.">
        <EmptyToolState title="Choose a resume first" description="The optimizer uses your real roles and skills, not a generic template." />
      </ToolCard>
    );
  }

  if (!jobsCount) {
    return (
      <ToolCard title="LinkedIn optimizer" description="A headline, About section and skills list built from your resume and one target role.">
        <EmptyToolState title="Save a job first" description="LinkedIn copy needs a target role. Add an application, then come back with that job selected." />
      </ToolCard>
    );
  }

  return (
    <div className="space-y-5">
      <ToolCard
        title="Target role"
        description={jobId === "none" ? "Pick a saved job in the bar above, then generate." : "The selected job shapes the headline and the skills order."}
        action={
          <Button variant="forge" onClick={() => void generate()} disabled={loading || jobId === "none"}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {loading ? "Writing..." : "Generate profile copy"}
          </Button>
        }
      >
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          <Linkedin className="h-4 w-4 text-forge-600" />
          Nothing is scraped from LinkedIn. You paste or download the copy yourself.
        </div>
      </ToolCard>

      {!linkedin && !loading && (
        <ToolCard title="Profile copy" description="Headline, About, skills and featured ideas.">
          <EmptyToolState title="Nothing generated yet" description="Select the job you are targeting, then generate. Every claim is checked against your resume." />
        </ToolCard>
      )}

      {loading && (
        <ToolCard title="Profile copy">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-forge-600" /> Writing from your resume...
          </div>
        </ToolCard>
      )}

      {linkedin && !loading && (
        <>
          <ToolCard
            title="Headline"
            description={sourceLine(linkedin.generatedBy)}
            action={<CopyButton text={linkedin.headline} label="Copy headline" />}
          >
            <p className="rounded-lg border bg-muted/20 p-4 text-sm font-medium leading-relaxed">{linkedin.headline}</p>
          </ToolCard>

          <ToolCard title="About" action={<CopyButton text={linkedin.about} label="Copy About" />}>
            <p className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed">{linkedin.about}</p>
          </ToolCard>

          <div className="grid gap-4 md:grid-cols-2">
            <ToolCard
              title="Skills to list"
              description="Only skills already on the resume."
              action={<CopyButton text={linkedin.skills.join(", ")} label="Copy skills" />}
            >
              <div className="flex flex-wrap gap-1.5">
                {linkedin.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                {!linkedin.skills.length && <p className="text-xs text-muted-foreground">No skills matched.</p>}
              </div>
            </ToolCard>

            <ToolCard title="Featured ideas" description="Use only projects or posts you can actually show.">
              <ul className="space-y-2">
                {linkedin.featuredSuggestions.map((item) => (
                  <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forge-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </ToolCard>
          </div>

          <ToolCard title="Source check" description="Copy is held to the same truth rule as the resume.">
            <FactCheckList result={linkedin.factCheck} onConfirm={confirm} />
          </ToolCard>
        </>
      )}
    </div>
  );
}
