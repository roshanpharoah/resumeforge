import type { DesignTokens, ResumeData, SectionKey } from "@/lib/types";
import { sectionLabels } from "@/lib/types";

const FONT_STACKS: Record<string, string> = {
  Inter: '"Inter", system-ui, sans-serif',
  "Source Sans 3": '"Source Sans 3", "Segoe UI", sans-serif',
  Georgia: "Georgia, 'Times New Roman', serif",
  Garamond: "Garamond, 'Times New Roman', serif",
  "Times New Roman": "'Times New Roman', serif",
  Arial: "Arial, Helvetica, sans-serif",
  Calibri: "Calibri, 'Segoe UI', sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  Cambria: "Cambria, Georgia, serif",
  Lato: "Lato, 'Segoe UI', sans-serif",
};

function stack(font: string): string {
  return FONT_STACKS[font] ?? `"${font}", Arial, sans-serif`;
}

function heading(text: string, tokens: DesignTokens, size = 1.03) {
  const transform = tokens.headingCase === "upper" ? "uppercase" : tokens.headingCase === "title" ? "none" : "none";
  return (
    <div
      style={{
        color: tokens.accent,
        fontFamily: stack(tokens.fontHeading),
        fontSize: `${size}em`,
        fontWeight: 700,
        letterSpacing: transform === "uppercase" ? "0.09em" : "0.01em",
        textTransform: transform as "uppercase" | "none",
        borderBottom: tokens.showRule ? `1px solid ${tokens.accent}33` : "none",
        paddingBottom: tokens.showRule ? "0.22em" : 0,
        marginBottom: "0.5em",
        lineHeight: 1.2,
      }}
    >
      {text}
    </div>
  );
}

function groupSkills(skills: ResumeData["skills"]): string {
  return skills.map((g) => `${g.name}: ${g.skills.join(", ")}`).join("  |  ");
}

