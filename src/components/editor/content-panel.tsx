"use client";

import { ArrowDownUp, Plus, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BulletContext } from "@/components/editor/bullet-dialog";
import { CommaListField, EditorCard, Field, MoveButtons, TextAreaField } from "@/components/editor/helpers";
import { moveItem } from "@/lib/utils";
import {
  sectionKeys,
  sectionLabels,
  uid,
  type Experience,
  type ResumeData,
  type SectionKey,
} from "@/lib/types";

export function ContentPanel({
  data,
  onChange,
  onRewrite,
  onGenerateSummary,
}: {
  data: ResumeData;
  onChange: (next: ResumeData) => void;
  onRewrite: (context: BulletContext) => void;
  onGenerateSummary: () => void;
}) {
  const set = (patch: Partial<ResumeData>) => onChange({ ...data, ...patch });

  function setContact(field: keyof ResumeData["contact"], value: string) {
    set({ contact: { ...data.contact, [field]: value } });
  }

  function setExperience(index: number, patch: Partial<Experience>) {
    set({ experience: data.experience.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function moveExperience(from: number, to: number) {
    set({ experience: moveItem(data.experience, from, to) });
  }

  function addExperience() {
    const role: Experience = {
      id: uid(),
      company: "",
      title: "",
      location: "",
      startDate: "",
      endDate: "",
      current: false,
      bullets: [],
      source: "user_text",
    };
    set({ experience: [...data.experience, role] });
  }

  function addBullet(index: number) {
    const experience = data.experience[index];
    const bullets = [...experience.bullets, { id: uid(), text: "", source: { type: "user_answer" as const, ref: "Editor", quote: "" }, verified: true, metricPlaceholder: false, keywords: [] }];
    setExperience(index, { bullets });
  }

  function moveSection(from: number, to: number) {
    set({ sectionOrder: moveItem<SectionKey>(data.sectionOrder, from, to) });
  }

  function addProject() {
    set({
      projects: [
        ...data.projects,
        { id: uid(), name: "", role: "", description: "", url: "", startDate: "", endDate: "", bullets: [], source: "user_text", planned: false },
      ],
    });
  }

  function addEducation() {
    set({
      education: [
        ...data.education,
        { id: uid(), institution: "", degree: "", field: "", location: "", startDate: "", endDate: "", details: "", source: "user_text" },
      ],
    });
  }

  function addCertification() {
    set({
      certifications: [...data.certifications, { id: uid(), name: "", issuer: "", issueDate: "", credentialId: "", url: "", source: "user_text" }],
    });
  }

  function addAward() {
    set({ awards: [...data.awards, { id: uid(), name: "", issuer: "", date: "", description: "", source: "user_text" }] });
  }

  function addCustom() {
    set({ custom: [...data.custom, { id: uid(), title: "Additional", content: "" }] });
  }

  return (
    <div className="space-y-4">
      <EditorCard title="Basics" description="This is what sits at the top of the page. Use the name and links a recruiter can verify.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={data.contact.fullName} onChange={(value) => setContact("fullName", value)} placeholder="Jordan Ellis" />
          <Field label="Headline" value={data.contact.headline ?? ""} onChange={(value) => setContact("headline", value)} placeholder="Product Analyst" />
          <Field label="Email" value={data.contact.email} onChange={(value) => setContact("email", value)} placeholder="you@example.com" type="email" />
          <Field label="Phone" value={data.contact.phone ?? ""} onChange={(value) => setContact("phone", value)} placeholder="(555) 014-2290" />
          <Field label="Location" value={data.contact.location ?? ""} onChange={(value) => setContact("location", value)} placeholder="Chicago, IL" />
          <Field label="LinkedIn" value={data.contact.linkedin ?? ""} onChange={(value) => setContact("linkedin", value)} placeholder="linkedin.com/in/you" />
          <Field label="GitHub" value={data.contact.github ?? ""} onChange={(value) => setContact("github", value)} placeholder="github.com/you" />
          <Field label="Website" value={data.contact.website ?? ""} onChange={(value) => setContact("website", value)} placeholder="yoursite.com" />
        </div>
      </EditorCard>

      <EditorCard
        title="Section order"
        description="Move the story a recruiter should read first to the top. Standard headings parse best."
        action={<Badge variant="outline"><ArrowDownUp className="h-3 w-3" /> {data.sectionOrder.length} sections</Badge>}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {data.sectionOrder.map((key, index) => (
            <div key={key} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
              <span className="text-xs font-medium">{sectionLabels[key]}</span>
              <MoveButtons index={index} length={data.sectionOrder.length} onMove={moveSection} />
            </div>
          ))}
        </div>
        {!data.sectionOrder.includes("custom") && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={addCustom}>
            <Plus /> Add an additional section
          </Button>
        )}
      </EditorCard>

      <EditorCard
        title="Summary"
        description="Three or four sentences that state your level, your evidence and the role you want."
        action={
          <Button size="sm" variant="outline" onClick={onGenerateSummary}>
            <Sparkles /> Generate options
          </Button>
        }
      >
        <Textarea
          value={data.summary}
          onChange={(event) => set({ summary: event.target.value, summarySource: { type: "user_answer", ref: "Edited in ResumeForge", quote: event.target.value } })}
          placeholder="Product analyst with four years in subscription software. Built reporting that sales and product teams use weekly."
          className="min-h-[120px]"
        />
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{data.summary.trim() ? `${data.summary.trim().split(/\s+/).length} words` : "No summary yet"}</span>
          <span>Target: 35 to 70 words. No first person pronouns.</span>
        </div>
      </EditorCard>

      <EditorCard
        title="Experience"
        description="One idea per bullet. Past tense for past roles, present tense for the current one."
        action={
          <Button size="sm" variant="outline" onClick={addExperience}>
            <Plus /> Add role
          </Button>
        }
      >
        {!data.experience.length ? (
          <EmptySection text="No roles yet. Add the first one, even if it was an internship." />
        ) : (
          <div className="space-y-4">
            {data.experience.map((experience, index) => (
              <div key={experience.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Role {index + 1}
                    {experience.title || experience.company ? `: ${experience.title || "Untitled"}${experience.company ? ` at ${experience.company}` : ""}` : ""}
                  </div>
                  <MoveButtons
                    index={index}
                    length={data.experience.length}
                    onMove={moveExperience}
                    onRemove={() => set({ experience: data.experience.filter((item) => item.id !== experience.id) })}
                  />
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field label="Title" value={experience.title} onChange={(value) => setExperience(index, { title: value })} placeholder="Product Analyst" />
                  <Field label="Company" value={experience.company} onChange={(value) => setExperience(index, { company: value })} placeholder="Northwind Labs" />
                  <Field label="Location" value={experience.location ?? ""} onChange={(value) => setExperience(index, { location: value })} placeholder="Chicago, IL" />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Start" value={experience.startDate ?? ""} onChange={(value) => setExperience(index, { startDate: value })} placeholder="Mar 2022" />
                    <Field label="End" value={experience.endDate ?? ""} onChange={(value) => setExperience(index, { endDate: value, ...(value ? { current: false } : {}) })} placeholder="Present" />
                  </div>
                </div>
                <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Switch
                    checked={experience.current}
                    onCheckedChange={(checked) => setExperience(index, { current: checked, ...(checked ? { endDate: "" } : {}) })}
                  />
                  This is my current role
                </label>

                <div className="mt-3 space-y-2">
                  {experience.bullets.map((bullet, bulletIndex) => (
                    <div key={bullet.id} className="rounded-lg border bg-muted/20 p-2.5">
                      <Textarea
                        value={bullet.text}
                        onChange={(event) =>
                          setExperience(index, {
                            bullets: experience.bullets.map((item, i) =>
                              i === bulletIndex
                                ? { ...item, text: event.target.value, source: { type: "user_answer", ref: "Edited in ResumeForge", quote: item.source.quote || event.target.value } }
                                : item,
                            ),
                          })
                        }
                        placeholder="Built a SQL reporting layer that replaced four manual spreadsheets and cut weekly prep time by six hours."
                        className="min-h-[54px] border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                      />
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onRewrite({
                              kind: "experience",
                              expId: experience.id,
                              bulletId: bullet.id,
                              text: bullet.text,
                              role: experience.title,
                              company: experience.company,
                              current: experience.current,
                            })
                          }
                        >
                          <Wand2 /> Rewrite
                        </Button>
                        <MoveButtons
                          index={bulletIndex}
                          length={experience.bullets.length}
                          onMove={(from, to) => setExperience(index, { bullets: moveItem(experience.bullets, from, to) })}
                          onRemove={() => setExperience(index, { bullets: experience.bullets.filter((item) => item.id !== bullet.id) })}
                          removeLabel="Delete bullet"
                        />
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => addBullet(index)}>
                    <Plus /> Add bullet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </EditorCard>

      <EditorCard
        title="Projects"
        description="Only include projects you finished or can honestly describe as in progress. A planned project is added after it is done."
        action={
          <Button size="sm" variant="outline" onClick={addProject}>
            <Plus /> Add project
          </Button>
        }
      >
        {!data.projects.length ? (
          <EmptySection text="No projects yet. A gap plan can add one when it is done and has a public link." />
        ) : (
          <div className="space-y-4">
            {data.projects.map((project, index) => (
              <div key={project.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Project {index + 1}</span>
                  <MoveButtons
                    index={index}
                    length={data.projects.length}
                    onMove={(from, to) => set({ projects: moveItem(data.projects, from, to) })}
                    onRemove={() => set({ projects: data.projects.filter((item) => item.id !== project.id) })}
                  />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field label="Name" value={project.name} onChange={(value) => set({ projects: data.projects.map((item, i) => (i === index ? { ...item, name: value } : item)) })} placeholder="Cohort retention model" />
                  <Field label="Role" value={project.role ?? ""} onChange={(value) => set({ projects: data.projects.map((item, i) => (i === index ? { ...item, role: value } : item)) })} placeholder="Solo project" />
                  <Field label="Link" value={project.url ?? ""} onChange={(value) => set({ projects: data.projects.map((item, i) => (i === index ? { ...item, url: value } : item)) })} placeholder="https://github.com/you/project" />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Start" value={project.startDate ?? ""} onChange={(value) => set({ projects: data.projects.map((item, i) => (i === index ? { ...item, startDate: value } : item)) })} />
                    <Field label="End" value={project.endDate ?? ""} onChange={(value) => set({ projects: data.projects.map((item, i) => (i === index ? { ...item, endDate: value } : item)) })} />
                  </div>
                </div>
                <TextAreaField
                  label="Description"
                  className="mt-2"
                  value={project.description ?? ""}
                  onChange={(value) => set({ projects: data.projects.map((item, i) => (i === index ? { ...item, description: value } : item)) })}
                  rows={2}
                />
                <div className="mt-2 space-y-2">
                  {project.bullets.map((bullet, bulletIndex) => (
                    <div key={bullet.id} className="rounded-lg border bg-muted/20 p-2.5">
                      <Textarea
                        value={bullet.text}
                        onChange={(event) =>
                          set({
                            projects: data.projects.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    bullets: item.bullets.map((entry, j) =>
                                      j === bulletIndex ? { ...entry, text: event.target.value, source: { type: "user_answer", ref: "Edited in ResumeForge", quote: entry.source.quote || event.target.value } } : entry,
                                    ),
                                  }
                                : item,
                            ),
                          })
                        }
                        className="min-h-[44px] border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                        placeholder="Built the model in Python and Tableau to compare monthly plan upgrades."
                      />
                      <div className="mt-1 flex items-center justify-between">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onRewrite({
                              kind: "project",
                              expId: project.id,
                              bulletId: bullet.id,
                              text: bullet.text,
                              role: project.name,
                              company: "Project",
                              current: false,
                            })
                          }
                        >
                          <Wand2 /> Rewrite
                        </Button>
                        <MoveButtons
                          index={bulletIndex}
                          length={project.bullets.length}
                          onMove={(from, to) =>
                            set({
                              projects: data.projects.map((item, i) =>
                                i === index ? { ...item, bullets: moveItem(item.bullets, from, to) } : item,
                              ),
                            })
                          }
                          onRemove={() =>
                            set({
                              projects: data.projects.map((item, i) =>
                                i === index ? { ...item, bullets: item.bullets.filter((entry) => entry.id !== bullet.id) } : item,
                              ),
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      set({
                        projects: data.projects.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                bullets: [
                                  ...item.bullets,
                                  { id: uid(), text: "", source: { type: "user_answer", ref: "Editor", quote: "" }, verified: true, metricPlaceholder: false, keywords: [] },
                                ],
                              }
                            : item,
                        ),
                      })
                    }
                  >
                    <Plus /> Add bullet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </EditorCard>

      <EditorCard
        title="Education"
        description="Degrees, institutions and dates must match what you can document."
        action={
          <Button size="sm" variant="outline" onClick={addEducation}>
            <Plus /> Add education
          </Button>
        }
      >
        {!data.education.length ? (
          <EmptySection text="No education yet. Add the highest relevant credential." />
        ) : (
          <div className="space-y-4">
            {data.education.map((education, index) => (
              <div key={education.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Education {index + 1}</span>
                  <MoveButtons
                    index={index}
                    length={data.education.length}
                    onMove={(from, to) => set({ education: moveItem(data.education, from, to) })}
                    onRemove={() => set({ education: data.education.filter((item) => item.id !== education.id) })}
                  />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field label="Institution" value={education.institution} onChange={(value) => set({ education: data.education.map((item, i) => (i === index ? { ...item, institution: value } : item)) })} placeholder="University of Illinois" />
                  <Field label="Degree" value={education.degree ?? ""} onChange={(value) => set({ education: data.education.map((item, i) => (i === index ? { ...item, degree: value } : item)) })} placeholder="B.S." />
                  <Field label="Field" value={education.field ?? ""} onChange={(value) => set({ education: data.education.map((item, i) => (i === index ? { ...item, field: value } : item)) })} placeholder="Economics" />
                  <Field label="Location" value={education.location ?? ""} onChange={(value) => set({ education: data.education.map((item, i) => (i === index ? { ...item, location: value } : item)) })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Start" value={education.startDate ?? ""} onChange={(value) => set({ education: data.education.map((item, i) => (i === index ? { ...item, startDate: value } : item)) })} />
                    <Field label="End" value={education.endDate ?? ""} onChange={(value) => set({ education: data.education.map((item, i) => (i === index ? { ...item, endDate: value } : item)) })} placeholder="2020" />
                  </div>
                </div>
                <TextAreaField
                  label="Details"
                  className="mt-2"
                  value={education.details ?? ""}
                  onChange={(value) => set({ education: data.education.map((item, i) => (i === index ? { ...item, details: value } : item)) })}
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}
      </EditorCard>

      <EditorCard
        title="Skills"
        description="Group skills by the way you actually used them. The keyword matcher reads this section directly."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => set({ skills: [...data.skills, { id: uid(), name: "Skills", skills: [] }] })}
          >
            <Plus /> Add group
          </Button>
        }
      >
        {!data.skills.length ? (
          <EmptySection text="No skills yet. Add only tools and methods you can discuss." />
        ) : (
          <div className="space-y-3">
            {data.skills.map((group, index) => (
              <div key={group.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[150px_1fr_auto] sm:items-end">
                <Field
                  label="Group name"
                  value={group.name}
                  onChange={(value) => set({ skills: data.skills.map((item, i) => (i === index ? { ...item, name: value } : item)) })}
                  placeholder="Analysis"
                />
                <CommaListField
                  label="Skills"
                  value={group.skills}
                  onChange={(next) => set({ skills: data.skills.map((item, i) => (i === index ? { ...item, skills: next } : item)) })}
                  placeholder="SQL, Python, Excel"
                  hint="Separate with commas. Keep the exact names used in job posts."
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="mb-1 text-muted-foreground hover:text-destructive"
                  onClick={() => set({ skills: data.skills.filter((item) => item.id !== group.id) })}
                  aria-label="Delete skill group"
                >
                  <Plus className="rotate-45" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </EditorCard>

      <EditorCard
        title="Certifications"
        description="Only list a credential you earned. Include the ID or link when you have one."
        action={
          <Button size="sm" variant="outline" onClick={addCertification}>
            <Plus /> Add certification
          </Button>
        }
      >
        {!data.certifications.length ? (
          <EmptySection text="No certifications yet." />
        ) : (
          <div className="space-y-3">
            {data.certifications.map((cert, index) => (
              <div key={cert.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Certification {index + 1}</span>
                  <MoveButtons
                    index={index}
                    length={data.certifications.length}
                    onMove={(from, to) => set({ certifications: moveItem(data.certifications, from, to) })}
                    onRemove={() => set({ certifications: data.certifications.filter((item) => item.id !== cert.id) })}
                  />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field label="Name" value={cert.name} onChange={(value) => set({ certifications: data.certifications.map((item, i) => (i === index ? { ...item, name: value } : item)) })} />
                  <Field label="Issuer" value={cert.issuer ?? ""} onChange={(value) => set({ certifications: data.certifications.map((item, i) => (i === index ? { ...item, issuer: value } : item)) })} />
                  <Field label="Issue date" value={cert.issueDate ?? ""} onChange={(value) => set({ certifications: data.certifications.map((item, i) => (i === index ? { ...item, issueDate: value } : item)) })} />
                  <Field label="Credential ID" value={cert.credentialId ?? ""} onChange={(value) => set({ certifications: data.certifications.map((item, i) => (i === index ? { ...item, credentialId: value } : item)) })} />
                </div>
                <Field label="Link" className="mt-2" value={cert.url ?? ""} onChange={(value) => set({ certifications: data.certifications.map((item, i) => (i === index ? { ...item, url: value } : item)) })} />
              </div>
            ))}
          </div>
        )}
      </EditorCard>

      <EditorCard
        title="Awards"
        description="Recognition that a recruiter can understand without context."
        action={
          <Button size="sm" variant="outline" onClick={addAward}>
            <Plus /> Add award
          </Button>
        }
      >
        {!data.awards.length ? (
          <EmptySection text="No awards yet." />
        ) : (
          <div className="space-y-3">
            {data.awards.map((award, index) => (
              <div key={award.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Award {index + 1}</span>
                  <MoveButtons
                    index={index}
                    length={data.awards.length}
                    onMove={(from, to) => set({ awards: moveItem(data.awards, from, to) })}
                    onRemove={() => set({ awards: data.awards.filter((item) => item.id !== award.id) })}
                  />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field label="Name" value={award.name} onChange={(value) => set({ awards: data.awards.map((item, i) => (i === index ? { ...item, name: value } : item)) })} />
                  <Field label="Issuer" value={award.issuer ?? ""} onChange={(value) => set({ awards: data.awards.map((item, i) => (i === index ? { ...item, issuer: value } : item)) })} />
                  <Field label="Date" value={award.date ?? ""} onChange={(value) => set({ awards: data.awards.map((item, i) => (i === index ? { ...item, date: value } : item)) })} />
                </div>
                <TextAreaField
                  label="Note"
                  className="mt-2"
                  value={award.description ?? ""}
                  onChange={(value) => set({ awards: data.awards.map((item, i) => (i === index ? { ...item, description: value } : item)) })}
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}
      </EditorCard>

      <EditorCard
        title="Additional sections"
        description="Certifications, languages, publications or anything else with a standard heading."
        action={
          <Button size="sm" variant="outline" onClick={addCustom}>
            <Plus /> Add section
          </Button>
        }
      >
        {!data.custom.length ? (
          <EmptySection text="No additional sections." />
        ) : (
          <div className="space-y-3">
            {data.custom.map((custom, index) => (
              <div key={custom.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Section {index + 1}</span>
                  <MoveButtons
                    index={index}
                    length={data.custom.length}
                    onMove={(from, to) => set({ custom: moveItem(data.custom, from, to) })}
                    onRemove={() => set({ custom: data.custom.filter((item) => item.id !== custom.id) })}
                  />
                </div>
                <Field
                  label="Heading"
                  className="mt-2"
                  value={custom.title}
                  onChange={(value) => set({ custom: data.custom.map((item, i) => (i === index ? { ...item, title: value } : item)) })}
                  placeholder="Languages"
                />
                <TextAreaField
                  label="Content"
                  className="mt-2"
                  value={custom.content}
                  onChange={(value) => set({ custom: data.custom.map((item, i) => (i === index ? { ...item, content: value } : item)) })}
                  rows={4}
                />
              </div>
            ))}
          </div>
        )}
      </EditorCard>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Standard headings help the parser. {sectionKeys.map((key) => sectionLabels[key]).join(", ")} are all recognized.
      </p>
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">{text}</p>;
}
