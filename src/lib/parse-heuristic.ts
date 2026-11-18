import {
  type Award,
  type Bullet,
  type Certification,
  type CustomSection,
  type Education,
  type Experience,
  type Project,
  type ResumeData,
  type SectionKey,
  type SkillGroup,
  resumeDataSchema,
  uid,
} from "@/lib/types";
import { extractEmails, extractPhones, extractUrls, parseResumeDate, titleCase } from "@/lib/text";

/* ------------------------------------------------------------------ */
/* Headings                                                            */
/* ------------------------------------------------------------------ */

const HEADINGS: { key: SectionKey | "ignore"; rx: RegExp }[] = [
  { key: "summary", rx: /^(?:professional )?(?:summary|profile|about(?: me)?|objective|career (?:summary|profile|objective)|executive summary)$/i },
  { key: "experience", rx: /^(?:work |professional |relevant |employment )?(?:experience|history|work history|employment(?: history)?|career history|professional background|employment background)$/i },
  { key: "education", rx: /^(?:education|academic background|academics|educational background|qualifications)$/i },
  { key: "skills", rx: /^(?:technical |core |key |professional )?(?:skills|competencies|core competencies|areas of expertise|expertise|technologies|tools(?: and technologies)?|tech stack|technical proficiencies)$/i },
  { key: "projects", rx: /^(?:(?:selected |personal |academic |key |side |notable )?projects|portfolio|selected work)$/i },
  { key: "certifications", rx: /^(?:licenses? (?:and|&) )?certifications?|^certificates?|^licenses?|^professional development|^credentials$/i },
  { key: "awards", rx: /^(?:honors?|honours?)(?: (?:and|&) awards?)?$|^awards?$|^achievements?$|^accomplishments?$/i },
  { key: "custom", rx: /^(?:publications?|volunteer(?: experience| work)?|extracurricular(?: activities)?|leadership(?: activities)?|activities|interests|hobbies|languages|coursework|relevant coursework|affiliations|memberships)$/i },
  { key: "ignore", rx: /^(?:references|available upon request|additional information)$/i },
];

const TITLE_WORDS =
  /\b(?:engineer|developer|manager|analyst|designer|scientist|consultant|specialist|director|intern|associate|architect|administrator|coordinator|assistant|officer|representative|technician|nurse|physician|accountant|recruiter|marketer|strategist|producer|editor|writer|researcher|professor|teacher|lawyer|attorney|paralegal|founder|owner|president|executive|supervisor|lead|head|chief|vp|vice president|product|project|program|operations|sales|customer success|account executive|partner|principal|fellow|apprentice|trainee|clerk|advisor|adviser|planner|buyer|controller|auditor|therapist|pharmacist|dentist|clinical|social worker)\b/i;

