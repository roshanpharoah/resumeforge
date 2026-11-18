import { describe, expect, it } from "vitest";
import { collectUserProvidedAnswers, factCheckProse, factCheckResume } from "@/lib/fact-check";
import { sampleResume, SOURCE_TEXT } from "./fixtures";
import type { ResumeData } from "@/lib/types";

function withBulletText(data: ResumeData, text: string): ResumeData {
  return {
    ...data,
    experience: data.experience.map((role, index) =>
      index === 0
        ? { ...role, bullets: role.bullets.map((bullet, bulletIndex) => (bulletIndex === 0 ? { ...bullet, text } : bullet)) }
        : role,
    ),
  };
}

describe("factCheckResume", () => {
  it("passes a resume whose claims all trace to the source text", () => {
    const result = factCheckResume({ data: sampleResume(), sourceText: SOURCE_TEXT });
    expect(result.blocking).toBe(0);
    expect(result.passed).toBe(true);
  });

  it("blocks a metric that does not appear in the source", () => {
    const data = withBulletText(sampleResume(), "Reduced load time by 45 percent.");
    const result = factCheckResume({ data, sourceText: SOURCE_TEXT });
    expect(result.passed).toBe(false);
    expect(result.blocking).toBeGreaterThan(0);
    expect(result.findings.some((finding) => finding.blocking && finding.claim.includes("45"))).toBe(true);
  });

  it("blocks unresolved placeholders", () => {
    const data = sampleResume({ summary: "Engineer targeting [role] roles." });
    const result = factCheckResume({ data, sourceText: SOURCE_TEXT });
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.blocking && finding.claim.includes("[role]"))).toBe(true);
  });

  it("does not clear a placeholder with a confirmation", () => {
    const data = sampleResume({ summary: "Engineer targeting [role] roles." });
    const first = factCheckResume({ data, sourceText: SOURCE_TEXT });
    const target = first.findings.find((finding) => finding.claim === "[role]");
    expect(target).toBeDefined();
    expect(target!.confirmable).toBe(false);
    const second = factCheckResume({ data, sourceText: SOURCE_TEXT, confirmations: [target!.fingerprint] });
    const after = second.findings.find((finding) => finding.fingerprint === target!.fingerprint);
    expect(after?.blocking).toBe(true);
    expect(after?.confirmed).toBe(false);
    expect(second.passed).toBe(false);
  });

  it("does not clear a placed planned project with a confirmation", () => {
    const base = sampleResume();
    const data = sampleResume({
      projects: [
        {
          ...base.projects[0],
          id: "proj_planned",
          name: "Portfolio rebuild",
          planned: true,
          description: "",
          url: "",
          bullets: [],
        },
      ],
    });
    const first = factCheckResume({ data, sourceText: SOURCE_TEXT });
    const target = first.findings.find((finding) => /planned/i.test(finding.reason));
    expect(target).toBeDefined();
    expect(target!.confirmable).toBe(false);
    const second = factCheckResume({ data, sourceText: SOURCE_TEXT, confirmations: [target!.fingerprint] });
    const after = second.findings.find((finding) => finding.fingerprint === target!.fingerprint);
    expect(after?.blocking).toBe(true);
    expect(after?.confirmed).toBe(false);
    expect(second.passed).toBe(false);
  });

  it("uses saved user answers and accepted summaries as evidence", () => {
    const base = sampleResume();
    const answer = "Cut onboarding time by 40 percent.";
    const summary = "Software engineer with three years of experience building internal reporting tools.";
    const data = sampleResume({
      summary,
      summarySource: { type: "user_answer", ref: "Saved from summary generator", quote: summary },
      experience: [
        {
          ...base.experience[0],
          bullets: base.experience[0].bullets.map((bullet, index) =>
            index === 0 ? { ...bullet, text: answer, source: { type: "user_answer", ref: "Gap answer", quote: answer } } : bullet,
          ),
        },
      ],
    });

    const answers = collectUserProvidedAnswers(data);
    expect(answers).toContain(answer);
    expect(answers).toContain(summary);

    const withoutAnswers = factCheckResume({ data, sourceText: SOURCE_TEXT });
    expect(withoutAnswers.findings.some((finding) => finding.blocking && finding.claim.includes("40"))).toBe(true);

    const withAnswers = factCheckResume({ data, sourceText: SOURCE_TEXT, answers });
    expect(withAnswers.findings.some((finding) => finding.blocking && finding.claim.includes("40"))).toBe(false);
  });

  it("blocks an employer change against the base resume", () => {
    const base = sampleResume();
    const data: ResumeData = {
      ...base,
      experience: base.experience.map((role) => ({ ...role, company: "Globex" })),
    };
    const result = factCheckResume({ data, base, sourceText: SOURCE_TEXT, checkIdentity: true });
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.blocking && finding.claim.includes("Globex"))).toBe(true);
  });

  it("clears a blocker once its fingerprint is confirmed", () => {
    const data = withBulletText(sampleResume(), "Reduced load time by 45 percent.");
    const first = factCheckResume({ data, sourceText: SOURCE_TEXT });
    const target = first.findings.find((finding) => finding.blocking && finding.claim.includes("45"));
    expect(target).toBeDefined();
    const second = factCheckResume({ data, sourceText: SOURCE_TEXT, confirmations: [target!.fingerprint] });
    expect(second.blocking).toBeLessThan(first.blocking);
    const confirmed = second.findings.find((finding) => finding.fingerprint === target!.fingerprint);
    expect(confirmed?.confirmed).toBe(true);
    expect(confirmed?.blocking).toBe(false);
  });

  it("blocks a planned project that was placed on the resume", () => {
    const base = sampleResume();
    const data = sampleResume({
      projects: [
        {
          ...base.projects[0],
          id: "proj_planned",
          name: "Portfolio rebuild",
          planned: true,
          description: "",
          url: "",
          bullets: [],
        },
      ],
    });
    const result = factCheckResume({ data, sourceText: SOURCE_TEXT });
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.blocking && /planned/i.test(finding.reason))).toBe(true);
  });

  it("blocks a skill that is absent from the source", () => {
    const data = sampleResume({
      skills: [...sampleResume().skills, { id: "skills_extra", name: "Cloud", skills: ["Kubernetes"] }],
    });
    const result = factCheckResume({ data, sourceText: SOURCE_TEXT });
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.blocking && finding.claim === "Kubernetes")).toBe(true);
  });
});

