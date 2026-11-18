import { PrismaClient, Prisma } from "@prisma/client";
import { defaultDesign, resumeDataSchema, resumeToPlainText } from "../src/lib/types";
import { extractJd } from "../src/lib/keywords";
import { analyzeResume } from "../src/lib/scoring";

const prisma = new PrismaClient();

const resume = resumeDataSchema.parse({
  contact: {
    fullName: "Jordan Lee",
    headline: "Frontend Engineer",
    email: "jordan.lee@example.com",
    phone: "555 010 2233",
    location: "Austin, TX",
    linkedin: "linkedin.com/in/jordanlee",
    website: "jordanlee.dev",
    github: "github.com/jordanlee",
  },
  summary:
    "Frontend engineer with three years of experience building internal reporting tools in React and TypeScript. Reduced dashboard load time by 30 percent for a support team of 40 people.",
  experience: [
    {
      id: "seed_exp_1",
      company: "Acme Support Tools",
      title: "Frontend Engineer",
      location: "Austin, TX",
      startDate: "2022",
      endDate: "2024",
      current: false,
      bullets: [
        {
          id: "seed_bullet_1",
          text: "Rebuilt the support dashboard in React and TypeScript for 40 agents.",
          source: { type: "user_text", ref: "seeded sample", quote: "Rebuilt the support dashboard in React and TypeScript for 40 agents." },
        },
        {
          id: "seed_bullet_2",
          text: "Reduced dashboard load time by 30 percent after profiling the largest tables.",
          source: { type: "user_text", ref: "seeded sample", quote: "Reduced dashboard load time by 30 percent after profiling the largest tables." },
        },
        {
          id: "seed_bullet_3",
          text: "Partnered with two analysts to document the weekly reporting workflow.",
          source: { type: "user_text", ref: "seeded sample", quote: "Partnered with two analysts to document the weekly reporting workflow." },
        },
      ],
    },
    {
      id: "seed_exp_2",
      company: "Brightline Studio",
      title: "Junior Developer",
      location: "Remote",
      startDate: "2021",
      endDate: "2022",
      current: false,
      bullets: [
        {
          id: "seed_bullet_4",
          text: "Built accessible marketing pages in HTML, CSS and JavaScript.",
          source: { type: "user_text", ref: "seeded sample", quote: "Built accessible marketing pages in HTML, CSS and JavaScript." },
        },
        {
          id: "seed_bullet_5",
          text: "Wrote component tests in Jest for the shared form library.",
          source: { type: "user_text", ref: "seeded sample", quote: "Wrote component tests in Jest for the shared form library." },
        },
      ],
    },
  ],
  education: [
    {
      id: "seed_edu_1",
      institution: "State University",
      degree: "Bachelor of Science",
      field: "Computer Science",
      location: "Austin, TX",
      startDate: "2017",
      endDate: "2021",
    },
  ],
  skills: [
    { id: "seed_skills_1", name: "Languages", skills: ["TypeScript", "JavaScript", "SQL"] },
    { id: "seed_skills_2", name: "Frameworks and tools", skills: ["React", "Next.js", "Jest", "Git"] },
  ],
  projects: [
    {
      id: "seed_project_1",
      name: "Report card",
      role: "Solo project",
      description: "A small dashboard that turns CSV exports into a weekly summary.",
      url: "https://github.com/jordanlee/report-card",
      bullets: [{ id: "seed_project_bullet_1", text: "Built the dashboard with React and SQL." }],
    },
  ],
  certifications: [],
  awards: [],
  custom: [],
  sectionOrder: ["summary", "experience", "projects", "education", "skills", "certifications", "awards"],
});

const design = { ...defaultDesign, templateId: "ats-classic", accent: "#0f766e" };
const rawText = resumeToPlainText(resume);

const northwindJd = [
  "Senior Frontend Engineer at Northwind",
  "We build customer facing analytics products for operations teams.",
  "Required: TypeScript, React, Next.js, accessibility, web performance and experience with design systems.",
  "Preferred: GraphQL, Playwright, SQL and experience mentoring junior engineers.",
  "You will partner with product designers and backend engineers to ship weekly.",
  "Salary: $135,000 to $165,000.",
].join("\n");

