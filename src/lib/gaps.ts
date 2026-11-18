import type { ExtractedJd, GapCategory, GapOptions, KeywordAnalysis, ResumeData } from "@/lib/types";
import { matchKeyword, skillTaxonomy } from "@/lib/keywords";
import { normalize, uniqueBy } from "@/lib/text";
import type { LlmGapOutput } from "@/prompts/schemas";

export interface GapSeed {
  skill: string;
  category: GapCategory;
  importance: "must" | "nice";
  options: GapOptions;
}

interface ProjectTemplate {
  title: string;
  scope: string;
  stack: string[];
  plan: string[];
  repoStructure: string[];
}

function projectFor(skill: string, category: GapCategory): ProjectTemplate {
  const key = normalize(skill);
  const templates: { match: string[]; project: ProjectTemplate }[] = [
    {
      match: ["docker"],
      project: {
        title: "Containerize and ship a small API",
        scope: "Take a small API with a database, add a Dockerfile and Compose setup, then deploy it and document the runbook.",
        stack: ["Docker", "Docker Compose", "Node.js or Python", "PostgreSQL"],
        plan: [
          "Day 1: choose or build a small API with two endpoints and one database table.",
          "Day 2: write a multi-stage Dockerfile and run the service locally.",
          "Day 3: add Compose for the API and database, plus health checks.",
          "Day 4: add environment configuration and a seed script.",
          "Day 5: deploy to a free container host and verify the endpoint.",
          "Day 6: add a README with architecture, commands and one screenshot.",
          "Day 7: write a short post about what broke and how you fixed it.",
        ],
        repoStructure: ["src/", "db/migrations/", "Dockerfile", "docker-compose.yml", "scripts/seed.ts", "tests/", "README.md"],
      },
    },
    {
      match: ["kubernetes", "k8s"],
      project: {
        title: "Deploy a small service on Kubernetes",
        scope: "Run a two-service app on a local or free managed cluster with health checks and a repeatable deploy.",
        stack: ["Kubernetes", "kubectl", "Docker", "Helm or Kustomize"],
        plan: [
          "Day 1: containerize a small API and a worker.",
          "Day 2: create local cluster with kind or minikube.",
          "Day 3: write Deployment and Service manifests with probes.",
          "Day 4: move configuration into ConfigMaps and Secrets.",
          "Day 5: add resource limits and a HorizontalPodAutoscaler.",
          "Day 6: package with Helm or Kustomize and document the deploy.",
          "Day 7: simulate a failing pod and document recovery.",
        ],
        repoStructure: ["app/", "manifests/", "helm/", "scripts/", "docs/runbook.md", "README.md"],
      },
    },
    {
      match: ["aws", "amazon web services"],
      project: {
        title: "Deploy a serverless API on AWS",
        scope: "Build and deploy a small API with managed services, a real database and cost guardrails.",
        stack: ["AWS Lambda", "API Gateway", "DynamoDB or S3", "CloudWatch"],
        plan: [
          "Day 1: define one user story and sketch the request flow.",
          "Day 2: build the handler locally and add tests.",
          "Day 3: provision the function, API route and table with infrastructure as code.",
          "Day 4: add authentication and input validation.",
          "Day 5: add logging, metrics and an alarm.",
          "Day 6: deploy and run a smoke test from a script.",
          "Day 7: write the architecture note and teardown steps.",
        ],
        repoStructure: ["src/handlers/", "infra/", "tests/", "scripts/smoke-test.sh", "docs/architecture.md", "README.md"],
      },
    },
    {
      match: ["azure", "gcp", "google cloud"],
      project: {
        title: `Deploy a small service on ${skill}`,
        scope: "Ship one working service with a managed database, monitoring and a documented deployment.",
        stack: [skill, "Docker", "Terraform or Bicep", "A managed database"],
        plan: [
          "Day 1: choose a small API and write the acceptance criteria.",
          "Day 2: containerize it and run locally.",
          "Day 3: provision the platform resources with infrastructure as code.",
          "Day 4: deploy and connect the managed database.",
          "Day 5: add logs, metrics and one alert.",
          "Day 6: write a rollback procedure and test it.",
          "Day 7: publish the architecture and cost notes.",
        ],
        repoStructure: ["src/", "infra/", "tests/", "docs/architecture.md", "docs/runbook.md", "README.md"],
      },
    },
    {
      match: ["terraform"],
      project: {
        title: "Provision a repeatable cloud environment",
        scope: "Create a small but realistic environment with modules, remote state and a safe destroy path.",
        stack: ["Terraform", "AWS or Azure", "GitHub Actions"],
        plan: [
          "Day 1: define the environment and draw the resource graph.",
          "Day 2: write a network module and variables.",
          "Day 3: add compute and a managed database.",
          "Day 4: configure remote state and locking.",
          "Day 5: add plan checks to CI.",
          "Day 6: apply, verify and then destroy cleanly.",
          "Day 7: document trade-offs and cost controls.",
        ],
        repoStructure: ["modules/network/", "modules/app/", "env/dev/", ".github/workflows/", "docs/", "README.md"],
      },
    },
    {
      match: ["ci/cd", "continuous integration", "jenkins", "github actions", "gitlab ci"],
      project: {
        title: "Add a real CI/CD pipeline to an existing app",
        scope: "Take an existing project from tests to automated deploy with quality gates and a rollback path.",
        stack: ["GitHub Actions or GitLab CI", "Docker", "Testing framework", "A deployed environment"],
        plan: [
          "Day 1: add a test suite and fix the first failures.",
          "Day 2: create a build pipeline with dependency caching.",
          "Day 3: add linting, type checks and coverage gates.",
          "Day 4: build and push a versioned image.",
          "Day 5: add a deploy job with an environment secret.",
          "Day 6: add a smoke test and rollback step.",
          "Day 7: document the pipeline and failure playbook.",
        ],
        repoStructure: [".github/workflows/ci.yml", ".github/workflows/deploy.yml", "tests/", "scripts/", "docs/pipeline.md", "README.md"],
      },
    },
    {
      match: ["graphql"],
      project: {
        title: "Build a GraphQL API over a real dataset",
        scope: "Expose a small public dataset with typed queries, pagination and tests.",
        stack: ["GraphQL", "Node.js or Python", "PostgreSQL", "GraphQL Playground"],
        plan: [
          "Day 1: choose a public dataset and define three user queries.",
          "Day 2: model the schema and write example operations.",
          "Day 3: build resolvers with a real database.",
          "Day 4: add pagination, filtering and error handling.",
          "Day 5: add query depth limits and tests.",
          "Day 6: deploy and publish a read-only playground link.",
          "Day 7: document schema decisions.",
        ],
        repoStructure: ["src/schema/", "src/resolvers/", "db/", "tests/", "docs/schema.md", "README.md"],
      },
    },
    {
      match: ["kafka", "rabbitmq", "message queue"],
      project: {
        title: "Build a small event-driven order pipeline",
        scope: "Send real events between two services, handle retries and show the message flow.",
        stack: [skill, "Docker", "Node.js or Java", "PostgreSQL"],
        plan: [
          "Day 1: define three events and the consumer contract.",
          "Day 2: run the broker locally with Docker.",
          "Day 3: build a producer with idempotency keys.",
          "Day 4: build a consumer with retry and dead-letter handling.",
          "Day 5: add a delivery dashboard or log view.",
          "Day 6: load test with a small script.",
          "Day 7: document failure modes and recovery.",
        ],
        repoStructure: ["producer/", "consumer/", "shared/", "docker-compose.yml", "tests/", "docs/events.md", "README.md"],
      },
    },
    {
      match: ["airflow", "dbt", "etl", "data pipelines", "snowflake", "bigquery", "redshift", "databricks"],
      project: {
        title: "Ship a small analytics pipeline",
        scope: "Ingest a public dataset, transform it with tests, and publish one decision-ready dashboard.",
        stack: [skill, "Python", "SQL", "A BI tool"],
        plan: [
          "Day 1: choose a public dataset and write three business questions.",
          "Day 2: load raw data into a warehouse or local database.",
          "Day 3: build staged and mart models with documentation.",
          "Day 4: add data quality tests for keys and ranges.",
          "Day 5: schedule the pipeline and add failure alerts.",
          "Day 6: build one dashboard and annotate the decisions.",
          "Day 7: publish the repo with lineage and setup steps.",
        ],
        repoStructure: ["ingest/", "transform/models/", "transform/tests/", "dashboards/", "docs/decisions.md", "README.md"],
      },
    },
    {
      match: ["tableau", "power bi", "looker", "data visualization"],
      project: {
        title: "Build an executive dashboard from public data",
        scope: "Turn a real dataset into a one-screen dashboard with clear definitions and tested numbers.",
        stack: [skill, "SQL", "Public dataset"],
        plan: [
          "Day 1: define the audience and three decisions the dashboard supports.",
          "Day 2: clean and model the dataset.",
          "Day 3: build the first chart set with a consistent scale.",
          "Day 4: add filters, definitions and annotations.",
          "Day 5: validate every number with SQL.",
          "Day 6: publish and ask two people to review it.",
          "Day 7: document choices and limitations.",
        ],
        repoStructure: ["data/", "sql/", "dashboard/", "docs/metrics.md", "README.md"],
      },
    },
    {
      match: ["react", "next.js", "vue", "angular", "svelte", "frontend"],
      project: {
        title: "Design and ship a small product interface",
        scope: "Build one complete user flow with real data, accessible states and a deployed link.",
        stack: [skill, "TypeScript", "Tailwind CSS", "A public API or local data"],
        plan: [
          "Day 1: write the user story and sketch two screens.",
          "Day 2: set up the app and component structure.",
          "Day 3: build the main flow with loading and error states.",
          "Day 4: add keyboard navigation and accessible labels.",
          "Day 5: add tests for the critical path.",
          "Day 6: deploy and run a Lighthouse check.",
          "Day 7: publish screenshots and notes.",
        ],
        repoStructure: ["src/components/", "src/app/", "src/lib/", "tests/", "public/", "README.md"],
      },
    },
    {
      match: ["figma", "sketch", "adobe xd", "ux design", "ui design", "usability testing"],
      project: {
        title: "Redesign a public product flow",
        scope: "Audit one real flow, test a prototype with three people and publish the decisions.",
        stack: [skill, "A public product", "Maze or a short interview script"],
        plan: [
          "Day 1: choose a public product and document the current flow.",
          "Day 2: run a heuristic audit and write five issues.",
          "Day 3: sketch three alternative flows.",
          "Day 4: build a clickable prototype.",
          "Day 5: test with three people and record findings.",
          "Day 6: revise the prototype and show the before and after.",
          "Day 7: publish a case study with decisions and trade-offs.",
        ],
        repoStructure: ["research/", "audit.md", "prototype/", "case-study.md", "assets/"],
      },
    },
    {
      match: ["sql", "postgresql", "mysql", "database"],
      project: {
        title: "Model a real dataset and query it well",
        scope: "Design a small schema, load real data and answer three useful questions with tested SQL.",
        stack: [skill, "A public dataset", "A BI or notebook tool"],
        plan: [
          "Day 1: choose a dataset and write the questions.",
          "Day 2: design the schema and constraints.",
          "Day 3: load and clean the data.",
          "Day 4: write queries with window functions and CTEs.",
          "Day 5: add indexes and compare plans.",
          "Day 6: publish a short analysis and dashboard.",
          "Day 7: document the model and assumptions.",
        ],
        repoStructure: ["schema.sql", "seed/", "queries/", "analysis/", "docs/decisions.md", "README.md"],
      },
    },
    {
      match: ["python", "typescript", "javascript", "java", "go", "rust"],
      project: {
        title: `Build a small tool in ${skill}`,
        scope: "Solve one real problem end to end: input, processing, tests, packaging and documentation.",
        stack: [skill, "A public dataset or API", "A test framework", "CI"],
        plan: [
          "Day 1: define one user and one problem worth solving.",
          "Day 2: build the smallest working path.",
          "Day 3: add input validation and error handling.",
          "Day 4: add tests for edge cases.",
          "Day 5: package and install the tool.",
          "Day 6: add CI and publish a release.",
          "Day 7: write usage docs and a short design note.",
        ],
        repoStructure: ["src/", "tests/", "docs/", ".github/workflows/ci.yml", "README.md"],
      },
    },
    {
      match: ["seo", "content marketing", "email marketing", "google analytics", "marketing"],
      project: {
        title: "Run a measurable growth experiment",
        scope: "Pick a live public site or create a small content site, ship one experiment and measure it honestly.",
        stack: [skill, "Google Analytics", "A spreadsheet or Looker Studio"],
        plan: [
          "Day 1: choose the audience, keyword or channel and define one metric.",
          "Day 2: audit the current baseline.",
          "Day 3: ship one content or lifecycle change.",
          "Day 4: set up tracking and a clean dashboard.",
          "Day 5: run the experiment for a fixed window.",
          "Day 6: analyze the result, including a negative result.",
          "Day 7: publish a case study with the raw numbers.",
        ],
        repoStructure: ["research/", "content/", "tracking/", "analysis/", "case-study.md"],
      },
    },
    {
      match: ["financial modeling", "excel", "valuation", "fp&a", "finance"],
      project: {
        title: "Build a three-statement model from public filings",
        scope: "Model one public company with clear assumptions, checks and a short investment note.",
        stack: [skill, "SEC EDGAR or annual report", "A spreadsheet"],
        plan: [
          "Day 1: choose a company and pull three years of filings.",
          "Day 2: build the revenue and cost drivers.",
          "Day 3: link the three statements.",
          "Day 4: add a scenario switch and checks.",
          "Day 5: build a simple valuation range.",
          "Day 6: write an investment note with risks.",
          "Day 7: publish the sanitized model and summary.",
        ],
        repoStructure: ["model.xlsx", "data/", "notes/assumptions.md", "notes/investment-note.md", "README.md"],
      },
    },
    {
      match: ["project management", "agile", "scrum", "product management"],
      project: {
        title: "Run a small project from brief to retrospective",
        scope: "Take a public brief or volunteer request, plan it, ship something real and document the outcomes.",
        stack: [skill, "A kanban board", "A stakeholder brief"],
        plan: [
          "Day 1: write the problem statement and success measures.",
          "Day 2: break work into a backlog with estimates.",
          "Day 3: run a planning session and publish the plan.",
          "Day 4: ship the first increment and log risks.",
          "Day 5: run a review with the stakeholder.",
          "Day 6: deliver and measure the outcome.",
          "Day 7: run a retrospective and publish the lessons.",
        ],
        repoStructure: ["brief.md", "plan/", "updates/", "retrospective.md", "deliverables/"],
      },
    },
  ];

  const template = templates.find((t) => t.match.some((m) => key.includes(normalize(m)) || normalize(m).includes(key)));
  if (template) return template.project;

  return {
    title: `Ship a small project using ${skill}`,
    scope: `Build one focused, verifiable project that produces real evidence of ${skill}. Keep the scope to one user and one workflow.`,
    stack: [skill, "A public dataset or API", "Git and GitHub"],
    plan: [
      "Day 1: define one user problem and the acceptance criteria.",
      "Day 2: build the smallest working version.",
      "Day 3: add error handling and edge cases.",
      "Day 4: add tests or a verification script.",
      "Day 5: deploy or publish the result.",
      "Day 6: write a README with setup and screenshots.",
      "Day 7: collect feedback and record what you would change.",
    ],
    repoStructure: ["src/", "tests/", "docs/", "README.md"],
  };
}

