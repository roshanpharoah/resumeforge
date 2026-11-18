"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  FileText,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client";
import { applyTemplate, keepMyDesign } from "@/lib/templates";
import type { DesignTokens, ResumeData } from "@/lib/types";
import type { AnalyzeResponse, CreateResumeResponse, ParseUploadResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ParseResult = ParseUploadResponse & { fileKey?: string };

const sampleResume = `Jordan Ellis
Product Analyst
jordan.ellis@example.com | (555) 014-2290 | Chicago, IL | linkedin.com/in/jordanellis

SUMMARY
Product analyst with four years of experience in subscription software. Builds reporting that product and sales teams use weekly, and runs experiments with clear success measures.

EXPERIENCE
Product Analyst, Northwind Labs, Chicago, IL
Mar 2022 to Present
- Built a SQL reporting layer that replaced four manual spreadsheets and cut weekly prep time by six hours
- Ran 14 onboarding experiments, including a shorter trial flow that increased activation by 9 percent
- Partnered with support to tag 1,200 tickets and identify the three most common setup blockers

Associate Analyst, Harbor Metrics, Chicago, IL
Jun 2020 to Feb 2022
- Automated a recurring churn report in Python, reducing turnaround from two days to three hours
- Documented 22 dashboard definitions so sales and finance used the same revenue logic
- Presented monthly findings to a group of eight account managers

EDUCATION
B.S., Economics, University of Illinois, 2020

SKILLS
Analysis: SQL, Python, Excel, dbt
Visualization: Tableau, Looker
Collaboration: experiment design, stakeholder interviews, documentation

PROJECTS
Cohort Retention Model
- Built a cohort retention model in Python and Tableau to compare monthly plan upgrades
`;

const templates = [
  { id: "ats-classic", name: "Classic", note: "Clean, single column, standard headings" },
  { id: "ats-compact", name: "Compact", note: "More content, still parses cleanly" },
  { id: "ats-editorial", name: "Editorial", note: "Serif headings, quiet hierarchy" },
  { id: "ats-mono", name: "Technical", note: "Tight skill rows for engineering roles" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [dragActive, setDragActive] = useState(false);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [headline, setHeadline] = useState("");
  const [keepDesign, setKeepDesign] = useState(true);
  const [templateId, setTemplateId] = useState("ats-classic");

  const [jdText, setJdText] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStage, setSaveStage] = useState("");

  async function parseForm(form: FormData) {
    setParsing(true);
    setError(null);
    try {
      const result = await api<ParseResult>("/api/parse", { method: "POST", body: form });
      setParsed(result);
      setFullName(result.data.contact.fullName || "");
      setEmail(result.data.contact.email || "");
      setPhone(result.data.contact.phone || "");
      setHeadline(result.data.contact.headline || "");
      setTitle(result.data.contact.fullName ? `${result.data.contact.fullName} Resume` : result.fileName.replace(/\.[^.]+$/, ""));
      setKeepDesign(Boolean(result.design.detected && result.design.detected.confidence >= 0.2));
      setTemplateId(result.design.templateId === "uploaded" ? "ats-classic" : result.design.templateId);
      setStep(2);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setParsing(false);
    }
  }

  async function handleFile(file: File) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await parseForm(form);
  }

  async function handlePaste() {
    if (pasted.trim().length < 30) {
      setError("Paste at least a few lines of your resume.");
      return;
    }
    const form = new FormData();
    form.append("text", pasted);
    await parseForm(form);
  }

  async function handleSample() {
    const form = new FormData();
    form.append("text", sampleResume);
    await parseForm(form);
  }

  async function importJd() {
    if (!jdUrl.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const result = await api<{ text: string; extracted: { role: string; company: string } }>("/api/analyze/jd-url", {
        method: "POST",
        body: JSON.stringify({ url: jdUrl }),
      });
      setJdText(result.text);
      if (!role && result.extracted.role) setRole(result.extracted.role);
      if (!company && result.extracted.company) setCompany(result.extracted.company);
      toast.success("Job description imported.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  async function createAndScore(includeJd = true) {
    if (!parsed) return;
    setSaving(true);
    setError(null);
    try {
      setSaveStage("Saving your resume...");
      const design: DesignTokens = keepDesign ? keepMyDesign(parsed.design) : applyTemplate(parsed.design, templateId);
      const data: ResumeData = {
        ...parsed.data,
        contact: {
          ...parsed.data.contact,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          headline: headline.trim(),
        },
      };
      const create = await api<CreateResumeResponse>("/api/resumes", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || "My Resume",
          rawText: parsed.rawText,
          data,
          design,
          templateId: design.templateId,
          designSource: keepDesign ? "upload" : "template",
          parseRisks: parsed.parseRisks,
          originalFileKey: parsed.fileKey,
          originalFileName: parsed.fileName,
          originalFileType: parsed.fileType,
        }),
      });
      setSaveStage("Scoring eight dimensions...");
      await api<AnalyzeResponse>(`/api/resumes/${create.resume.id}/analyze`, {
        method: "POST",
        body: JSON.stringify({
          jdText: includeJd ? jdText.trim() || undefined : undefined,
          company: includeJd ? company.trim() || undefined : undefined,
          title: includeJd ? role.trim() || undefined : undefined,
          includeLlm: true,
        }),
      });
      setSaveStage("Opening your report...");
      router.push(`/resumes/${create.resume.id}/analyze?first=1`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/dashboard" aria-label="ResumeForge dashboard"><Logo /></Link>
          <div className="hidden items-center gap-2 sm:flex">
            {[1, 2, 3].map((number) => (
              <div key={number} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                    step > number ? "border-forge-600 bg-forge-600 text-white" : step === number ? "border-forge-600 text-forge-700 dark:text-forge-300" : "text-muted-foreground",
                  )}
                >
                  {step > number ? <Check className="h-3 w-3" /> : number}
                </div>
                <span className={cn("text-xs", step === number ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {number === 1 ? "Upload" : number === 2 ? "Review" : "Target role"}
                </span>
                {number < 3 && <div className="h-px w-8 bg-border" />}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/dashboard"><Button variant="ghost" size="sm">Skip</Button></Link>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-10">
        {step === 1 && (
          <div className="animate-fade-up">
            <div className="eyebrow">Step 1 of 3</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Start with the resume you already have.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Upload a PDF, DOCX or TXT file. We extract the text, check the parse risks and show you the plain version before scoring anything. Scanned image PDFs will not work.
            </p>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div
                className={cn(
                  "flex min-h-[340px] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card px-6 py-10 text-center transition",
                  dragActive ? "border-forge-500 bg-forge-50/50 dark:bg-forge-950/20" : "border-border",
                )}
                onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                  {parsing ? <Loader2 className="h-6 w-6 animate-spin text-forge-600" /> : <UploadCloud className="h-6 w-6 text-forge-600 dark:text-forge-400" />}
                </div>
                <h2 className="mt-4 text-lg font-semibold">{parsing ? "Reading your file..." : "Drop your resume here"}</h2>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                  PDF, DOCX or TXT up to 12 MB. Text stays private and is only used for your own analysis.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button variant="forge" onClick={() => fileInput.current?.click()} disabled={parsing}>
                    <FileText /> Choose file
                  </Button>
                  <Button variant="outline" onClick={() => setShowPaste((value) => !value)} disabled={parsing}>
                    <ClipboardPaste /> Paste text
                  </Button>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    event.target.value = "";
                  }}
                />
                <button type="button" onClick={handleSample} className="mt-4 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground" disabled={parsing}>
                  No file handy? Try the sample resume
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-forge-600" /> What happens next</h3>
                  <ol className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
                    <li className="flex gap-2"><span className="font-mono text-forge-600">01</span> We read the text and detect layout risks.</li>
                    <li className="flex gap-2"><span className="font-mono text-forge-600">02</span> You confirm the fields and choose a template.</li>
                    <li className="flex gap-2"><span className="font-mono text-forge-600">03</span> Add a target role if you have one, then score.</li>
                  </ol>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Scanned PDFs</div>
                  <p className="mt-1.5">If your PDF is a picture, an ATS cannot read it either. Export a text based PDF from your editor first.</p>
                </div>
              </div>
            </div>

            {showPaste && (
              <div className="mt-6 rounded-xl border bg-card p-5">
                <div className="mb-2 flex items-center justify-between">
                  <Label htmlFor="pasted">Paste your resume text</Label>
                  <button type="button" onClick={() => setShowPaste(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <Textarea
                  id="pasted"
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                  placeholder="Paste everything, including contact details, roles, dates, bullets, education and skills."
                  className="min-h-[220px] font-mono text-xs"
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={handlePaste} disabled={parsing || pasted.trim().length < 30} variant="forge">
                    {parsing ? <Loader2 className="animate-spin" /> : <ArrowRight />} Read this text
                  </Button>
                </div>
              </div>
            )}

            {error && <ErrorBox message={error} />}
          </div>
        )}

        {step === 2 && parsed && (
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="eyebrow">Step 2 of 3</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Check what we read.</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Fix the contact details and pick a look. This is also the moment to catch a parser mistake before it follows you into the editor.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setStep(1); setParsed(null); }}>
                <ArrowLeft /> Start over
              </Button>
            </div>

            <div className="mt-7 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-5">
                <div className="rounded-xl border bg-card p-5">
                  <h2 className="text-sm font-semibold">Contact and file name</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Full name" value={fullName} onChange={setFullName} />
                    <Field label="Email" value={email} onChange={setEmail} type="email" />
                    <Field label="Phone" value={phone} onChange={setPhone} />
                    <Field label="Headline" value={headline} onChange={setHeadline} placeholder="Product Analyst" />
                    <div className="sm:col-span-2">
                      <Field label="Resume name" value={title} onChange={setTitle} placeholder="My Resume" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Choose a template</h2>
                    <span className="text-[11px] text-muted-foreground">{parsed.design.detected ? "Design detected" : "Clean start"}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {parsed.design.detected && parsed.design.detected.confidence >= 0.2 && (
                      <button
                        type="button"
                        onClick={() => { setKeepDesign(true); setTemplateId("uploaded"); }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
                          keepDesign ? "border-forge-500 ring-1 ring-forge-500" : "hover:bg-accent",
                        )}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary"><Sparkles className="h-4 w-4 text-forge-600" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold">Keep my design</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {parsed.design.detected.fonts[0] || "Detected font"}, {parsed.design.detected.margins ? `${Math.round(parsed.design.detected.margins)}px margins` : "standard margins"}
                          </div>
                        </div>
                        {keepDesign && <Check className="h-4 w-4 text-forge-600" />}
                      </button>
                    )}
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => { setKeepDesign(false); setTemplateId(template.id); }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
                          !keepDesign && templateId === template.id ? "border-forge-500 ring-1 ring-forge-500" : "hover:bg-accent",
                        )}
                      >
                        <div className="h-9 w-7 rounded-sm border bg-white p-1">
                          <div className="h-1 rounded-sm bg-ink-800" />
                          <div className="mt-1 space-y-0.5">{[100, 80, 90, 70].map((w) => <div key={w} className="h-0.5 rounded-sm bg-gray-200" style={{ width: `${w}%` }} />)}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold">{template.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{template.note}</div>
                        </div>
                        {!keepDesign && templateId === template.id && <Check className="h-4 w-4 text-forge-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
                    <h2 className="text-sm font-semibold">What the ATS sees</h2>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">{parsed.pageCount} page{parsed.pageCount === 1 ? "" : "s"}</Badge>
                      <Badge variant="outline">{parsed.rawText.split(/\s+/).filter(Boolean).length} words</Badge>
                      <Badge variant={parsed.parseRisks.some((risk) => risk.severity === "critical") ? "destructive" : parsed.parseRisks.length ? "warning" : "success"}>
                        {parsed.parseRisks.length ? `${parsed.parseRisks.length} risk${parsed.parseRisks.length === 1 ? "" : "s"}` : "No risks"}
                      </Badge>
                    </div>
                  </div>
                  <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-[11px] leading-relaxed text-muted-foreground scrollbar-thin">
                    {parsed.rawText.slice(0, 5000)}
                  </pre>
                </div>

                {parsed.parseRisks.length > 0 && (
                  <div className="rounded-xl border bg-card p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parse risks</h3>
                    <div className="mt-2 space-y-2">
                      {parsed.parseRisks.slice(0, 6).map((risk) => (
                        <div key={risk.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                          <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", risk.severity === "critical" ? "text-rose-600" : risk.severity === "warning" ? "text-amber-600" : "text-sky-600")} />
                          <div>
                            <div className="text-xs font-medium">{risk.label}</div>
                            <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{risk.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && <ErrorBox message={error} />}
            <div className="mt-7 flex justify-end">
              <Button variant="forge" onClick={() => setStep(3)}>
                Continue to target role <ArrowRight />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && parsed && (
          <div className="animate-fade-up">
            <div className="eyebrow">Step 3 of 3</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Target a real job description.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Optional, but it turns the keyword dimension on and gives you a match score. Do not add skills you do not have. Missing terms become gap work, not filler.
            </p>

            <div className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <Label htmlFor="jd">Job description</Label>
                  <span className="text-[11px] text-muted-foreground">{jdText.length.toLocaleString()} characters</span>
                </div>
                <Textarea
                  id="jd"
                  value={jdText}
                  onChange={(event) => setJdText(event.target.value)}
                  placeholder="Paste the full job posting, including responsibilities and requirements."
                  className="mt-2 min-h-[260px] text-xs leading-relaxed"
                />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input value={jdUrl} onChange={(event) => setJdUrl(event.target.value)} placeholder="https://company.com/jobs/role" />
                  <Button type="button" variant="outline" onClick={importJd} disabled={importing || !jdUrl.trim()} className="shrink-0">
                    {importing ? <Loader2 className="animate-spin" /> : <Link2 />} {importing ? "Reading..." : "Import from URL"}
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Company" value={company} onChange={setCompany} placeholder="Northwind Labs" />
                  <Field label="Role title" value={role} onChange={setRole} placeholder="Product Analyst" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-5">
                  <h2 className="text-sm font-semibold">Ready to score</h2>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Resume</dt><dd className="truncate font-medium">{title || "Untitled"}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Name</dt><dd className="truncate font-medium">{fullName || "Not set"}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Template</dt><dd className="font-medium">{keepDesign ? "Keep my design" : templateId.replace("ats-", "")}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Target</dt><dd className="truncate font-medium">{role || "No job description"}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Parse risks</dt><dd className="font-medium">{parsed.parseRisks.length}</dd></div>
                  </dl>
                  <Button className="mt-5 w-full" variant="forge" onClick={() => void createAndScore()} disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {saving ? saveStage || "Working..." : jdText.trim() ? "Save and score against this job" : "Save and run the general score"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => void createAndScore(false)}
                    disabled={saving}
                    className="mt-2 w-full text-center text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Skip the job description
                  </button>
                </div>
                <div className="rounded-xl border bg-muted/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">A note on the score.</span> The keyword dimension only turns on with a job description. Without one, the remaining seven dimensions are normalized into a general ATS readiness score.
                </div>
              </div>
            </div>

            {error && <ErrorBox message={error} />}
            <div className="mt-7 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={saving}><ArrowLeft /> Back</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-relaxed text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
      {message}
      {/database|DATABASE_URL|not configured|reachable/i.test(message) && (
        <div className="mt-1.5 text-rose-600 dark:text-rose-400">
          Add DATABASE_URL to .env and run npm run db:push, then reload this page.
        </div>
      )}
    </div>
  );
}
