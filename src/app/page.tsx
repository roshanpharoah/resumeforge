import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Braces,
  Check,
  ClipboardCheck,
  FileSearch,
  FileText,
  Fingerprint,
  Gauge,
  KanbanSquare,
  Layers,
  Lightbulb,
  PenLine,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/score-ring";
import { templates } from "@/lib/types";

const dimensions = [
  { label: "Keywords", value: 18, max: 30, color: "#0a907b" },
  { label: "Structure", value: 13, max: 15, color: "#0f766e" },
  { label: "Formatting", value: 9, max: 14, color: "#0d9488" },
  { label: "Bullets", value: 11, max: 15, color: "#14b8a6" },
];

const features = [
  {
    icon: Gauge,
    title: "A score you can act on",
    body: "Eight weighted dimensions, every deduction explained, and a one click fix wherever a safe patch exists.",
  },
  {
    icon: Target,
    title: "Tailored, never fabricated",
    body: "The diff view shows every change. You accept each one. New numbers need evidence before they can ship.",
  },
  {
    icon: Lightbulb,
    title: "Four honest ways to close a gap",
    body: "Already have it, reframe real work, build a small proof project, or learn it properly. No keyword stuffing.",
  },
  {
    icon: Layers,
    title: "Your design, or a cleaner one",
    body: "Keep the fonts and margins from your upload, or move to eight ATS templates and three designer layouts.",
  },
  {
    icon: PenLine,
    title: "Writing guardrails built in",
    body: "Weak openers, cliches, passive voice and invented metrics are flagged before you export.",
  },
  {
    icon: KanbanSquare,
    title: "One place for every application",
    body: "Track stages, attach the exact resume version you sent, prep interviews and reuse what works.",
  },
];

const rules = [
  { bad: "Results driven professional", good: "Cut invoice errors from 8% to 2%" },
  { bad: "Responsible for reporting", good: "Built the weekly revenue model used by sales" },
  { bad: "Team player who helped", good: "Coordinated four teams across two launches" },
];