function learningFor(skill: string, category: GapCategory): GapOptions["learn"] {
  const key = normalize(skill);
  const certs: GapOptions["learn"]["certifications"] = [];
  const add = (name: string, provider: string, note: string) => {
    if (!certs.some((c) => c.name === name)) certs.push({ name, provider, note });
  };

  if (key.includes("aws")) add("AWS Certified Cloud Practitioner", "Amazon Web Services", "Entry-level proof of cloud fundamentals. Solutions Architect Associate is the next step.");
  if (key.includes("azure")) add("Microsoft Certified: Azure Fundamentals (AZ-900)", "Microsoft", "Broad cloud literacy with a short exam.");
  if (key.includes("gcp") || key.includes("google cloud")) add("Google Cloud Digital Leader", "Google Cloud", "Foundational certificate for cloud concepts.");
  if (key.includes("kubernetes")) add("Certified Kubernetes Administrator (CKA)", "Linux Foundation", "Hands-on exam. Do the project first.");
  if (key.includes("terraform")) add("HashiCorp Certified: Terraform Associate", "HashiCorp", "Validates infrastructure as code fundamentals.");
  if (key.includes("data") || key.includes("sql") || key.includes("tableau") || key.includes("power bi")) {
    add("Google Data Analytics Professional Certificate", "Coursera", "Portfolio-based introduction to the full analysis workflow.");
    add("Microsoft Certified: Power BI Data Analyst (PL-300)", "Microsoft", "Useful when the role names Power BI.");
  }
  if (key.includes("machine learning") || key.includes("pytorch") || key.includes("tensorflow")) {
    add("AWS Certified Machine Learning Engineer", "Amazon Web Services", "Only worth it after two shipped models.");
  }
  if (key.includes("project management") || key.includes("agile") || key.includes("scrum")) {
    add("Professional Scrum Master I (PSM I)", "Scrum.org", "Fast, practical validation of Scrum fundamentals.");
    add("Project Management Professional (PMP)", "PMI", "Requires documented project experience. Check eligibility first.");
  }
  if (key.includes("marketing") || key.includes("seo") || key.includes("analytics")) {
    add("Google Analytics Certification", "Google Skillshop", "Free and specific to GA4.");
    add("HubSpot Content Marketing Certification", "HubSpot Academy", "Free, practical lifecycle and content fundamentals.");
  }
  if (key.includes("salesforce")) add("Salesforce Certified Administrator", "Salesforce", "Requires hands-on platform practice.");
  if (key.includes("figma") || key.includes("design")) add("Google UX Design Professional Certificate", "Coursera", "Portfolio-based, slower than a focused project.");
  if (key.includes("hr") || key.includes("recruiting")) add("SHRM Certified Professional (SHRM-CP)", "SHRM", "Recognized HR credential. Check eligibility.");
  if (!certs.length) add(`${skill} official certification path`, "Vendor or recognized training provider", "Only pursue a credential the job description names or the vendor actually offers.");

  return {
    path: [
      `Read the official ${skill} documentation and write a one-page summary in your own words.`,
      `Complete one guided lab or tutorial that produces a working artifact, not just notes.`,
      `Build the suggested project without following a tutorial line by line.`,
      `Publish the repository with setup steps, a README and a short design note.`,
      `Get feedback from one practitioner and fix the most important gap.`,
      `Add the project to your resume only after it is complete and the link is live.`,
    ],
    certifications: certs.slice(0, 2),
  };
}

