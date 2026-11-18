import { apiHandler, json, requireApiUser } from "@/lib/api";
import { factCheckSchema } from "@/lib/requests";
import { buildFactCheck, runLlmFactCheck } from "@/lib/ai";
import { collectUserProvidedAnswers, fingerprintFinding } from "@/lib/fact-check";
import { getOwnedResume, resolveResumeContent } from "@/lib/server-data";
import type { FactCheckFinding, ResumeData } from "@/lib/types";
import type { FactCheckResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 45;

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = factCheckSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, params.id);
  const resolved = await resolveResumeContent(resume, body.versionId);
  const data = body.data ?? resolved.data;
  const base = (body.versionId ? resume.parsed : null) as unknown as ResumeData | null;
  const answers = [...(body.answers ?? []), ...collectUserProvidedAnswers(data)];

  const factCheck = await buildFactCheck(data, base, resume.rawText, {
    answers,
    confirmations: body.confirmations,
    checkIdentity: Boolean(base),
  });

  const second = await runLlmFactCheck(data, base ?? data, answers).catch(() => ({ result: [], used: false }));
  if (second.used && second.result.length) {
    const existing = new Set(factCheck.findings.map((f) => `${f.location}|${f.claim}`.toLowerCase()));
    const extra: FactCheckFinding[] = second.result
      .filter((f) => !existing.has(`${f.location}|${f.claim}`.toLowerCase()))
      .slice(0, 6)
      .map((f, index) => ({
        id: `llm_${index}`,
        fingerprint: fingerprintFinding({ location: f.location, claim: f.claim, reason: f.reason }),
        severity: f.severity,
        claim: f.claim,
        location: f.location,
        reason: f.reason,
        suggestion: f.suggestion,
        blocking: false,
        confirmed: false,
      }));
    const merged = [...factCheck.findings, ...extra];
    const blocking = merged.filter((f) => f.blocking).length;
    factCheck.findings = merged;
    factCheck.blocking = blocking;
    factCheck.warnings = merged.length - blocking;
    factCheck.passed = blocking === 0;
  }

  const payload: FactCheckResponse = { factCheck };
  return json(payload);
});
