import { defaultDesign, resumeDataSchema, type DesignTokens, type ResumeData } from "@/lib/types";

export const SOURCE_TEXT = [
  "Jordan Lee",
  "Software Engineer at Acme",
  "2022 to 2024",
  "Built dashboards with React for the support team.",
  "Reduced load time by 30 percent.",
  "Three years of experience building internal tools.",
  "Skills: TypeScript, React, SQL",
  "State University",
  "Bachelor of Science in Computer Science",
  "2018 to 2022",
].join("\n");

export function sampleResume(overrides: Partial<ResumeData> = {}): ResumeData {
  const parsed = resumeDataSchema.parse({
    contact: {
      fullName: "Jordan Lee",
      headline: "Software Engineer",
      email: "jordan.lee@example.com",
      phone: "555 010 2233",
      location: "Austin, TX",
      linkedin: "linkedin.com/in/jordanlee",
      website: "jordanlee.dev",
      github: "github.com/jordanlee",
    },
    summary: "Software engineer with three years of experience building internal reporting tools.",
    experience: [
      {
        id: "exp_1",
        company: "Acme",
        title: "Software Engineer",
        location: "Austin, TX",
        startDate: "2022",
        endDate: "2024",
        current: false,
        bullets: [
          {
            id: "b_1",
            text: "Built dashboards with React for the support team.",
            source: { type: "user_text", ref: "uploaded resume", quote: "Built dashboards with React for the support team." },
          },
          {
            id: "b_2",
            text: "Reduced load time by 30 percent.",
            source: { type: "user_text", ref: "uploaded resume", quote: "Reduced load time by 30 percent." },
          },
          {
            id: "b_3",
            text: "Partnered with two analysts to document the weekly reporting workflow.",
            source: { type: "user_text", ref: "uploaded resume", quote: "Partnered with two analysts to document the weekly reporting workflow." },
          },
        ],
      },
    ],
    education: [
      {
        id: "edu_1",
        institution: "State University",
        degree: "Bachelor of Science",
        field: "Computer Science",
        startDate: "2018",
        endDate: "2022",
      },
    ],
    skills: [
      { id: "skills_1", name: "Languages", skills: ["TypeScript", "SQL"] },
      { id: "skills_2", name: "Frameworks", skills: ["React"] },
    ],
    projects: [
      {
        id: "proj_1",
        name: "Reporting starter",
        description: "Small dashboard built with React and SQL.",
        bullets: [
          {
            id: "pb_1",
            text: "Built a dashboard with React and SQL.",
            source: { type: "user_text", ref: "uploaded resume", quote: "Built a dashboard with React and SQL." },
            verified: true,
            metricPlaceholder: false,
            keywords: [],
          },
        ],
      },
    ],
    certifications: [],
    awards: [],
    custom: [],
    sectionOrder: ["summary", "experience", "projects", "education", "skills", "certifications", "awards"],
    ...overrides,
  });
  return parsed;
}

/** A deliberately bare resume with no contact details, summary, education or skills. */
export function bareResume(): ResumeData {
  const base = sampleResume();
  return sampleResume({
    contact: { ...base.contact, email: "", phone: "", location: "" },
    summary: "",
    experience: [
      {
        ...base.experience[0],
        id: "exp_bare",
        company: "Acme",
        title: "Engineer",
        startDate: "",
        endDate: "",
        current: false,
        bullets: [{ ...base.experience[0].bullets[0], id: "b_bare", text: "Did work on the team." }],
      },
    ],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    awards: [],
    custom: [],
  });
}

export const SAMPLE_JD = [
  "Senior Frontend Engineer at Northwind",
  "We are hiring a frontend engineer to build customer facing dashboards.",
  "Required: TypeScript, React, Next.js, accessibility and web performance.",
  "Preferred: GraphQL, Playwright and design systems experience.",
  "You will partner with product designers and backend engineers.",
  "Salary: $130,000 to $160,000.",
].join("\n");

export const TARGET_DESIGN: DesignTokens = defaultDesign;