function categoryFor(skill: string): GapCategory {
  const entry = skillTaxonomy.find((e) => normalize(e.canonical) === normalize(skill));
  if (!entry) return "skill";
  if (["Cloud and DevOps", "Tools", "Databases", "Data and ML"].includes(entry.category) && entry.type === "hard") return "tool";
  if (["Languages", "Frontend", "Backend", "Data and ML"].includes(entry.category)) return "skill";
  if (["Product", "Marketing", "Sales and Customer", "Finance", "Operations", "People and HR", "Healthcare", "Legal and Compliance"].includes(entry.category)) return "domain";
  return "skill";
}

function reframeOptions(resume: ResumeData, skill: string): GapOptions["reframe"] {
  const bullets = resume.experience.flatMap((e) => e.bullets.map((b) => b.text));
  const tokens = normalize(skill).split(" ").filter((t) => t.length > 2);
  const candidates = bullets
    .map((text) => {
      const norm = normalize(text);
      const overlap = tokens.filter((t) => norm.includes(t)).length;
      return { text, overlap };
    })
    .filter((c) => c.overlap > 0 && c.overlap >= Math.ceil(tokens.length / 2))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 2);

  return candidates.map(({ text }) => {
    let after = text;
    // Only replace a close synonym that appears in the bullet. Never append the skill.
    const entry = skillTaxonomy.find((e) => normalize(e.canonical) === normalize(skill));
    if (entry) {
      for (const alias of entry.aliases) {
        if (normalize(after).includes(normalize(alias))) {
          after = after.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), entry.canonical);
          break;
        }
      }
    }
    return { before: text, after, source: "existing bullet" };
  }).filter((r) => normalize(r.after) !== normalize(r.before) || r.before.toLowerCase().includes(skill.toLowerCase()));
}