const DEGREE_WORDS =
  /\b(?:bachelor|master|mba|ph\.?d|doctorate|associate(?:'s)?|b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|m\.?eng|b\.?eng|b\.?tech|m\.?tech|llb|llm|md|dds|rn|bsn|msn|diploma|certificate|certification|foundation degree|high school diploma|ged)\b/i;

const COMPANY_WORDS = /\b(?:inc|llc|ltd|limited|corp|corporation|company|co\.|group|labs?|systems?|solutions?|technologies|technology|software|consulting|partners|agency|studio|bank|capital|health|hospital|university|college|institute|foundation|ventures|holdings|plc|gmbh|sa|ag)\b/i;

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE_ONE = `(?:${MONTH}\\.?\\s+\\d{4}|\\d{1,2}[/.]\\d{4}|\\d{4}[-/]\\d{1,2}|\\d{4})`;
const DATE_RANGE_RX = new RegExp(`(${DATE_ONE})\\s*(?:-|–|—|to|until)\\s*(${DATE_ONE}|present|current|now)`, "i");
const SINGLE_DATE_RX = new RegExp(`\\(?(${DATE_ONE})\\)?`, "i");

const BULLET_MARKER = /^(?:[-–—•*·▪◦‣●○■□►➤✓✔]|\d{1,2}[.)])\s*/;
const SECTION_HEADING_MAX = 46;

function cleanLine(line: string): string {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function stripBullet(line: string): { text: string; wasBullet: boolean } {
  const wasBullet = BULLET_MARKER.test(line);
  return { text: line.replace(BULLET_MARKER, "").trim(), wasBullet };
}

function detectHeading(line: string): { key: SectionKey | "ignore"; heading: string } | null {
  if (!line || line.length > SECTION_HEADING_MAX) return null;
  if (BULLET_MARKER.test(line)) return null;
  const cleaned = line.replace(/[:|]+$/g, "").trim();
  if (!cleaned || /[.!?]$/.test(cleaned)) return null;
  if (cleaned.split(/\s+/).length > 5) return null;
  for (const { key, rx } of HEADINGS) {
    if (rx.test(cleaned)) return { key, heading: cleaned };
  }
  // Unknown all-caps short headings become a custom section.
  if (/^[A-Z][A-Z\s&/]{2,40}$/.test(cleaned) && !TITLE_WORDS.test(cleaned) && cleaned.split(/\s+/).length <= 4) {
    return { key: "custom", heading: titleCase(cleaned) };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function canonicalResumeDate(raw: string): string {
  if (!raw || /present|current|now/i.test(raw)) return "Present";
  const parsed = parseResumeDate(raw);
  if (!parsed) return raw.trim();
  if (parsed.format === "YYYY") return String(parsed.year);
  return `${MONTH_SHORT[parsed.month - 1]} ${parsed.year}`;
}

function extractRange(line: string): { start: string; end: string; current: boolean; matched: string } | null {
  const m = line.match(DATE_RANGE_RX);
  if (!m) return null;
  return {
    start: canonicalResumeDate(m[1]),
    end: /present|current|now/i.test(m[2]) ? "" : canonicalResumeDate(m[2]),
    current: /present|current|now/i.test(m[2]),
    matched: m[0],
  };
}

function extractSingleDate(line: string): string | null {
  const m = line.match(SINGLE_DATE_RX);
  return m ? canonicalResumeDate(m[1]) : null;
}

/* ------------------------------------------------------------------ */
/* Experience                                                          */
/* ------------------------------------------------------------------ */

interface RawEntry {
  header: string[];
  bullets: { text: string; quote: string }[];
  start: string;
  end: string;
  current: boolean;
  rangeFound: boolean;
}

function newEntry(): RawEntry {
  return { header: [], bullets: [], start: "", end: "", current: false, rangeFound: false };
}

function isContinuation(previous: string, line: string): boolean {
  if (!previous) return false;
  if (/^[a-z(]/.test(line)) return true;
  if (!/[.!?;:]$/.test(previous) && previous.split(/\s+/).length > 3) return true;
  return false;
}

function splitHeaderParts(line: string): string[] {
  return line
    .split(/\s*(?:\||•|·|;|\u2022)\s*|\s+@\s+|\s+(?:at|@)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

function isLocation(text: string): boolean {
  return /^(?:[A-Z][A-Za-z .'-]+,\s*(?:[A-Z]{2}|[A-Z][A-Za-z .'-]+)(?:,\s*[A-Za-z .'-]+)?|remote|hybrid|united states|usa|uk|london|new york|san francisco|berlin|paris|toronto|sydney|singapore|dubai|bengaluru|bangalore|mumbai|delhi|pune|hyderabad)$/i.test(text.trim());
}

function parseRoleHeader(lines: string[]): { title: string; company: string; location: string } {
  const cleaned = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!cleaned.length) return { title: "", company: "", location: "" };
  let parts = splitHeaderParts(cleaned[0]);
  if (parts.length === 1 && cleaned.length > 1) parts = [...parts, ...splitHeaderParts(cleaned[1])];
  parts = parts.filter((p) => !/^\(?remote\)?$/i.test(p));

  if (parts.length >= 2) {
    let [a, b, ...rest] = parts;
    if (isLocation(a) && !isLocation(b)) {
      const loc = a;
      [a, b] = [b, rest.shift() ?? ""];
      return { title: a, company: b, location: loc };
    }
    let location = "";
    if (rest.length && isLocation(rest[rest.length - 1])) location = rest.pop() as string;
    if (isLocation(b)) return { title: a, company: rest.find((r) => !isLocation(r)) ?? "", location: b };
    if (TITLE_WORDS.test(a)) return { title: a, company: b, location };
    if (TITLE_WORDS.test(b)) return { title: b, company: a, location };
    return { title: a, company: b, location };
  }

  const line = parts[0] ?? cleaned[0];
  const at = line.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (at) return { title: at[1].trim(), company: at[2].trim(), location: "" };
  const comma = line.match(/^([^,]+),\s+(.+)$/);
  if (comma && TITLE_WORDS.test(comma[1])) return { title: comma[1].trim(), company: comma[2].trim(), location: "" };
  if (TITLE_WORDS.test(line) || COMPANY_WORDS.test(line)) {
    if (cleaned.length > 1) {
      const second = cleaned[1];
      if (TITLE_WORDS.test(line) && !isLocation(line)) return { title: line, company: second, location: "" };
      if (COMPANY_WORDS.test(line)) return { title: second, company: line, location: "" };
    }
    return { title: line, company: "", location: "" };
  }
  if (cleaned.length > 1) {
    return { title: cleaned[0], company: cleaned[1], location: "" };
  }
  return { title: line, company: "", location: "" };
}

function pushBullet(entry: RawEntry, text: string, quote: string) {
  const clean = text.replace(/^[-–—•*·▪◦‣●○■□►➤✓✔]\s*/, "").replace(/\s+/g, " ").trim();
  if (!clean) return;
  const last = entry.bullets[entry.bullets.length - 1];
  if (last && isContinuation(last.text, clean) && clean.split(/\s+/).length < 14) {
    last.text = `${last.text} ${clean}`.replace(/\s+/g, " ");
    last.quote = `${last.quote} ${quote}`;
  } else if (last && last.text.split(/\s+/).length < 4) {
    last.text = `${last.text} ${clean}`.replace(/\s+/g, " ");
    last.quote = `${last.quote} ${quote}`;
  } else {
    entry.bullets.push({ text: clean, quote });
  }
}

function flushExperience(entries: Experience[], raw: RawEntry) {
  if (!raw.header.length && !raw.bullets.length) return;
  const headerText = raw.header.join(" ");
  if (!headerText && !raw.bullets.length) return;
  const { title, company, location } = parseRoleHeader(raw.header);
  if (!title && !company && raw.bullets.length === 0) return;
  if (/^(experience|work experience|professional experience|employment)$/i.test(title) && !company) return;
  if (!title && company) {
    // Company-only entries are preserved as titles in a separate field, but a title is required for display.
    return;
  }
  entries.push({
    id: uid(),
    company: company || "",
    title: title || "",
    location,
    startDate: raw.start,
    endDate: raw.current ? "Present" : raw.end,
    current: raw.current,
    bullets: raw.bullets.slice(0, 12).map<Bullet>((b) => ({
      id: uid(),
      text: b.text,
      source: { type: "user_text", ref: "uploaded resume", quote: b.quote },
      verified: true,
      metricPlaceholder: false,
      keywords: [],
    })),
    source: "uploaded resume",
  });
}

function parseExperience(lines: string[]): Experience[] {
  const entries: Experience[] = [];
  let current: RawEntry | null = null;

  const flush = () => {
    if (current) flushExperience(entries, current);
    current = null;
  };

  for (const rawLine of lines) {
    const { text: rawStripped, wasBullet } = stripBullet(rawLine);
    const line = rawStripped.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (/^(?:page \d+(?: of \d+)?|\d+)$/i.test(line)) continue;

    const range = extractRange(line);
    const withoutRange = range ? line.replace(range.matched, " ").replace(/\s{2,}/g, " ").trim() : line;

    if (range) {
      if (current && !current.rangeFound && (current.header.length || current.bullets.length)) {
        current.start = range.start;
        current.end = range.end;
        current.current = range.current;
        current.rangeFound = true;
        if (withoutRange && !TITLE_WORDS.test(withoutRange) === false) {
          // Keep the header if the date line also has role text.
          current.header.push(withoutRange);
        } else if (withoutRange && current.header.length === 0) {
          current.header.push(withoutRange);
        }
      } else {
        flush();
        current = newEntry();
        current.start = range.start;
        current.end = range.end;
        current.current = range.current;
        current.rangeFound = true;
        if (withoutRange) current.header.push(withoutRange);
      }
      continue;
    }

    if (!current) current = newEntry();

    if (wasBullet) {
      pushBullet(current, line, rawLine);
      continue;
    }

    const looksRole = (TITLE_WORDS.test(line) || COMPANY_WORDS.test(line)) && line.length < 120;
    const startsNew = current.rangeFound || current.bullets.length > 0;
    if (looksRole && startsNew && line.split(/\s+/).length <= 14) {
      flush();
      current = newEntry();
      current.header.push(line);
      continue;
    }

    if (!current.header.length && current.bullets.length === 0) {
      current.header.push(line);
      continue;
    }

    if (current.bullets.length && isContinuation(current.bullets[current.bullets.length - 1].text, line) && line.split(/\s+/).length < 16) {
      pushBullet(current, line, rawLine);
      continue;
    }

    if (!current.rangeFound && current.header.length < 3 && line.length < 90 && !/[.!?]$/.test(line)) {
      current.header.push(line);
      continue;
    }

    if (line.split(/\s+/).length >= 5) {
      pushBullet(current, line, rawLine);
    } else if (!current.header.length) {
      current.header.push(line);
    } else {
      pushBullet(current, line, rawLine);
    }
  }
  flush();

  // Fallback: an experience section that is one long paragraph. Split into sentences.
  if (!entries.length) {
    const joined = lines.join(" ").replace(/\s+/g, " ").trim();
    if (joined.length > 40) {
      const date = extractRange(joined);
      const sentences = joined.split(/(?<=[.!?])\s+/).filter((s) => s.split(/\s+/).length >= 5);
      entries.push({
        id: uid(),
        title: "",
        company: "",
        location: "",
        startDate: date?.start ?? "",
        endDate: date?.current ? "Present" : date?.end ?? "",
        current: date?.current ?? false,
        bullets: sentences.slice(0, 8).map((s) => ({
          id: uid(),
          text: s.trim(),
          source: { type: "user_text" as const, ref: "uploaded resume", quote: s.trim() },
          verified: true,
          metricPlaceholder: false,
          keywords: [],
        })),
        source: "uploaded resume",
      });
    }
  }

  return entries.filter((e) => e.title || e.company);
}

/* ------------------------------------------------------------------ */
/* Education                                                           */
/* ------------------------------------------------------------------ */

function parseEducation(lines: string[]): Education[] {
  const entries: Education[] = [];
  let buffer: string[] = [];
  let start = "";
  let end = "";

  const flush = () => {
    if (!buffer.length) {
      start = "";
      end = "";
      return;
    }
    const text = buffer.join(" | ");
    const parts = buffer.flatMap((l) => l.split(/\s*(?:\||•|·|;)\s*/)).map((p) => p.trim()).filter(Boolean);
    let degree = "";
    let institution = "";
    let location = "";
    let details = "";
    const remaining: string[] = [];
    for (const part of parts) {
      if (DEGREE_WORDS.test(part) && !degree) {
        degree = part;
      } else if (/(?:university|college|institute|school|academy|polytechnic|conservatory)/i.test(part) && !institution) {
        institution = part;
      } else if (isLocation(part) && !location) {
        location = part;
      } else {
        remaining.push(part);
      }
    }
    if (!degree && parts.length) degree = parts[0];
    if (!institution && parts.length > 1) institution = parts[1];
    if (!institution && buffer.length > 1) institution = buffer[1];
    details = remaining.filter((r) => r !== degree && r !== institution && !isLocation(r)).join("; ");
    if (!institution && !degree) {
      buffer = [];
      start = "";
      end = "";
      return;
    }
    entries.push({
      id: uid(),
      institution,
      degree,
      field: "",
      location,
      startDate: start,
      endDate: end || start,
      details: details || "",
      source: "uploaded resume",
    });
    buffer = [];
    start = "";
    end = "";
  };

  for (const rawLine of lines) {
    const { text: rawStripped, wasBullet } = stripBullet(rawLine);
    const line = rawStripped.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const range = extractRange(line);
    const single = extractSingleDate(line);
    const degree = DEGREE_WORDS.test(line);
    const institution = /(?:university|college|institute|school|academy|polytechnic|conservatory)/i.test(line);

    if ((degree || institution) && buffer.length && (buffer.some((b) => DEGREE_WORDS.test(b) || /(?:university|college|institute|school)/i.test(b)) || start)) {
      flush();
    } else if (range && buffer.length) {
      // Date belongs to the current entry when it already has a degree line.
      flush();
    }

    if (range) {
      start = range.start;
      end = range.current ? "Present" : range.end;
      const without = line.replace(range.matched, "").trim();
      if (without) buffer.push(without);
      continue;
    }
    if (single && !degree && !institution && buffer.length) {
      end = single;
      const without = line.replace(single, "").replace(/[(),]/g, " ").trim();
      if (without) buffer.push(without);
      continue;
    }
    if (wasBullet && buffer.length) {
      buffer.push(line);
      continue;
    }
    buffer.push(line);
  }
  flush();
  return entries;
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

function parseProjects(lines: string[]): Project[] {
  const entries: Project[] = [];
  let current: RawEntry & { title: string; url: string } | null = null;

  const flush = () => {
    if (!current) return;
    const urlFromHeader = current.header.join(" ").match(/(?:https?:\/\/|www\.)[^\s)]+/i)?.[0] ?? "";
    const url = current.url || urlFromHeader;
    const name = (current.header[0] ?? "")
      .replace(/(?:https?:\/\/|www\.)[^\s)]+/gi, "")
      .replace(/\s*(?:\||•|·)\s*$/, "")
      .replace(/\s+[-–—]\s*$/, "")
      .replace(/\([^)]*\)/g, "")
      .trim();
    if (!name) {
      current = null;
      return;
    }
    const headerParts = splitHeaderParts(current.header[0] ?? "");
    const role = headerParts.length > 1 && !/^https?:|www\./i.test(headerParts[1]) ? headerParts[1] : "";
    const descriptionLines = current.header.slice(1).filter((l) => !/^https?:|www\./i.test(l));
    entries.push({
      id: uid(),
      name,
      role,
      description: descriptionLines.join(" ").slice(0, 400),
      url,
      startDate: current.start,
      endDate: current.current ? "Present" : current.end,
      bullets: current.bullets.map((b) => ({
        id: uid(),
        text: b.text,
        source: { type: "user_text" as const, ref: "uploaded resume", quote: b.quote },
        verified: true,
        metricPlaceholder: false,
        keywords: [],
      })),
      source: "uploaded resume",
      planned: false,
    });
    current = null;
  };

  for (const rawLine of lines) {
    const { text: rawStripped, wasBullet } = stripBullet(rawLine);
    const line = rawStripped.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const range = extractRange(line) ?? null;
    const without = range ? line.replace(range.matched, "").trim() : line;
    const url = line.match(/(?:https?:\/\/|www\.)[^\s)]+/i)?.[0] ?? "";
    const looksName = !wasBullet && without.length < 100 && !/[.!?]$/.test(without) && (without.split(/\s+/).length <= 10 || TITLE_WORDS.test(without));

    if (looksName && current && (current.bullets.length > 0 || current.header.length > 1)) {
      flush();
    }
    if (!current) current = { ...newEntry(), title: "", url: "" };
    if (looksName && (!current.header.length || current.bullets.length)) {
      current.header.unshift(without);
    } else if (looksName && current.header.length === 1 && !current.bullets.length) {
      current.header.push(without);
    } else if (wasBullet || line.split(/\s+/).length >= 5) {
      pushBullet(current, without, rawLine);
    } else if (!current.header.length) {
      current.header.push(without);
    } else {
      pushBullet(current, without, rawLine);
    }
    if (range) {
      current.start = range.start;
      current.end = range.current ? "Present" : range.end;
      current.current = range.current;
    }
    if (url && !current.url) current.url = url;
  }
  flush();
  return entries;
}

/* ------------------------------------------------------------------ */
/* Skills, certifications, awards                                      */
/* ------------------------------------------------------------------ */

function parseSkills(lines: string[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  const addGroup = (name: string, rawSkills: string[]) => {
    const skills = rawSkills
      .map((s) =>
        s
          .replace(/^[-–—•*·▪◦‣●○■□►➤✓✔]\s*/, "")
          .replace(/\s*\((?:expert|advanced|intermediate|beginner|proficient)\)\s*/gi, "")
          .replace(/\s*[-–—:]\s*(?:expert|advanced|intermediate|beginner|proficient)\s*$/gi, "")
          .trim(),
      )
      .filter((s) => s.length > 0 && s.length <= 60 && !/^(?:expert|advanced|intermediate|beginner|proficient)$/i.test(s));
    if (!skills.length) return;
    const existing = groups.find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      for (const skill of skills) if (!existing.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) existing.skills.push(skill);
    } else {
      groups.push({ id: uid(), name, skills });
    }
  };

  for (const rawLine of lines) {
    const { text: rawStripped } = stripBullet(rawLine);
    const line = rawStripped.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (/^[▁▂▃▄▅▆▇█▉▊▋▌▍▎▏■□●○◆◇★☆]+/.test(line)) continue;
    const colon = line.match(/^([A-Za-z][A-Za-z0-9 /&+#.-]{1,40}):\s*(.+)$/);
    if (colon) {
      addGroup(colon[1].trim(), colon[2].split(/\s*[,;|/]\s*|\s{2,}/));
      continue;
    }
    const skills = line.split(/\s*[,;|•·]\s*|\s{2,}/);
    if (skills.length === 1 && line.split(/\s+/).length > 6) {
      addGroup("Skills", line.split(/\s+/).filter((w) => w.length > 2 && /^[A-Za-z0-9+#./-]+$/.test(w)));
    } else {
      addGroup("Skills", skills);
    }
  }
  return groups.slice(0, 6);
}

function parseCertifications(lines: string[]): Certification[] {
  const out: Certification[] = [];
  for (const rawLine of lines) {
    const { text: rawStripped } = stripBullet(rawLine);
    const line = rawStripped.replace(/\s+/g, " ").trim();
    if (!line || line.length > 160) continue;
    const range = extractRange(line);
    const date = range?.end || extractSingleDate(line) || "";
    const withoutDate = line
      .replace(DATE_RANGE_RX, "")
      .replace(SINGLE_DATE_RX, "")
      .replace(/[()]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const parts = withoutDate.split(/\s+(?:\||-|–|—|,)\s+/).map((p) => p.trim()).filter(Boolean);
    out.push({
      id: uid(),
      name: parts[0] ?? withoutDate,
      issuer: parts[1] ?? "",
      issueDate: date,
      credentialId: "",
      url: extractUrls(line)[0] ?? "",
      source: "uploaded resume",
    });
  }
  return out;
}

function parseAwards(lines: string[]): Award[] {
  const out: Award[] = [];
  for (const rawLine of lines) {
    const { text: rawStripped } = stripBullet(rawLine);
    const line = rawStripped.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const date = extractSingleDate(line) ?? "";
    const withoutDate = line.replace(SINGLE_DATE_RX, "").replace(/[()]/g, " ").replace(/\s{2,}/g, " ").trim();
    const parts = withoutDate.split(/\s+(?:\||-|–|—)\s+/).map((p) => p.trim()).filter(Boolean);
    out.push({
      id: uid(),
      name: parts[0] ?? withoutDate,
      issuer: parts[1] ?? "",
      date,
      description: parts.slice(2).join(" "),
      source: "uploaded resume",
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Header / contact                                                    */
/* ------------------------------------------------------------------ */

function parseHeader(headerLines: string[], allText: string, fileName?: string): { contact: ResumeData["contact"]; summary: string } {
  const lines = headerLines.map(cleanLine).filter(Boolean);
  const joined = lines.join("\n");
  const email = extractEmails(joined)[0] ?? extractEmails(allText)[0] ?? "";
  const phone = extractPhones(joined)[0] ?? extractPhones(allText)[0] ?? "";
  const urls = extractUrls(`${joined}\n${allText}`);
  const linkedin = urls.find((u) => /linkedin\.com/i.test(u)) ?? "";
  const github = urls.find((u) => /github\.com/i.test(u)) ?? "";
  const website = urls.find((u) => !/linkedin\.com|github\.com/i.test(u)) ?? "";

  const nameCandidates = lines.filter(
    (l) =>
      l.length <= 60 &&
      l.split(/\s+/).length >= 2 &&
      l.split(/\s+/).length <= 5 &&
      !/@|https?:|www\.|\d{3}/i.test(l) &&
      !detectHeading(l) &&
      !TITLE_WORDS.test(l) &&
      !/[,|•·]/.test(l),
  );
  let fullName = nameCandidates[0] ?? "";

  if (!fullName && lines.length) {
    const first = lines[0].split(/\s*[|•]\s*/)[0];
    if (first.length <= 50 && first.split(/\s+/).length >= 2 && !TITLE_WORDS.test(first) && !/@|https?:|\d/.test(first)) fullName = first;
  }
  if (!fullName && fileName) {
    const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\b(resume|cv|final|updated|copy)\b/gi, "").replace(/\s+/g, " ").trim();
    if (base && base.split(/\s+/).length <= 4) fullName = titleCase(base);
  }

  let location = "";
  for (const line of lines) {
    for (const part of line.split(/\s*[|•·]\s*/)) {
      if (isLocation(part) && part !== fullName) {
        location = part;
        break;
      }
    }
    if (location) break;
  }
  if (!location) {
    const loc = joined.match(/\b([A-Z][A-Za-z .'-]+,\s*(?:[A-Z]{2}|[A-Z][A-Za-z .'-]+))\b/);
    if (loc) location = loc[1];
  }

  const used = new Set([fullName, email, phone, linkedin, github, website, location].filter(Boolean));
  let headline = "";
  for (const line of lines) {
    if (used.has(line)) continue;
    if (/@|https?:|www\.|\d{3}/i.test(line)) continue;
    const parts = line.split(/\s*[|•·]\s*/).filter(Boolean);
    const role = parts.find((p) => TITLE_WORDS.test(p));
    if (role) {
      headline = role.trim();
      break;
    }
    if (line.length < 70 && line.split(/\s+/).length <= 8 && !detectHeading(line)) headline = line;
  }
  if (headline === fullName) headline = "";

  const summaryLines = lines.filter((l) => l !== fullName && l !== headline && !used.has(l) && !/@|https?:|www\.|^\+?\d[\d\s().-]{6,}$/.test(l) && l.split(/\s+/).length > 8);
  const summary = summaryLines.join(" ").replace(/\s+/g, " ").trim();

  return {
    contact: {
      fullName,
      headline,
      email,
      phone,
      location,
      website,
      linkedin,
      github,
    },
    summary,
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const STANDARD_ORDER: SectionKey[] = ["summary", "experience", "projects", "education", "skills", "certifications", "awards", "custom"];

export interface HeuristicParseResult {
  data: ResumeData;
  detectedHeadings: string[];
  sectionOrder: SectionKey[];
}

export function parseResumeHeuristic(rawText: string, fileName?: string): HeuristicParseResult {
  const lines = rawText
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00ad]/g, "")
    .split("\n")
    .map(cleanLine)
    .filter((l) => !/^(?:page \d+(?: of \d+)?|\d+\s*\|\s*page)$/i.test(l));

  const sections = new Map<SectionKey, string[]>();
  const customTitles = new Map<string, string[]>();
  const headerLines: string[] = [];
  const detectedHeadings: string[] = [];
  const order: SectionKey[] = [];
  let current: SectionKey | null = null;
  let customTitle = "";

  for (const line of lines) {
    if (!line) continue;
    const heading = detectHeading(line);
    if (heading) {
      if (heading.key === "ignore") {
        current = null;
        continue;
      }
      current = heading.key;
      detectedHeadings.push(heading.heading);
      if (!order.includes(heading.key)) order.push(heading.key);
      if (!sections.has(heading.key)) sections.set(heading.key, []);
      if (heading.key === "custom") {
        customTitle = heading.heading;
        if (!customTitles.has(customTitle)) customTitles.set(customTitle, []);
      }
      continue;
    }
    if (!current) {
      headerLines.push(line);
      continue;
    }
    if (current === "custom") {
      const arr = customTitles.get(customTitle) ?? [];
      arr.push(line);
      customTitles.set(customTitle, arr);
    } else {
      const arr = sections.get(current) ?? [];
      arr.push(line);
      sections.set(current, arr);
    }
  }

  const header = parseHeader(headerLines, rawText, fileName);
  const summaryText = (sections.get("summary") ?? []).join(" ").replace(/\s+/g, " ").trim() || header.summary;
  const experience = parseExperience(sections.get("experience") ?? []);
  const education = parseEducation(sections.get("education") ?? []);
  const projects = parseProjects(sections.get("projects") ?? []);
  const skills = parseSkills(sections.get("skills") ?? []);
  const certifications = parseCertifications(sections.get("certifications") ?? []);
  const awards = parseAwards(sections.get("awards") ?? []);
  const custom: CustomSection[] = [...customTitles.entries()]
    .map(([title, contentLines]) => ({
      id: uid(),
      title,
      content: contentLines.join("\n").trim(),
    }))
    .filter((c) => c.content.length > 0);

  const present: SectionKey[] = [];
  if (summaryText) present.push("summary");
  if (experience.length) present.push("experience");
  if (projects.length) present.push("projects");
  if (education.length) present.push("education");
  if (skills.length) present.push("skills");
  if (certifications.length) present.push("certifications");
  if (awards.length) present.push("awards");
  if (custom.length) present.push("custom");

  const sectionOrder = [
    ...order.filter((k) => present.includes(k)),
    ...present.filter((k) => !order.includes(k)),
  ];
  for (const key of STANDARD_ORDER) if (present.includes(key) && !sectionOrder.includes(key)) sectionOrder.push(key);

  const data: ResumeData = {
    contact: {
      ...header.contact,
      headline: header.contact.headline || experience[0]?.title || "",
    },
    summary: summaryText,
    summarySource: { type: "user_text", ref: fileName ? `uploaded file: ${fileName}` : "uploaded resume", quote: summaryText },
    experience,
    education,
    skills,
    projects,
    certifications,
    awards,
    custom,
    sectionOrder: sectionOrder.length ? sectionOrder : ["summary", "experience", "projects", "education", "skills"],
  };

  return {
    data: resumeDataSchema.parse(data),
    detectedHeadings,
    sectionOrder,
  };
}