export default function LandingPage() {
  const atsTemplates = templates.filter((t) => t.kind === "ats");
  const designerTemplates = templates.filter((t) => t.kind === "designer");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="ResumeForge home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#product" className="transition hover:text-foreground">Product</a>
            <a href="#templates" className="transition hover:text-foreground">Templates</a>
            <a href="#how" className="transition hover:text-foreground">How it works</a>
            <a href="#writing" className="transition hover:text-foreground">Writing rules</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/login?next=/onboarding">
              <Button size="sm" variant="forge">
                Score my resume <ArrowRight />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          <div className="grid-fade pointer-events-none absolute inset-0 opacity-60" />
          <div className="container relative grid gap-14 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-24">
            <div className="animate-fade-up">
              <Badge variant="forge" className="mb-5 px-3 py-1 text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5" /> ATS first. Truth always.
              </Badge>
              <h1 className="max-w-xl text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl xl:text-[3.7rem]">
                Your resume, read the way a machine reads it.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Upload a file, see the plain text an ATS actually receives, and fix what is costing you interviews. Then tailor each application without inventing a single claim.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login?next=/onboarding">
                  <Button size="lg" variant="forge">
                    Score my resume free <ArrowRight />
                  </Button>
                </Link>
                <a href="#how">
                  <Button size="lg" variant="outline">See the workflow</Button>
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-forge-600" /> PDF, DOCX and TXT</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-forge-600" /> Results in under a minute</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-forge-600" /> Export only after the fact check</span>
              </div>
            </div>

            <div className="relative animate-fade-up [animation-delay:120ms]">
              <div className="absolute -inset-6 rounded-[2rem] bg-forge-500/10 blur-2xl" />
              <div className="relative rounded-2xl border bg-card p-4 shadow-paper sm:p-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-[11px] font-medium text-muted-foreground">ATS report</span>
                  </div>
                  <Badge variant="warning">Needs work</Badge>
                </div>
                <div className="grid gap-5 pt-5 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="flex flex-col items-center gap-2">
                    <ScoreRing score={74} size={128} />
                    <span className="text-[11px] text-muted-foreground">Product analyst role</span>
                  </div>
                  <div className="space-y-3">
                    {dimensions.map((dimension) => (
                      <div key={dimension.label}>
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="font-medium">{dimension.label}</span>
                          <span className="tabular-nums text-muted-foreground">{dimension.value}/{dimension.max}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full" style={{ width: `${(dimension.value / dimension.max) * 100}%`, background: dimension.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 space-y-2 border-t pt-4">
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/40">
                    <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                    <div>
                      <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">4 must have keywords are missing</div>
                      <div className="text-[10px] text-amber-800/80 dark:text-amber-300/80">SQL, experimentation, stakeholder communication, dashboarding</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 dark:border-rose-900 dark:bg-rose-950/40">
                    <Fingerprint className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-700 dark:text-rose-400" />
                    <div>
                      <div className="text-[11px] font-semibold text-rose-900 dark:text-rose-200">1 unsupported claim blocked at export</div>
                      <div className="text-[10px] text-rose-800/80 dark:text-rose-300/80">The metric 37% does not appear in your source resume.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -left-6 top-1/3 hidden rounded-xl border bg-card px-3 py-2 shadow-lift sm:block">
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  <ScanSearch className="h-3.5 w-3.5 text-forge-600" /> What the ATS sees
                </div>
              </div>
              <div className="absolute -bottom-5 -right-4 hidden rounded-xl border bg-card px-3 py-2 shadow-lift sm:block">
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Every claim traced
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-card/40">
          <div className="container grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            {[
              { value: "8", label: "weighted scoring dimensions" },
              { value: "11", label: "ATS and designer templates" },
              { value: "3", label: "clean export formats" },
              { value: "0", label: "invented claims allowed" },
            ].map((stat) => (
              <div key={stat.label} className="px-4 py-6 text-center">
                <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="product" className="container py-20">
          <div className="max-w-2xl">
            <div className="eyebrow">The whole workflow</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Built for the job you are applying to today.</h2>
            <p className="mt-4 text-muted-foreground">
              Most tools stop at a score. ResumeForge carries the same facts from upload to tailored version to exported file, and shows you every step it took.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="group rounded-xl border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-forge-700 dark:text-forge-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-y bg-ink-950 py-20 text-ink-100">
          <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-forge-300">The hidden step</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The pretty version is not the version the ATS reads.</h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-300">
                Columns, text boxes, icons, tables and headers can disappear or scramble. ResumeForge shows the extracted text, flags the risky layout choices and tells you exactly which template will parse cleanly.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "See selectable text exactly as a parser receives it",
                  "Detect multi column layouts, tables, text boxes and image only files",
                  "Switch to a clean single column template without retyping",
                  "Check section headings against the standard set",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-ink-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-forge-400" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-lift">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-ink-200">
                  <FileSearch className="h-3.5 w-3.5 text-forge-300" /> Parsed output
                </div>
                <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">3 risks found</span>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg bg-ink-900/80 p-4 font-mono text-[11px] leading-relaxed text-ink-300 scrollbar-thin">
{`ALEX MORGAN
Product Analyst

EXPERIENCE
Product Analyst, Northwind
2022 - Present
- Built SQL reporting used by 6 teams
- Ran 14 experiments on onboarding

SKILLS
SQL, Python, Tableau

[ PAGE 2 HEADER LOST ]
[ TWO COLUMN BLOCK MERGED ]
[ IMAGE ONLY CERTIFICATION ]`}
              </pre>
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="flex items-center gap-2 text-rose-300"><X className="h-3.5 w-3.5" /> Contact line split across two columns</div>
                <div className="flex items-center gap-2 text-amber-300"><Braces className="h-3.5 w-3.5" /> Skill bars converted to unreadable symbols</div>
                <div className="flex items-center gap-2 text-emerald-300"><Check className="h-3.5 w-3.5" /> Work history reads in the right order</div>
              </div>
            </div>
          </div>
        </section>

        <section id="templates" className="container py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="eyebrow">Templates</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Start clean. Add character only where it is safe.</h2>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              Eleven layouts, each labelled with its parser risk. Designer templates show a warning before you export, not after the rejection.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {atsTemplates.slice(0, 4).map((template, index) => (
              <div key={template.id} className="rounded-xl border bg-card p-3 shadow-soft">
                <div className="aspect-[8.5/11] overflow-hidden rounded-md border bg-white p-3">
                  <div className="h-2 w-24 rounded-sm" style={{ background: template.design.accent ?? "#111827" }} />
                  <div className="mt-1 h-1 w-16 rounded-sm bg-gray-200" />
                  <div className="mt-3 h-px w-full bg-gray-200" />
                  <div className="mt-2 space-y-1">
                    {[90, 76, 84, 62, 88, 70, 80, 55].map((width, i) => (
                      <div key={i} className="h-1 rounded-sm bg-gray-100" style={{ width: `${width}%` }} />
                    ))}
                  </div>
                  <div className="mt-3 h-px w-full bg-gray-200" />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="space-y-1">{[70, 85, 60].map((w, i) => <div key={i} className="h-1 rounded-sm bg-gray-100" style={{ width: `${w}%` }} />)}</div>
                    <div className="space-y-1">{[80, 65, 75].map((w, i) => <div key={i} className="h-1 rounded-sm bg-gray-100" style={{ width: `${w}%` }} />)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{template.name}</div>
                    <div className="text-[11px] text-muted-foreground">{template.description}</div>
                  </div>
                  <Badge variant="success">ATS safe</Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {designerTemplates.map((template) => (
              <div key={template.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{template.name}</div>
                  <div className="text-[11px] text-muted-foreground">{template.description}</div>
                </div>
                <Badge variant={template.atsRisk === "high" ? "destructive" : template.atsRisk === "medium" ? "warning" : "info"}>
                  {template.atsRisk} risk
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="border-y bg-card/40 py-20">
          <div className="container">
            <div className="max-w-2xl">
              <div className="eyebrow">How it works</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Three steps. No black box.</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                { icon: FileText, step: "01", title: "Upload and inspect", body: "We extract the text, detect layout risks and show the plain version. You confirm the parse before anything is scored." },
                { icon: Wand2, step: "02", title: "Fix and tailor", body: "Work the score one fix at a time. Paste a job description to see missing keywords and accept only changes you can defend." },
                { icon: ClipboardCheck, step: "03", title: "Check and export", body: "A final fact check traces every claim. Placeholders and unsupported numbers block the file until you resolve them." },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="relative rounded-xl border bg-background p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-forge-700 dark:text-forge-300"><Icon className="h-5 w-5" /></div>
                      <span className="font-mono text-xs text-muted-foreground">{step.step}</span>
                    </div>
                    <h3 className="mt-5 text-base font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="writing" className="container py-20">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="eyebrow">Writing standards</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Adjectives do not survive a six second scan.</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Every generator follows the same rules: one idea per bullet, a strong verb, the actual tool, and a number only when your source text supports it. The editor catches the rest.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["No invented metrics", "No cliches", "No em dashes", "Past tense for old roles", "One page when it fits"].map((item) => (
                  <span key={item} className="rounded-full border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground">{item}</span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.bad} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300"><X className="h-3 w-3" /> Weak</div>
                    <p className="text-xs leading-relaxed text-rose-900 dark:text-rose-200">{rule.bad}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" /> Specific</div>
                    <p className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">{rule.good}</p>
                  </div>
                </div>
              ))}
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forge-600" />
                The AI never invents an employer, title, date, degree, certification or number. If a metric is missing, it asks you for it.
              </p>
            </div>
          </div>
        </section>

        <section className="container pb-20">
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-forge-900 via-forge-800 to-ink-950 px-6 py-12 text-white sm:px-12 sm:py-16">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-forge-400/20 blur-3xl" />
            <div className="relative max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Know what your resume says before a recruiter does.</h2>
              <p className="mt-4 text-sm leading-relaxed text-forge-100">
                Start with a score, leave with a file you can defend line by line.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/login?next=/onboarding">
                  <Button size="lg" className="bg-white text-forge-900 hover:bg-forge-50">
                    Score my resume free <ArrowRight />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">Sign in</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/40">
        <div className="container flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
              An ATS first resume workspace. Your source text stays private, and every generated claim has to point back to it.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/login?next=/onboarding" className="hover:text-foreground">Get started</Link>
            <a href="#product" className="hover:text-foreground">Product</a>
            <a href="#templates" className="hover:text-foreground">Templates</a>
            <span>ResumeForge</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
