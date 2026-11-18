import type { ExtractedJd, KeywordAnalysis, KeywordHit, KeywordType } from "@/lib/types";
import {
  STOPWORDS,
  containsPhrase,
  contentTokens,
  countPhrase,
  normalize,
  ngrams,
  stem,
  tokenize,
  uniqueBy,
} from "@/lib/text";

/* ------------------------------------------------------------------ */
/* Skill taxonomy                                                      */
/* ------------------------------------------------------------------ */

export interface SkillEntry {
  canonical: string;
  aliases: string[];
  type: KeywordType;
  category: string;
}

type Group = [category: string, type: KeywordType, entries: string[]];

const groups: Group[] = [
  [
    "Languages",
    "hard",
    [
      "JavaScript|js|es6|ecmascript",
      "TypeScript|ts",
      "Python|python3",
      "Java",
      "C#|c sharp|dotnet",
      "C++|cpp",
      "Go|golang",
      "Rust",
      "Ruby",
      "PHP",
      "Scala",
      "Kotlin",
      "Swift",
      "SQL|structured query language",
      "HTML|html5",
      "CSS|css3",
      "Sass|scss",
      "Bash|shell scripting",
      "R programming|rstudio",
      "MATLAB",
      "Julia",
      "Dart",
      "Elixir",
      "Objective-C",
      "Solidity",
      "COBOL",
      "Fortran",
    ],
  ],
  [
    "Frontend",
    "hard",
    [
      "React|react.js|reactjs",
      "Next.js|nextjs",
      "Vue|vue.js|vuejs",
      "Angular|angularjs",
      "Svelte",
      "Redux",
      "Tailwind CSS|tailwind",
      "Bootstrap",
      "Material UI|mui",
      "GraphQL",
      "REST APIs|rest api|restful",
      "Webpack",
      "Vite",
      "Jest",
      "Cypress",
      "Playwright",
      "React Native",
      "Flutter",
      "accessibility|wcag|a11y",
      "responsive design",
      "web performance|core web vitals",
      "design systems",
    ],
  ],
  [
    "Backend",
    "hard",
    [
      "Node.js|nodejs|node",
      "Express|express.js",
      "NestJS",
      "Django",
      "Flask",
      "FastAPI",
      "Spring Boot|spring",
      "Ruby on Rails|rails",
      "Laravel",
      ".NET|asp.net",
      "gRPC",
      "WebSockets",
      "Kafka|apache kafka",
      "RabbitMQ",
      "Redis",
      "Elasticsearch",
      "microservices",
      "API design",
      "OAuth|oauth2|saml",
      "message queues",
      "event-driven architecture",
    ],
  ],
  [
    "Databases",
    "hard",
    [
      "PostgreSQL|postgres",
      "MySQL",
      "MongoDB|mongo",
      "DynamoDB",
      "SQLite",
      "Oracle Database|oracle db",
      "SQL Server|mssql",
      "Cassandra",
      "Snowflake",
      "BigQuery",
      "Redshift",
      "Databricks",
      "Neo4j",
      "database design|data modeling|data modelling",
    ],
  ],
  [
    "Cloud and DevOps",
    "hard",
    [
      "AWS|amazon web services",
      "Azure|microsoft azure",
      "GCP|google cloud|google cloud platform",
      "Docker",
      "Kubernetes|k8s",
      "Terraform",
      "Ansible",
      "Jenkins",
      "GitHub Actions",
      "GitLab CI",
      "CircleCI",
      "CI/CD|continuous integration|continuous delivery",
      "Linux",
      "Nginx",
      "Prometheus",
      "Grafana",
      "Datadog",
      "CloudFormation",
      "serverless",
      "AWS Lambda|lambda functions",
      "Amazon S3|s3",
      "EC2",
      "observability",
      "site reliability|sre",
      "infrastructure as code|iac",
    ],
  ],
  [
    "Data and ML",
    "hard",
    [
      "pandas",
      "NumPy",
      "scikit-learn|sklearn",
      "TensorFlow",
      "PyTorch",
      "Keras",
      "Spark|apache spark|pyspark",
      "Hadoop",
      "Airflow|apache airflow",
      "dbt",
      "Tableau",
      "Power BI|powerbi",
      "Looker",
      "Excel|microsoft excel|spreadsheets",
      "statistics|statistical analysis",
      "A/B testing|split testing|experimentation",
      "ETL|ELT|data pipelines",
      "NLP|natural language processing",
      "computer vision",
      "LLMs|large language models|generative ai|genai",
      "machine learning|ml",
      "deep learning",
      "data visualization|data visualisation",
      "predictive modeling|predictive modelling",
      "regression analysis",
      "classification models",
      "clustering",
      "data mining",
      "data quality",
      "data governance",
      "data warehousing",
    ],
  ],
  [
    "Product",
    "hard",
    [
      "product management",
      "roadmapping|product roadmap",
      "user research",
      "product analytics",
      "Agile|agile methodology",
      "Scrum",
      "Kanban",
      "Jira",
      "Confluence",
      "Notion",
      "Asana",
      "Trello",
      "OKRs|objectives and key results",
      "stakeholder management",
      "go-to-market|gtm",
      "product strategy",
      "wireframing",
      "prototyping",
      "product discovery",
      "backlog grooming|backlog management",
      "requirements gathering",
      "jobs to be done|jtbd",
      "pricing strategy",
      "competitive analysis",
      "customer journey mapping",
    ],
  ],
  [
    "Design",
    "hard",
    [
      "Figma",
      "Sketch",
      "Adobe XD",
      "Photoshop|adobe photoshop",
      "Illustrator|adobe illustrator",
      "InDesign|adobe indesign",
      "After Effects",
      "user research",
      "usability testing",
      "wireframing",
      "prototyping",
      "typography",
      "branding|brand design",
      "motion design",
      "graphic design",
      "interaction design",
      "information architecture",
      "visual design",
      "UX design|user experience",
      "UI design|user interface",
    ],
  ],
  [
    "Marketing",
    "hard",
    [
      "SEO|search engine optimization",
      "SEM|search engine marketing",
      "Google Ads|adwords",
      "Google Analytics|google analytics 4|ga4",
      "Meta Ads|facebook ads",
      "HubSpot",
      "Marketo",
      "Salesforce Marketing Cloud",
      "Mailchimp",
      "Klaviyo",
      "Content marketing",
      "Copywriting",
      "Email marketing",
      "Social media marketing|social media",
      "CRO|conversion rate optimization",
      "Marketing automation",
      "Brand strategy",
      "Public relations|pr",
      "Event marketing",
      "Google Tag Manager|gtm tag manager",
      "Attribution",
      "Lifecycle marketing",
      "Performance marketing|paid media",
      "Demand generation|demand gen",
      "Account-based marketing|abm",
      "Customer segmentation",
      "Campaign management",
    ],
  ],
  [
    "Sales and Customer",
    "hard",
    [
      "Salesforce|salesforce crm",
      "HubSpot CRM",
      "cold calling",
      "prospecting",
      "pipeline management",
      "quota attainment|quota",
      "B2B sales",
      "SaaS sales",
      "account management",
      "customer success",
      "negotiation",
      "sales forecasting",
      "lead generation",
      "CRM",
      "consultative selling",
      "upselling|cross-selling",
      "customer retention|churn reduction",
      "customer onboarding",
      "renewals",
      "territory management",
    ],
  ],
  [
    "Finance",
    "hard",
    [
      "financial modeling|financial modelling",
      "valuation|dcf",
      "budgeting",
      "forecasting",
      "FP&A|financial planning and analysis",
      "Accounting",
      "GAAP",
      "IFRS",
      "QuickBooks",
      "SAP",
      "Oracle ERP",
      "variance analysis",
      "risk management",
      "Auditing|audit",
      "Compliance",
      "Payroll",
      "Tax preparation|tax",
      "Accounts payable",
      "Accounts receivable",
      "General ledger",
      "Cost accounting",
      "Financial reporting",
      "M&A|mergers and acquisitions",
      "Private equity|pe",
      "Investment banking",
    ],
  ],
  [
    "Operations",
    "hard",
    [
      "supply chain",
      "logistics",
      "inventory management",
      "Lean|lean manufacturing",
      "Six Sigma",
      "process improvement",
      "project management",
      "vendor management",
      "procurement",
      "ERP",
      "operations management",
      "quality assurance|qa",
      "change management",
      "capacity planning",
      "SOP development|standard operating procedures",
      "root cause analysis",
      "demand planning",
      "warehouse management|wms",
    ],
  ],
  [
    "People and HR",
    "hard",
    [
      "Recruiting|recruitment",
      "Sourcing",
      "Talent acquisition",
      "Onboarding",
      "HRIS",
      "Workday",
      "BambooHR",
      "Employee relations",
      "Compensation",
      "Benefits administration",
      "Performance management",
      "DEI|diversity equity and inclusion",
      "Applicant Tracking System|ats",
      "Learning and development|l&d",
      "Workforce planning",
      "HR policy",
    ],
  ],
  [
    "Healthcare",
    "hard",
    [
      "Epic|epic systems",
      "Cerner",
      "HIPAA",
      "EHR|electronic health records",
      "EMR|electronic medical records",
      "clinical research",
      "patient care",
      "medical coding",
      "ICD-10",
      "CPT coding",
      "GCP|good clinical practice",
      "FDA regulations",
      "pharmacovigilance",
      "clinical trials",
      "telehealth",
      "care coordination",
      "medical terminology",
    ],
  ],
  [
    "Legal and Compliance",
    "hard",
    [
      "contract negotiation",
      "compliance",
      "litigation",
      "legal research",
      "GDPR",
      "privacy",
      "intellectual property|ip",
      "SOC 2",
      "ISO 27001",
      "corporate law",
      "regulatory affairs",
      "risk assessment",
      "data privacy",
    ],
  ],
  [
    "Tools",
    "hard",
    [
      "Git|github|gitlab|bitbucket",
      "VS Code",
      "Postman",
      "Figma",
      "Slack",
      "Zoom",
      "Google Workspace|g suite",
      "Microsoft Office|ms office",
      "Microsoft Word|word",
      "Microsoft PowerPoint|powerpoint",
      "Microsoft Project",
      "Monday.com",
      "Smartsheet",
      "Wrike",
      "Basecamp",
      "Power Automate",
      "Airtable",
      "Zapier",
      "Adobe Creative Suite|creative cloud",
    ],
  ],
  [
    "Project and Process",
    "hard",
    [
      "project management",
      "program management",
      "PMO",
      "Agile",
      "Scrum",
      "Kanban",
      "SAFe",
      "waterfall",
      "risk management",
      "resource planning",
      "budget management",
      "cross-functional collaboration",
      "stakeholder management",
      "vendor management",
      "process documentation",
      "KPI reporting",
      "data reporting",
      "business analysis",
      "requirements analysis",
      "UAT|user acceptance testing",
      "change management",
    ],
  ],
  [
    "Soft skills",
    "soft",
    [
      "leadership|leading teams",
      "communication|written communication|verbal communication",
      "collaboration|teamwork",
      "problem solving|problem-solving",
      "critical thinking",
      "ownership",
      "adaptability|adaptable",
      "mentoring|mentorship",
      "coaching",
      "stakeholder management",
      "cross-functional collaboration",
      "time management",
      "prioritization",
      "negotiation",
      "presentation|presenting",
      "customer service",
      "attention to detail",
      "creativity",
      "strategic thinking",
      "conflict resolution",
      "decision making",
      "emotional intelligence",
      "initiative",
      "flexibility",
      "analytical thinking",
      "interpersonal skills",
      "organizational skills",
      "work ethic",
      "curiosity",
      "resilience",
    ],
  ],
];