export function gapOptionsFor(resume: ResumeData, skill: string, category: GapCategory): GapOptions {
  const role = resume.experience[0];
  const questions = [
    role
      ? `Did you use ${skill} during your ${role.title || "recent"} role at ${role.company || "your company"}, even occasionally or for a small task?`
      : `Have you used ${skill} in an internship, course, project or volunteer role?`,
    `What did you build or change with ${skill}, and what was the result? Name the tool or artifact, not the outcome you wish you had.`,
    `Do you have a repository, certificate or work sample that shows ${skill}? If yes, what is the link?`,
  ];
  return {
    mayAlreadyHave: {
      questions,
      note: "Only add this if your answer is a real experience. A no is a valid and useful answer.",
    },
    reframe: reframeOptions(resume, skill),
    build: projectFor(skill, category),
    learn: learningFor(skill, category),
  };
}

export function deriveRuleGaps(resume: ResumeData, jd: ExtractedJd, keywords: KeywordAnalysis | null): GapSeed[] {
  const resumeText = resumeToPlainTextLocal(resume);
  const missing =
    keywords?.missing ??
    jd.keywords
      .map((k) => ({ keyword: k.keyword, importance: k.importance, type: k.type, missing: matchKeyword(k.keyword, resumeText, k.type, k.importance).matchType === "missing" }))
      .filter((k) => k.missing)
      .map((k) => ({ keyword: k.keyword, importance: k.importance, type: k.type }));

  const seeds: GapSeed[] = [];
  for (const item of missing.slice(0, 8)) {
    const skill = item.keyword;
    if (seeds.some((s) => normalize(s.skill) === normalize(skill))) continue;
    const category = categoryFor(skill);
    seeds.push({
      skill,
      category,
      importance: item.importance === "must" ? "must" : "nice",
      options: gapOptionsFor(resume, skill, category),
    });
  }
  return seeds;
}