export function ResumePreview({
  data,
  design,
  className,
  watermark,
}: {
  data: ResumeData;
  design: DesignTokens;
  className?: string;
  watermark?: string;
}) {
  const base = (design.baseSize * 1.333) / 816;
  const cqw = (px: number) => `${(px / 816) * 100}cqw`;
  const sectionStyle: React.CSSProperties = {
    marginTop: `${design.sectionGap / 10}em`,
  };
  const bodyTextStyle: React.CSSProperties = {
    fontFamily: stack(design.fontBody),
    fontSize: `${base * 100}cqw`,
    lineHeight: design.lineHeight,
    color: design.textColor,
  };
  const contactLine = [data.contact.email, data.contact.phone, data.contact.location, data.contact.linkedin, data.contact.website, data.contact.github]
    .filter(Boolean)
    .join("  |  ");

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case "summary":
        if (!data.summary) return null;
        return (
          <section key={key} style={sectionStyle}>
            {heading("Summary", design)}
            <p style={{ margin: 0 }}>{data.summary}</p>
          </section>
        );
      case "experience":
        if (!data.experience.length) return null;
        return (
          <section key={key} style={sectionStyle}>
            {heading("Experience", design)}
            <div style={{ display: "grid", gap: "0.7em" }}>
              {data.experience.map((exp) => (
                <div key={exp.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1em", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontWeight: 650 }}>{exp.title || "Title"}</span>
                      {exp.company && <span style={{ color: design.textColor }}>, {exp.company}</span>}
                      {exp.location && <span style={{ opacity: 0.75 }}> · {exp.location}</span>}
                    </div>
                    <span style={{ whiteSpace: "nowrap", fontSize: "0.92em", opacity: 0.78 }}>
                      {exp.startDate}
                      {exp.startDate && (exp.endDate || exp.current) ? " to " : ""}
                      {exp.current ? "Present" : exp.endDate}
                    </span>
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul style={{ margin: "0.32em 0 0", paddingLeft: "1.22em", display: "grid", gap: "0.22em" }}>
                      {exp.bullets.map((b) => (
                        <li key={b.id} style={{ paddingLeft: "0.18em" }}>
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      case "projects":
        if (!data.projects.length) return null;
        return (
          <section key={key} style={sectionStyle}>
            {heading("Projects", design)}
            <div style={{ display: "grid", gap: "0.62em" }}>
              {data.projects.map((p) => (
                <div key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1em", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontWeight: 650 }}>{p.name}</span>
                      {p.role && <span style={{ opacity: 0.8 }}> · {p.role}</span>}
                      {p.url && <span style={{ opacity: 0.7 }}> · {p.url.replace(/^https?:\/\//, "")}</span>}
                    </div>
                    {(p.startDate || p.endDate) && (
                      <span style={{ whiteSpace: "nowrap", fontSize: "0.92em", opacity: 0.78 }}>
                        {p.startDate}
                        {p.startDate && p.endDate ? " to " : ""}
                        {p.endDate}
                      </span>
                    )}
                  </div>
                  {p.description && <p style={{ margin: "0.15em 0 0" }}>{p.description}</p>}
                  {p.bullets.length > 0 && (
                    <ul style={{ margin: "0.3em 0 0", paddingLeft: "1.22em", display: "grid", gap: "0.2em" }}>
                      {p.bullets.map((b) => (
                        <li key={b.id}>{b.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      case "education":
        if (!data.education.length) return null;
        return (
          <section key={key} style={sectionStyle}>
            {heading("Education", design)}
            <div style={{ display: "grid", gap: "0.45em" }}>
              {data.education.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: "1em", alignItems: "baseline" }}>
                  <div>
                    <span style={{ fontWeight: 650 }}>{[e.degree, e.field].filter(Boolean).join(", ") || e.institution}</span>
                    {e.degree && e.institution && <span> · {e.institution}</span>}
                    {e.details && <div style={{ opacity: 0.85, fontSize: "0.94em" }}>{e.details}</div>}
                  </div>
                  <span style={{ whiteSpace: "nowrap", fontSize: "0.92em", opacity: 0.78 }}>
                    {e.startDate}
                    {e.startDate && e.endDate ? " to " : ""}
                    {e.endDate}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      case "skills":
        if (!data.skills.length) return null;
        return (
          <section key={key} style={sectionStyle}>
            {heading("Skills", design)}
            <div style={{ display: "grid", gap: "0.24em" }}>
              {data.skills.map((g) => (
                <p key={g.id} style={{ margin: 0 }}>
                  <span style={{ fontWeight: 650 }}>{g.name}:</span> {g.skills.join(", ")}
                </p>
              ))}
            </div>
          </section>
        );
      case "certifications":
        if (!data.certifications.length) return null;
        return (
          <section key={key} style={sectionStyle}>
            {heading("Certifications", design)}
            <div style={{ display: "grid", gap: "0.22em" }}>
              {data.certifications.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: "1em" }}>
                  <span>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    {c.issuer && ` · ${c.issuer}`}
                  </span>
                  <span style={{ whiteSpace: "nowrap", opacity: 0.78, fontSize: "0.92em" }}>{c.issueDate}</span>
                </div>
              ))}
            </div>
          </section>
        );
      case "awards":
        if (!data.awards.length) return null;
        return (
          <section key={key} style={sectionStyle}>
            {heading("Awards", design)}
            <div style={{ display: "grid", gap: "0.22em" }}>
              {data.awards.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: "1em" }}>
                  <span>
                    <span style={{ fontWeight: 600 }}>{a.name}</span>
                    {a.issuer && ` · ${a.issuer}`}
                    {a.description && <span style={{ opacity: 0.85 }}> · {a.description}</span>}
                  </span>
                  <span style={{ whiteSpace: "nowrap", opacity: 0.78, fontSize: "0.92em" }}>{a.date}</span>
                </div>
              ))}
            </div>
          </section>
        );
      case "custom":
        if (!data.custom.length) return null;
        return (
          <>
            {data.custom.map((c) => (
              <section key={c.id} style={sectionStyle}>
                {heading(c.title || sectionLabels.custom, design)}
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.content}</p>
              </section>
            ))}
          </>
        );
      default:
        return null;
    }
  };

  const sidebarKeys: SectionKey[] = ["skills", "education", "certifications", "awards", "custom"];

  return (
    <div
      className={className}
      style={{
        width: "100%",
        aspectRatio: "8.5 / 11",
        containerType: "inline-size",
        background: "#ffffff",
        color: design.textColor,
        padding: `calc(${(design.margin / 816) * 100}cqw)`,
        boxSizing: "border-box",
        fontFamily: stack(design.fontBody),
        fontSize: `${base * 100}cqw`,
        lineHeight: design.lineHeight,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {watermark && (
        <div style={{ position: "absolute", right: "3%", top: "2%", fontSize: "0.8em", color: "#6b7280", letterSpacing: "0.08em" }}>
          {watermark}
        </div>
      )}
      <header style={{ textAlign: design.templateId === "designer-bold" ? "left" : "left", marginBottom: "0.15em" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: stack(design.fontHeading),
            fontSize: design.templateId === "designer-bold" ? "2.1em" : "1.75em",
            lineHeight: 1.08,
            color: design.accent,
            letterSpacing: design.templateId === "designer-bold" ? "-0.02em" : "0.01em",
            fontWeight: 700,
          }}
        >
          {data.contact.fullName || "Your Name"}
        </h1>
        {data.contact.headline && <div style={{ fontSize: "1.05em", marginTop: "0.15em", fontWeight: 500 }}>{data.contact.headline}</div>}
        {contactLine && (
          <div style={{ marginTop: "0.35em", fontSize: "0.9em", color: "#4b5563", wordBreak: "break-word" }}>{contactLine}</div>
        )}
      </header>

      {design.columns === 2 ? (
        <div style={{ display: "grid", gridTemplateColumns: "0.36fr 0.64fr", gap: "1.6em", marginTop: "1em" }}>
          <aside style={{ borderRight: `1px solid ${design.accent}22`, paddingRight: "1em", display: "flex", flexDirection: "column" }}>
            {sidebarKeys.map((key) => renderSection(key))}
          </aside>
          <main style={{ display: "flex", flexDirection: "column" }}>
            {data.sectionOrder.filter((k) => !sidebarKeys.includes(k)).map((key) => renderSection(key))}
          </main>
        </div>
      ) : (
        <div>{data.sectionOrder.map((key) => renderSection(key))}</div>
      )}
      {!data.experience.length && !data.education.length && !data.summary && (
        <div style={{ marginTop: "2em", border: "1px dashed #d1d5db", borderRadius: "0.4em", padding: "1em", color: "#6b7280", fontSize: "0.95em" }}>
          Your resume content will appear here. Upload a file or add your first role.
        </div>
      )}
    </div>
  );
}

export function ResumeMiniPreview({ data, design }: { data: ResumeData; design: DesignTokens }) {
  const skills = groupSkills(data.skills);
  return (
    <div
      className="h-full w-full overflow-hidden bg-white p-4 text-ink-900"
      style={{ fontFamily: stack(design.fontBody), containerType: "inline-size" }}
    >
      <div className="mb-2 border-b pb-1.5" style={{ borderColor: `${design.accent}22` }}>
        <div className="text-[13px] font-bold leading-tight" style={{ color: design.accent }}>
          {data.contact.fullName || "Your Name"}
        </div>
        <div className="mt-0.5 truncate text-[7px] text-gray-500">{data.contact.headline || data.contact.email || "Add your details"}</div>
      </div>
      <div className="space-y-1.5">
        {data.summary && (
          <div>
            <div className="mb-0.5 text-[6px] font-bold uppercase tracking-wider" style={{ color: design.accent }}>
              Summary
            </div>
            <div className="line-clamp-3 text-[6px] leading-[1.5] text-gray-600">{data.summary}</div>
          </div>
        )}
        {data.experience.slice(0, 3).map((exp) => (
          <div key={exp.id}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="truncate text-[7px] font-semibold">{exp.title}</div>
              <div className="shrink-0 text-[5.5px] text-gray-400">{exp.endDate || (exp.current ? "Present" : "")}</div>
            </div>
            <div className="truncate text-[6px] text-gray-500">{exp.company}</div>
            {exp.bullets.slice(0, 2).map((b) => (
              <div key={b.id} className="mt-0.5 line-clamp-1 pl-2 text-[5.7px] leading-[1.45] text-gray-600">
                {b.text}
              </div>
            ))}
          </div>
        ))}
        {skills && (
          <div>
            <div className="mb-0.5 text-[6px] font-bold uppercase tracking-wider" style={{ color: design.accent }}>
              Skills
            </div>
            <div className="line-clamp-2 text-[5.8px] text-gray-600">{skills}</div>
          </div>
        )}
        {!data.experience.length && !data.summary && <div className="text-[6px] text-gray-400">No content yet</div>}
      </div>
    </div>
  );
}
