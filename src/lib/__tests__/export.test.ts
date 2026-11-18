import { describe, expect, it } from "vitest";
import { renderResumeDocx } from "@/lib/export";
import { sampleResume, TARGET_DESIGN } from "./fixtures";

describe("renderResumeDocx", () => {
  it("renders a DOCX with a standard six-digit accent", async () => {
    const buffer = await renderResumeDocx(sampleResume(), { ...TARGET_DESIGN, accent: "#0f766e" });
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  it("normalizes shorthand and alpha accent values", async () => {
    for (const accent of ["#abc", "#0f766e55"]) {
      const buffer = await renderResumeDocx(sampleResume(), { ...TARGET_DESIGN, accent });
      expect(buffer.subarray(0, 2).toString()).toBe("PK");
    }
  });
});