function resumeToPlainTextLocal(resume: ResumeData): string {
  const parts = [resume.summary];
  for (const e of resume.experience) {
    parts.push(`${e.title} ${e.company}`);
    for (const b of e.bullets) parts.push(b.text);
  }
  for (const p of resume.projects) {
    parts.push(`${p.name} ${p.description ?? ""}`);
    for (const b of p.bullets) parts.push(b.text);
  }
  for (const g of resume.skills) parts.push(g.skills.join(" "));
  return parts.join("\n");
}

export function mergeLlmGaps(resume: ResumeData, jd: ExtractedJd, seeds: GapSeed[], llm: LlmGapOutput): { gaps: GapSeed[]; warnings: string[] } {
  const warnings: string[] = [];
  const resumeText = resumeToPlainTextLocal(resume);
  const merged = new Map<string, GapSeed>();
  for (const seed of seeds) merged.set(normalize(seed.skill), seed);

  const bullets = new Set(resume.experience.flatMap((e) => e.bullets.map((b) => normalize(b.text))));
  for (const gap of llm.gaps.slice(0, 6)) {
    if (!gap.skill.trim()) continue;
    const hit = matchKeyword(gap.skill, resumeText, "hard", gap.importance);
    if (hit.matchType !== "missing") {
      warnings.push(`Ignored a suggested gap for "${gap.skill}" because it already appears in the resume.`);
      continue;
    }
    const reframe = gap.reframe
      .filter((r) => bullets.has(normalize(r.before)))
      .map((r) => ({ ...r, source: "existing bullet" }));
    if (reframe.length !== gap.reframe.length) {
      warnings.push(`Removed a reframe for "${gap.skill}" because the original bullet could not be verified.`);
    }
    const baseOptions = gapOptionsFor(resume, gap.skill, gap.category);
    const options: GapOptions = {
      mayAlreadyHave: {
        questions: gap.questions.slice(0, 3),
        note: baseOptions.mayAlreadyHave.note,
      },
      reframe,
      build: {
        title: gap.project.title,
        scope: gap.project.scope,
        stack: gap.project.stack,
        plan: gap.project.plan,
        repoStructure: gap.project.repoStructure,
      },
      learn: {
        path: gap.learning.path.length ? gap.learning.path : baseOptions.learn.path,
        certifications: gap.learning.certifications.length ? gap.learning.certifications : baseOptions.learn.certifications,
      },
    };
    merged.set(normalize(gap.skill), {
      skill: gap.skill,
      category: gap.category,
      importance: gap.importance,
      options,
    });
  }

  const gaps = [...merged.values()]
    .sort((a, b) => (a.importance === b.importance ? 0 : a.importance === "must" ? -1 : 1))
    .slice(0, 8);
  return { gaps, warnings };
}

export const __gapInternals = { projectFor, learningFor, reframeOptions, resumeToPlainTextLocal };