const ledgerJd = [
  "Product Engineer at Ledgerline",
  "Small team building finance workflows for small businesses.",
  "Required: TypeScript, React, Node.js, PostgreSQL and REST APIs.",
  "Preferred: Next.js, Prisma, testing and experience with accounting data.",
  "Salary: $120,000 to $145,000.",
].join("\n");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed. Copy .env.example to .env and run npm run db:push first.");
  }

  const user = await prisma.user.upsert({
    where: { email: "demo@resumeforge.local" },
    update: { name: "Jordan Lee", headline: "Frontend Engineer", location: "Austin, TX" },
    create: {
      email: "demo@resumeforge.local",
      name: "Jordan Lee",
      headline: "Frontend Engineer",
      location: "Austin, TX",
      emailVerified: new Date(),
    },
  });

  const createdResume = await prisma.resume.upsert({
    where: { id: "seed_resume_frontend" },
    update: {
      userId: user.id,
      title: "Frontend engineer, core",
      rawText,
      parsed: resume as unknown as Prisma.InputJsonValue,
      design: design as unknown as Prisma.InputJsonValue,
      templateId: design.templateId,
      designSource: "template",
      isPrimary: true,
    },
    create: {
      id: "seed_resume_frontend",
      userId: user.id,
      title: "Frontend engineer, core",
      isPrimary: true,
      rawText,
      parsed: resume as unknown as Prisma.InputJsonValue,
      design: design as unknown as Prisma.InputJsonValue,
      templateId: design.templateId,
      designSource: "template",
      parseRisks: [],
    },
  });

  await prisma.resumeVersion.upsert({
    where: { id: "seed_version_frontend" },
    update: {
      label: "Seeded first draft",
      data: resume as unknown as Prisma.InputJsonValue,
      design: design as unknown as Prisma.InputJsonValue,
      source: "BASE",
    },
    create: {
      id: "seed_version_frontend",
      resumeId: createdResume.id,
      label: "Seeded first draft",
      data: resume as unknown as Prisma.InputJsonValue,
      design: design as unknown as Prisma.InputJsonValue,
      source: "BASE",
    },
  });

  const northwind = extractJd(northwindJd, "Senior Frontend Engineer", "Northwind");
  const ledger = extractJd(ledgerJd, "Product Engineer", "Ledgerline");

  await prisma.job.upsert({
    where: { id: "seed_job_northwind" },
    update: {
      userId: user.id,
      company: "Northwind",
      title: "Senior Frontend Engineer",
      jdText: northwindJd,
      extracted: northwind as unknown as Prisma.InputJsonValue,
      status: "INTERVIEW",
      location: "Remote",
      salaryMin: 135000,
      salaryMax: 165000,
      currency: "USD",
    },
    create: {
      id: "seed_job_northwind",
      userId: user.id,
      company: "Northwind",
      title: "Senior Frontend Engineer",
      jdText: northwindJd,
      extracted: northwind as unknown as Prisma.InputJsonValue,
      status: "INTERVIEW",
      location: "Remote",
      salaryMin: 135000,
      salaryMax: 165000,
      currency: "USD",
      notes: "Seeded sample application. Replace it with your own.",
    },
  });

  await prisma.job.upsert({
    where: { id: "seed_job_ledgerline" },
    update: {
      userId: user.id,
      company: "Ledgerline",
      title: "Product Engineer",
      jdText: ledgerJd,
      extracted: ledger as unknown as Prisma.InputJsonValue,
      status: "APPLIED",
      location: "Hybrid, Austin",
      salaryMin: 120000,
      salaryMax: 145000,
      currency: "USD",
    },
    create: {
      id: "seed_job_ledgerline",
      userId: user.id,
      company: "Ledgerline",
      title: "Product Engineer",
      jdText: ledgerJd,
      extracted: ledger as unknown as Prisma.InputJsonValue,
      status: "APPLIED",
      location: "Hybrid, Austin",
      salaryMin: 120000,
      salaryMax: 145000,
      currency: "USD",
      appliedAt: new Date(),
      notes: "Seeded sample application. Replace it with your own.",
    },
  });

  const analysis = analyzeResume({ resume, jd: northwind, rawText, design });
  await prisma.analysisReport.upsert({
    where: { id: "seed_analysis_frontend" },
    update: {
      score: analysis.score,
      breakdown: analysis.breakdown as unknown as Prisma.InputJsonValue,
      issues: analysis.issues as unknown as Prisma.InputJsonValue,
      keywords: (analysis.keywords ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      meta: analysis.meta as unknown as Prisma.InputJsonValue,
    },
    create: {
      id: "seed_analysis_frontend",
      resumeId: createdResume.id,
      jobId: "seed_job_northwind",
      score: analysis.score,
      breakdown: analysis.breakdown as unknown as Prisma.InputJsonValue,
      issues: analysis.issues as unknown as Prisma.InputJsonValue,
      keywords: (analysis.keywords ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      meta: analysis.meta as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`Seeded demo account: ${user.email}`);
  console.log("Sign in with the email code flow, then open the dashboard.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