export const skillTaxonomy: SkillEntry[] = groups.flatMap(([category, type, entries]) =>
  entries.map((entry) => {
    const parts = entry.split("|").map((p) => p.trim()).filter(Boolean);
    return { canonical: parts[0], aliases: parts.slice(1), type, category };
  }),
);

const aliasIndex = new Map<string, SkillEntry>();
for (const entry of skillTaxonomy) {
  for (const alias of [entry.canonical, ...entry.aliases]) {
    const key = normalize(alias);
    if (key && !aliasIndex.has(key)) aliasIndex.set(key, entry);
  }
}

// Related, not identical, concepts. Semantic hits are shown separately and scored lower.
const semanticFamilies: string[][] = [
  ["PostgreSQL", "MySQL", "SQL Server", "Oracle Database", "SQL"],
  ["AWS", "Azure", "GCP"],
  ["Docker", "Kubernetes"],
  ["Tableau", "Power BI", "Looker", "Google Analytics"],
  ["Figma", "Sketch", "Adobe XD"],
  ["Salesforce", "HubSpot CRM", "CRM"],
  ["React", "Vue", "Angular", "Svelte"],
  ["Scrum", "Kanban", "Agile"],
  ["project management", "program management"],
  ["data visualization", "data reporting", "KPI reporting"],
  ["machine learning", "deep learning"],
  ["customer success", "account management"],
  ["Excel", "Google Sheets"],
  ["CI/CD", "Jenkins", "GitHub Actions", "GitLab CI", "CircleCI"],
  ["SEO", "SEM", "Google Ads"],
  ["content marketing", "copywriting"],
  ["recruiting", "talent acquisition", "sourcing"],
  ["financial modeling", "valuation", "FP&A"],
  ["supply chain", "logistics", "inventory management"],
  ["quality assurance", "UAT"],
];

