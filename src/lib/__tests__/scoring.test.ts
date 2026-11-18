import { describe, expect, it } from "vitest";
import { analyzeResume, scoreWeights } from "@/lib/scoring";
import { extractJd } from "@/lib/keywords";
import { bareResume, sampleResume, SAMPLE_JD, SOURCE_TEXT, TARGET_DESIGN } from "./fixtures";

describe("analyzeResume", () => {
  it("returns every weighted dimension and a bounded score", () => {
    const analysis = analyzeResume({ resume: sampleResume(), jd: extractJd(SAMPLE_JD), rawText: SOURCE_TEXT, design: TARGET_DESIGN });
    expect(analysis.score).toBeGreaterThanOrEqual(0);
    expect(analysis.score).toBeLessThanOrEqual(100);
    expect(analysis.breakdown).toHaveLength(8);
    expect(analysis.breakdown.map((item) => item.key).sort()).toEqual(Object.keys(scoreWeights).sort());
    expect(analysis.breakdown.reduce((sum, item) => sum + item.max, 0)).toBe(100);
    expect(analysis.issues.every((issue) => issue.id && issue.title && issue.fix)).toBe(true);
    expect(new Set(analysis.issues.map((issue) => issue.id)).size).toBe(analysis.issues.length);
  });

  it("scores a complete targeted resume above a bare resume", () => {
    const strong = analyzeResume({ resume: sampleResume(), jd: extractJd(SAMPLE_JD), rawText: SOURCE_TEXT, design: TARGET_DESIGN });
    const weak = analyzeResume({ resume: bareResume(), rawText: "Jordan Lee. Did work on the team." });
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(weak.issues.length).toBeGreaterThan(0);
    expect(weak.breakdown.find((item) => item.key === "sections")?.score).toBeLessThan(
      strong.breakdown.find((item) => item.key === "sections")?.score ?? 0,
    );
  });

  it("is deterministic for the same input", () => {
    const input = { resume: sampleResume(), jd: extractJd(SAMPLE_JD), rawText: SOURCE_TEXT, design: TARGET_DESIGN };
    const first = analyzeResume(input);
    const second = analyzeResume(input);
    expect(second.score).toBe(first.score);
    expect(second.issues.map((issue) => issue.id)).toEqual(first.issues.map((issue) => issue.id));
  });

  it("separates matched keywords from missing must haves", () => {
    const analysis = analyzeResume({ resume: sampleResume(), jd: extractJd(SAMPLE_JD), rawText: SOURCE_TEXT });
    expect(analysis.keywords).not.toBeNull();
    const matched = analysis.keywords?.matched.map((hit) => hit.keyword.toLowerCase()) ?? [];
    const missing = analysis.keywords?.missing.map((hit) => hit.keyword.toLowerCase()) ?? [];
    expect(matched).toContain("typescript");
    expect(missing).toContain("next.js");
    expect(analysis.keywords?.mustHaveCoverage).toBeGreaterThan(0);
    expect(analysis.keywords?.mustHaveCoverage).toBeLessThan(100);
    expect(analysis.meta.hasJd).toBe(true);
  });

  it("does not treat a missing job description as a keyword failure", () => {
    const analysis = analyzeResume({ resume: sampleResume(), rawText: SOURCE_TEXT });
    expect(analysis.keywords).toBeNull();
    expect(analysis.meta.hasJd).toBe(false);
    const keywords = analysis.breakdown.find((item) => item.key === "keywords");
    expect(keywords?.max).toBe(0);
    expect(keywords?.score).toBe(0);
    expect(keywords?.summary).toMatch(/add a job description/i);
  });

  it("flags banned language and long dashes through writing rules", () => {
    const base = sampleResume();
    const resume = sampleResume({
      summary: "Results-driven engineer who is responsible for reporting.",
      experience: [
        {
          ...base.experience[0],
          id: "exp_style",
          company: "Acme",
          title: "Software Engineer",
          startDate: "2022",
          endDate: "2024",
          current: false,
          bullets: [
            {
              ...base.experience[0].bullets[0],
              id: "b_style",
              text: "Owned the weekly report \u2014 a critical task for the team.",
            },
          ],
        },
      ],
    });
    const analysis = analyzeResume({ resume, rawText: SOURCE_TEXT });
    expect(analysis.score).toBeLessThan(100);
    const details = analysis.breakdown.flatMap((item) => item.details).join(" ").toLowerCase();
    expect(details).toMatch(/buzzword|cliche|dash|style|writing/);
  });
});