describe("factCheckProse", () => {
  it("allows a sentence supported by the supplied source", () => {
    const result = factCheckProse({
      text: "Built dashboards with React.",
      sources: ["Built dashboards with React."],
      label: "Bullet",
    });
    expect(result.passed).toBe(true);
    expect(result.blocking).toBe(0);
  });

  it("blocks an invented metric in generated prose", () => {
    const result = factCheckProse({
      text: "Grew revenue by 82 percent.",
      sources: ["Managed the weekly report."],
      label: "Bullet",
    });
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.blocking && finding.claim.includes("82"))).toBe(true);
  });

  it("does not clear a prose placeholder with a confirmation", () => {
    const first = factCheckProse({
      text: "Built the [system] dashboard.",
      sources: ["Built the reporting dashboard."],
      label: "Summary",
    });
    const target = first.findings.find((finding) => finding.claim === "[system]");
    expect(target).toBeDefined();
    expect(target!.confirmable).toBe(false);
    const second = factCheckProse({
      text: "Built the [system] dashboard.",
      sources: ["Built the reporting dashboard."],
      label: "Summary",
      confirmations: [target!.fingerprint],
    });
    const after = second.findings.find((finding) => finding.fingerprint === target!.fingerprint);
    expect(after?.blocking).toBe(true);
    expect(after?.confirmed).toBe(false);
    expect(second.passed).toBe(false);
  });

  it("flags banned phrasing as a warning rather than a blocker", () => {
    const result = factCheckProse({
      text: "Responsible for the weekly report.",
      sources: ["Responsible for the weekly report."],
      label: "Bullet",
    });
    expect(result.blocking).toBe(0);
    expect(result.warnings).toBeGreaterThan(0);
    expect(result.findings.some((finding) => /banned|cliche/i.test(finding.reason) && /responsible/i.test(finding.claim))).toBe(true);
  });
});