function semanticAliasesFor(entry: SkillEntry): string[] {
  const out = new Set<string>();
  for (const family of semanticFamilies) {
    const normalized = family.map((f) => normalize(f));
    if (
      family.some((f) => normalize(f) === normalize(entry.canonical)) ||
      family.some((f) => entry.aliases.some((a) => normalize(a) === normalize(f)))
    ) {
      for (const term of family) out.add(term);
      for (const term of family) {
        const aliasEntry = aliasIndex.get(normalize(term));
        if (aliasEntry) for (const alias of aliasEntry.aliases) out.add(alias);
      }
    }
  }
  return [...out].filter((term) => normalize(term) !== normalize(entry.canonical));
}

/* ------------------------------------------------------------------ */
/* JD extraction                                                       */
/* ------------------------------------------------------------------ */

interface JdLine {
  text: string;
  section: "must" | "nice" | "responsibility" | "neutral";
  index: number;
}

const MUST_HEADINGS = /^(requirements|qualifications|what you(?:'| wi)ll need|what we(?:'| a)re looking for|must have|required|you have|skills|experience|about you|minimum qualifications)/i;
const NICE_HEADINGS = /^(nice to have|preferred|bonus|plus(?:es)?|desired|good to have|additional)/i;
const RESP_HEADINGS = /^(responsibilities|what you(?:'| wi)ll do|the role|day to day|duties|your impact|about the role)/i;
const OTHER_HEADINGS = /^(benefits|perks|about (?:us|the company)|compensation|equal opportunity|how to apply|our values|why join)/i;

function classifyJdLines(jd: string): JdLine[] {
  let section: JdLine["section"] = "neutral";
  return jd.split(/\r?\n/).map((raw, index) => {
    const text = raw.trim();
    if (!text) return { text, section, index };
    if (text.length < 90) {
      if (NICE_HEADINGS.test(text)) section = "nice";
      else if (MUST_HEADINGS.test(text)) section = "must";
      else if (RESP_HEADINGS.test(text)) section = "responsibility";
      else if (OTHER_HEADINGS.test(text)) section = "neutral";
    }
    return { text, section, index };
  });
}

const mustCue = /\b(?:required|must|minimum|at least|proficien|expert|advanced|hands-on)\b/i;
const niceCue = /\b(?:preferred|nice to have|bonus|plus|desired|familiarity|exposure|a plus)\b/i;

function inferImportance(line: JdLine): "must" | "nice" {
  if (line.section === "nice") return "nice";
  if (niceCue.test(line.text)) return "nice";
  if (line.section === "must") return "must";
  if (mustCue.test(line.text)) return "must";
  return "must";
}

function cleanSkillPhrase(raw: string): string {
  return raw
    .replace(/^[\s\-•*·▪◦‣–—]+/, "")
    .replace(/^(?:experience (?:with|in|using)|proficiency (?:with|in)|knowledge of|familiarity with|hands-on (?:experience )?with|skills?(?: in)?|ability to|strong|excellent|advanced|expert|working)\s+/i, "")
    .replace(/\b(?:is|are|a|an|the|required|preferred|nice to have|plus)\b.*$/i, "")
    .replace(/[.;:,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_TERMS = new Set([
  "experience",
  "work",
  "team",
  "role",
  "job",
  "company",
  "candidate",
  "ability",
  "skills",
  "knowledge",
  "years",
  "environment",
  "opportunity",
  "communication skills",
  "interpersonal skills",
  "organizational skills",
  "work ethic",
  "attention to detail",
  "problem solving",
  "critical thinking",
  "time management",
  "detail oriented",
  "fast paced",
  "self starter",
  "team player",
]);

function extractUnknownPhrases(lines: JdLine[], known: Set<string>): { phrase: string; line: JdLine }[] {
  const out: { phrase: string; line: JdLine }[] = [];
  const patterns = [
    /(?:experience (?:with|in|using)|proficiency (?:with|in)|knowledge of|familiarity with|hands-on (?:experience )?with|exposure to|working with|skilled in|expertise in)\s+([A-Za-z0-9+#./&' -]{2,60})/gi,
    /(?:must have|required|requirements? include|you have|nice to have|preferred)\s*:?\s+([A-Za-z0-9+#./&' -]{2,60})/gi,
  ];
  for (const line of lines) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(line.text))) {
        const chunks = m[1].split(/,|;|\band\b|\bor\b/gi);
        for (const chunk of chunks) {
          const phrase = cleanSkillPhrase(chunk).toLowerCase();
          const words = phrase.split(/\s+/).filter(Boolean);
          if (words.length < 1 || words.length > 4) continue;
          if (phrase.length < 2 || phrase.length > 42) continue;
          if (GENERIC_TERMS.has(phrase)) continue;
          if (words.every((w) => STOPWORDS.has(w))) continue;
          if (known.has(normalize(phrase))) continue;
          if (/\b(?:years?|month|salary|degree|bachelor|master|phd|remote|hybrid|office)\b/i.test(phrase)) continue;
          out.push({ phrase: phrase.replace(/^(?:a|an|the) /, ""), line });
        }
      }
    }
  }
  return uniqueBy(out, (x) => normalize(x.phrase));
}

function companyTone(jd: string): string {
  const text = normalize(jd);
  if (/\b(?:fast-paced|startup|scrappy|ownership|bias for action|disrupt)\b/.test(text)) return "direct, energetic, ownership-oriented";
  if (/\b(?:mission|impact|community|inclusion|care|patient|customer obsession)\b/.test(text)) return "warm, mission-led, people-first";
  if (/\b(?:rigorous|research|science|precision|quality|security|compliance)\b/.test(text)) return "precise, evidence-led, quality-focused";
  if (/\b(?:creative|brand|storytelling|design|culture)\b/.test(text)) return "creative, expressive, human";
  return "professional, clear, grounded";
}

function extractCompanyValues(jd: string): string[] {
  const values = [
    "ownership",
    "collaboration",
    "customer focus",
    "curiosity",
    "integrity",
    "impact",
    "inclusion",
    "craft",
    "speed",
    "transparency",
    "accountability",
    "learning",
    "excellence",
    "empathy",
  ];
  const norm = normalize(jd);
  return values.filter((v) => norm.includes(v)).slice(0, 6);
}

export function extractJd(rawJd: string, title = "", company = ""): ExtractedJd {
  const jd = rawJd.replace(/\r/g, "").trim();
  const lines = classifyJdLines(jd);
  const found = new Map<string, KeywordHit>();

  // First pass: dictionary matches line by line so importance is contextual.
  for (const line of lines) {
    if (!line.text) continue;
    for (const entry of skillTaxonomy) {
      const aliases = [entry.canonical, ...entry.aliases];
      const hit = aliases.find((a) => containsPhrase(line.text, a));
      if (!hit) continue;
      const key = normalize(entry.canonical);
      const existing = found.get(key);
      const importance = inferImportance(line);
      if (existing) {
        if (importance === "must") existing.importance = "must";
      } else {
        found.set(key, {
          keyword: entry.canonical,
          type: entry.type,
          importance,
          matchType: "missing",
          occurrences: countPhrase(jd, hit),
        });
      }
    }
  }

  // Second pass: unknown phrases from explicit skill cues.
  const known = new Set<string>();
  for (const entry of skillTaxonomy) {
    for (const a of [entry.canonical, ...entry.aliases]) known.add(normalize(a));
  }
  const unknown = extractUnknownPhrases(lines, known).slice(0, 16);
  for (const { phrase, line } of unknown) {
    const key = normalize(phrase);
    if (found.has(key)) continue;
    found.set(key, {
      keyword: phrase,
      type: "hard",
      importance: inferImportance(line),
      matchType: "missing",
      occurrences: Math.max(1, countPhrase(jd, phrase)),
    });
  }

  const keywords = [...found.values()]
    .sort((a, b) => (a.importance === b.importance ? a.keyword.localeCompare(b.keyword) : a.importance === "must" ? -1 : 1))
    .slice(0, 60);

  const requiredSkills = keywords.filter((k) => k.importance === "must" && k.type === "hard").map((k) => k.keyword);
  const preferredSkills = keywords.filter((k) => k.importance === "nice" && k.type === "hard").map((k) => k.keyword);
  const tools = skillTaxonomy.filter(
    (e) => ["Tools", "Cloud and DevOps", "Databases"].includes(e.category) && keywords.some((k) => k.keyword === e.canonical),
  ).map((e) => e.canonical);

  const responsibilities = lines
    .filter((l) => l.section === "responsibility" && l.text.length > 12)
    .map((l) => l.text.replace(/^[-•*·▪◦‣–—\d.)\s]+/, "").trim())
    .filter((l) => l.length > 12 && !/^(responsibilities|what you|the role|day to day|duties|your impact|about the role)$/i.test(l))
    .slice(0, 10);

  const inferredRole =
    title.trim() ||
    (jd.match(/^(?:job title|role|position)\s*:\s*(.+)$/im)?.[1]?.trim() ?? "") ||
    (jd.split(/\r?\n/).find((l) => /^[A-Z][A-Za-z/&,\- ]{3,70}$/.test(l.trim()))?.trim() ?? "Target role");

  const seniority = /\b(?:intern|internship)\b/i.test(jd)
    ? "Intern"
    : /\b(?:junior|entry.level|graduate)\b/i.test(jd)
      ? "Junior"
      : /\b(?:principal|staff|distinguished)\b/i.test(jd)
        ? "Staff"
        : /\b(?:director|vp|vice president|head of)\b/i.test(jd)
          ? "Leadership"
          : /\b(?:senior|sr\.?)\b/i.test(jd)
            ? "Senior"
            : /\b(?:lead)\b/i.test(jd)
              ? "Lead"
              : "Mid-level";

  const yearsMatch = jd.match(/(\d+)\+?\s*(?:-\s*\d+\s*)?years?/i);
  const salaryMatch = jd.match(/\$ ?(\d{2,3})(?:,(\d{3}))?(?:\s*(?:-|to)\s*\$? ?(\d{2,3})(?:,(\d{3}))?)?/);
  const salaryRange = salaryMatch
    ? {
        min: Number(`${salaryMatch[1]}${salaryMatch[2] ?? ""}`),
        max: salaryMatch[3] ? Number(`${salaryMatch[3]}${salaryMatch[4] ?? ""}`) : undefined,
        currency: "USD",
      }
    : null;

  return {
    role: inferredRole,
    company: company.trim(),
    seniority,
    location: jd.match(/\b(?:location|based in)\s*:\s*([^\n]+)/i)?.[1]?.trim(),
    employmentType: /\bintern(ship)?\b/i.test(jd) ? "Internship" : /\bpart.time\b/i.test(jd) ? "Part-time" : /\bcontract\b/i.test(jd) ? "Contract" : "Full-time",
    requiredSkills,
    preferredSkills,
    tools: [...new Set(tools)],
    responsibilities,
    keywords,
    companyValues: extractCompanyValues(jd),
    tone: companyTone(jd),
    mustHaveYears: yearsMatch ? Number(yearsMatch[1]) : null,
    salaryRange,
    summary: `${keywords.length} keywords detected. ${requiredSkills.length} required hard skills, ${preferredSkills.length} preferred.`,
  };
}

/* ------------------------------------------------------------------ */
/* Keyword matching                                                    */
/* ------------------------------------------------------------------ */

export interface MatchInput {
  canonicals: string[];
  jdKeywords: { keyword: string; type: KeywordType; importance: "must" | "nice" }[];
  resumeText: string;
}

function buildStemNgramSet(text: string, maxN = 4): Set<string> {
  const tokens = contentTokens(text);
  const stems = tokens.map(stem);
  const set = new Set<string>();
  for (let n = 1; n <= maxN; n++) for (const g of ngrams(stems, n)) set.add(g);
  return set;
}

export function matchKeyword(keyword: string, resumeText: string, type: KeywordType, importance: "must" | "nice"): KeywordHit {
  const entry =
    aliasIndex.get(normalize(keyword)) ??
    skillTaxonomy.find((e) => normalize(e.canonical) === normalize(keyword)) ??
    null;
  const aliases = entry ? [entry.canonical, ...entry.aliases] : [keyword];

  let occurrences = 0;
  let matchedAs: string | undefined;
  for (const alias of aliases) {
    const c = countPhrase(resumeText, alias);
    if (c > 0) {
      occurrences += c;
      matchedAs = matchedAs ?? alias;
    }
  }
  if (occurrences > 0) {
    return { keyword, type, importance, matchType: "exact", occurrences, matchedAs };
  }

  // Stemmed match
  const stemSet = buildStemNgramSet(resumeText);
  for (const alias of aliases) {
    const tokens = contentTokens(alias);
    if (!tokens.length) continue;
    const key = tokens.map(stem).join(" ");
    if (stemSet.has(key)) {
      return { keyword, type, importance, matchType: "stemmed", occurrences: 1, matchedAs: alias };
    }
  }

  // Semantic match against related concepts
  const semantic = entry ? semanticAliasesFor(entry) : [];
  for (const alias of semantic) {
    if (containsPhrase(resumeText, alias)) {
      return { keyword, type, importance, matchType: "semantic", occurrences: 1, matchedAs: alias };
    }
  }

  return { keyword, type, importance, matchType: "missing", occurrences: 0 };
}

export function analyzeKeywords(jd: ExtractedJd, resumeText: string): KeywordAnalysis {
  const hits = jd.keywords.map((k) => matchKeyword(k.keyword, resumeText, k.type, k.importance));
  const matched = hits.filter((h) => h.matchType !== "missing");
  const missing = hits.filter((h) => h.matchType === "missing");

  const weight = (h: KeywordHit) => {
    if (h.matchType === "missing") return 0;
    return (h.importance === "must" ? 2 : 1) * (h.matchType === "semantic" ? 0.75 : 1);
  };
  const coverage = (list: KeywordHit[]) => {
    const total = list.reduce((s, h) => s + (h.importance === "must" ? 2 : 1), 0);
    if (!total) return 0;
    return Math.round((list.reduce((s, h) => s + weight(h), 0) / total) * 100);
  };

  const must = hits.filter((h) => h.importance === "must");
  const nice = hits.filter((h) => h.importance === "nice");
  const matchedMust = must.filter((h) => h.matchType !== "missing");
  const matchedNice = nice.filter((h) => h.matchType !== "missing");
  const hard = hits.filter((h) => h.type === "hard");
  const soft = hits.filter((h) => h.type === "soft");

  return {
    matched,
    missing,
    mustHaveCoverage: coverage(must),
    niceToHaveCoverage: coverage(nice),
    hardSkillCoverage: coverage(hard),
    softSkillCoverage: coverage(soft),
    total: hits.length,
  };
}

/** Filter to keywords that are genuinely present, used by tailoring and gap analysis. */
export function presentKeywords(jd: ExtractedJd, resumeText: string): string[] {
  return jd.keywords
    .filter((k) => matchKeyword(k.keyword, resumeText, k.type, k.importance).matchType !== "missing")
    .map((k) => k.keyword);
}

export function missingKeywords(jd: ExtractedJd, resumeText: string): KeywordHit[] {
  return jd.keywords
    .map((k) => matchKeyword(k.keyword, resumeText, k.type, k.importance))
    .filter((h) => h.matchType === "missing");
}

/* ------------------------------------------------------------------ */
/* Role-based keyword library                                          */
/* ------------------------------------------------------------------ */

export interface KeywordLibraryRole {
  id: string;
  title: string;
  industry: string;
  description: string;
  core: string[];
  tools: string[];
  soft: string[];
}

export const keywordLibrary: KeywordLibraryRole[] = [
  {
    id: "frontend",
    title: "Frontend Engineer",
    industry: "Technology",
    description: "Product-facing web engineering across modern component frameworks.",
    core: ["JavaScript", "TypeScript", "React", "Next.js", "HTML", "CSS", "responsive design", "accessibility", "web performance", "REST APIs", "GraphQL", "design systems", "unit testing"],
    tools: ["Git", "Figma", "Jest", "Playwright", "Vite", "Webpack", "Storybook"],
    soft: ["collaboration", "communication", "attention to detail", "problem solving", "ownership"],
  },
  {
    id: "backend",
    title: "Backend Engineer",
    industry: "Technology",
    description: "Services, APIs, data modeling and reliability work.",
    core: ["Node.js", "Python", "Java", "REST APIs", "API design", "PostgreSQL", "Redis", "microservices", "message queues", "authentication", "testing", "observability"],
    tools: ["Docker", "Kubernetes", "AWS", "Git", "Terraform", "Kafka", "Datadog"],
    soft: ["problem solving", "collaboration", "ownership", "communication", "critical thinking"],
  },
  {
    id: "fullstack",
    title: "Full Stack Engineer",
    industry: "Technology",
    description: "End-to-end product delivery from UI to database.",
    core: ["TypeScript", "React", "Node.js", "REST APIs", "PostgreSQL", "ORM", "authentication", "testing", "CI/CD", "system design"],
    tools: ["Next.js", "Git", "Docker", "AWS", "Prisma", "GraphQL"],
    soft: ["ownership", "collaboration", "communication", "adaptability", "prioritization"],
  },
  {
    id: "data-analyst",
    title: "Data Analyst",
    industry: "Data",
    description: "SQL-heavy analysis, reporting and decision support.",
    core: ["SQL", "Excel", "data visualization", "dashboards", "statistics", "A/B testing", "data quality", "stakeholder communication", "KPI reporting", "data modeling"],
    tools: ["Tableau", "Power BI", "Looker", "Snowflake", "BigQuery", "Python", "dbt"],
    soft: ["analytical thinking", "communication", "attention to detail", "problem solving", "collaboration"],
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    industry: "Data",
    description: "Modeling and experimentation tied to business outcomes.",
    core: ["Python", "SQL", "machine learning", "statistics", "A/B testing", "predictive modeling", "data cleaning", "feature engineering", "experimentation", "model evaluation"],
    tools: ["pandas", "scikit-learn", "PyTorch", "TensorFlow", "Jupyter", "Snowflake", "MLflow"],
    soft: ["critical thinking", "communication", "curiosity", "problem solving", "collaboration"],
  },
  {
    id: "product-manager",
    title: "Product Manager",
    industry: "Technology",
    description: "Discovery, prioritization and delivery for a product area.",
    core: ["product strategy", "roadmapping", "user research", "product analytics", "requirements gathering", "prioritization", "OKRs", "stakeholder management", "go-to-market", "A/B testing"],
    tools: ["Jira", "Confluence", "Figma", "Amplitude", "Mixpanel", "Notion", "SQL"],
    soft: ["leadership", "communication", "strategic thinking", "collaboration", "decision making"],
  },
  {
    id: "ux-designer",
    title: "Product Designer",
    industry: "Design",
    description: "End-to-end UX and UI for digital products.",
    core: ["user research", "wireframing", "prototyping", "usability testing", "interaction design", "visual design", "design systems", "accessibility", "information architecture"],
    tools: ["Figma", "Sketch", "Adobe XD", "Miro", "Maze", "Photoshop", "Illustrator"],
    soft: ["creativity", "communication", "collaboration", "attention to detail", "empathy"],
  },
  {
    id: "digital-marketer",
    title: "Digital Marketing Manager",
    industry: "Marketing",
    description: "Paid, organic and lifecycle campaigns tied to pipeline.",
    core: ["SEO", "SEM", "content marketing", "email marketing", "campaign management", "CRO", "analytics", "attribution", "audience segmentation", "budget management"],
    tools: ["Google Ads", "Google Analytics", "Meta Ads", "HubSpot", "Mailchimp", "Google Tag Manager", "Looker"],
    soft: ["communication", "creativity", "analytical thinking", "prioritization", "collaboration"],
  },
  {
    id: "account-executive",
    title: "Account Executive",
    industry: "Sales",
    description: "Consultative B2B selling and pipeline ownership.",
    core: ["prospecting", "pipeline management", "negotiation", "quota attainment", "B2B sales", "SaaS sales", "sales forecasting", "consultative selling", "account management", "renewals"],
    tools: ["Salesforce", "HubSpot CRM", "Outreach", "Gong", "LinkedIn Sales Navigator", "ZoomInfo"],
    soft: ["communication", "resilience", "ownership", "active listening", "time management"],
  },
  {
    id: "customer-success",
    title: "Customer Success Manager",
    industry: "Customer",
    description: "Retention, adoption and expansion for existing accounts.",
    core: ["customer success", "account management", "customer onboarding", "renewals", "customer retention", "upselling", "churn reduction", "QBRs", "product adoption", "escalation management"],
    tools: ["Salesforce", "Gainsight", "Zendesk", "Intercom", "HubSpot", "Looker"],
    soft: ["communication", "empathy", "problem solving", "ownership", "collaboration"],
  },
  {
    id: "finance-analyst",
    title: "Financial Analyst",
    industry: "Finance",
    description: "Modeling, planning and decision support.",
    core: ["financial modeling", "forecasting", "budgeting", "variance analysis", "financial reporting", "valuation", "Excel", "SQL", "data visualization", "scenario analysis"],
    tools: ["Excel", "Power BI", "Tableau", "SAP", "Oracle ERP", "NetSuite"],
    soft: ["analytical thinking", "attention to detail", "communication", "critical thinking", "ownership"],
  },
  {
    id: "project-manager",
    title: "Project Manager",
    industry: "Operations",
    description: "Cross-functional delivery, risk and stakeholder alignment.",
    core: ["project management", "Agile", "Scrum", "risk management", "stakeholder management", "budget management", "resource planning", "process improvement", "KPI reporting", "change management"],
    tools: ["Jira", "Asana", "Monday.com", "Smartsheet", "Confluence", "Microsoft Project"],
    soft: ["leadership", "communication", "conflict resolution", "prioritization", "decision making"],
  },
  {
    id: "recruiter",
    title: "Technical Recruiter",
    industry: "People",
    description: "Full-cycle recruiting for technical teams.",
    core: ["full-cycle recruiting", "sourcing", "talent acquisition", "candidate experience", "interview coordination", "hiring manager partnership", "employer branding", "offer negotiation", "pipeline management"],
    tools: ["LinkedIn Recruiter", "Greenhouse", "Lever", "Workday", "Gem", "Calendly"],
    soft: ["communication", "empathy", "organization", "negotiation", "ownership"],
  },
  {
    id: "nurse",
    title: "Registered Nurse",
    industry: "Healthcare",
    description: "Direct patient care in a clinical setting.",
    core: ["patient care", "care coordination", "patient education", "clinical documentation", "vital signs monitoring", "medication administration", "infection control", "HIPAA", "care planning", "triage"],
    tools: ["Epic", "Cerner", "EHR", "Pyxis", "Microsoft Office"],
    soft: ["empathy", "communication", "critical thinking", "resilience", "collaboration"],
  },
  {
    id: "fresher",
    title: "New Graduate (general)",
    industry: "Cross-industry",
    description: "A starter kit for students and recent graduates.",
    core: ["academic projects", "coursework", "research", "presentation", "teamwork", "data analysis", "problem solving", "communication", "time management", "critical thinking"],
    tools: ["Microsoft Office", "Google Workspace", "Git", "Excel", "Canva"],
    soft: ["curiosity", "adaptability", "ownership", "collaboration", "initiative"],
  },
];

export function rolesForIndustry(industry?: string): KeywordLibraryRole[] {
  if (!industry) return keywordLibrary;
  const q = industry.toLowerCase();
  return keywordLibrary.filter((r) => r.industry.toLowerCase().includes(q) || q.includes(r.industry.toLowerCase()));
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function keywordDensityByCategory(resumeText: string): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of skillTaxonomy) {
    const present = [entry.canonical, ...entry.aliases].some((a) => containsPhrase(resumeText, a));
    if (present) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

export function guessRoleKeywords(text: string, limit = 12): string[] {
  const norm = normalize(text);
  const found = new Map<string, number>();
  for (const entry of skillTaxonomy) {
    let count = 0;
    for (const alias of [entry.canonical, ...entry.aliases]) count += countPhrase(norm, alias);
    if (count > 0) found.set(entry.canonical, count);
  }
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

export function keywordTokens(text: string): string[] {
  return uniqueBy(tokenize(text).filter((t) => t.length > 2 && !STOPWORDS.has(t)), (t) => stem(t));
}
