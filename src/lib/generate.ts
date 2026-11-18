import type {
  BulletRewriteResult,
  CoverLetterResult,
  ExtractedJd,
  InterviewPrepResult,
  InterviewQuestion,
  LinkedInResult,
  ResumeData,
  SkillGroup,
} from "@/lib/types";
import {
  ACTION_VERBS,
  BUZZWORDS,
  CLICHES,
  STRONG_VERB_SUGGESTIONS,
  WEAK_OPENERS,
  countWords,
  findBannedLanguage,
  firstVerb,
  hasQuantifiedImpact,
  normalize,
  sanitizeProse,
  truncate,
  upperFirst,
  writingRuleViolations,
} from "@/lib/text";
import { analyzeResume } from "@/lib/scoring";
import { presentKeywords, matchKeyword } from "@/lib/keywords";
import { factCheckProse } from "@/lib/fact-check";
import { resumeToPlainText } from "@/lib/types";

function uniqueVerbs(): string[] {
  return ACTION_VERBS.filter((v) => !WEAK_OPENERS.includes(v)).slice(0, 60);
}

const VERB_SYNONYMS: Record<string, string[]> = {
  led: ["Directed", "Managed", "Guided"],
  built: ["Created", "Developed", "Shipped"],
  launched: ["Shipped", "Released", "Delivered"],
  designed: ["Created", "Architected", "Shaped"],
  developed: ["Built", "Created", "Engineered"],
  created: ["Built", "Developed", "Produced"],
  delivered: ["Shipped", "Completed", "Delivered"],
  implemented: ["Launched", "Built", "Rolled out"],
  improved: ["Raised", "Strengthened", "Enhanced"],
  reduced: ["Cut", "Lowered", "Trimmed"],
  increased: ["Grew", "Raised", "Expanded"],
  automated: ["Streamlined", "Scripted", "Automated"],
  migrated: ["Moved", "Transitioned", "Rebuilt"],
  scaled: ["Grew", "Expanded", "Scaled"],
  streamlined: ["Simplified", "Tightened", "Streamlined"],
  negotiated: ["Secured", "Brokered", "Negotiated"],
  managed: ["Owned", "Directed", "Ran"],
  owned: ["Led", "Managed", "Drove"],
  drove: ["Led", "Pushed", "Drove"],
  grew: ["Expanded", "Increased", "Grew"],
  cut: ["Reduced", "Lowered", "Cut"],
  saved: ["Recovered", "Reduced", "Saved"],
  generated: ["Produced", "Created", "Generated"],
  won: ["Secured", "Won", "Earned"],
  shipped: ["Delivered", "Launched", "Shipped"],
  architected: ["Designed", "Designed and built", "Architected"],
  optimized: ["Improved", "Tuned", "Optimized"],
  refactored: ["Reworked", "Restructured", "Refactored"],
  trained: ["Coached", "Onboarded", "Trained"],
  mentored: ["Coached", "Guided", "Mentored"],
  coordinated: ["Orchestrated", "Ran", "Coordinated"],
  analyzed: ["Examined", "Modeled", "Analyzed"],
  partnered: ["Collaborated with", "Worked with", "Partnered with"],
  established: ["Set up", "Launched", "Established"],
  standardised: ["Standardized", "Unified", "Standardized"],
};

function replaceOpener(text: string, verb: string): string {
  const words = text.trim().split(/\s+/);
  if (!words.length) return text;
  const lowerFirstWord = normalize(words[0]);
  const weak = WEAK_OPENERS.find((w) => normalize(text).startsWith(w));
  if (weak) {
    let rest = text.slice(weak.length).trim();
    rest = rest.charAt(0).toLowerCase() + rest.slice(1);
    return `${upperFirst(verb)} ${rest}`;
  }
  if (ACTION_VERBS.includes(lowerFirstWord) || firstVerb(text)) {
    return `${upperFirst(verb)} ${words.slice(1).join(" ")}`.trim();
  }
  return `${upperFirst(verb)} ${text.charAt(0).toLowerCase() + text.slice(1)}`.trim();
}

function cleanBullet(text: string): string {
  let out = sanitizeProse(text).replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  for (const phrase of [...BUZZWORDS, ...CLICHES]) {
    if (out.toLowerCase().startsWith(phrase)) {
      const replacement = STRONG_VERB_SUGGESTIONS[phrase] ?? "Owned";
      out = `${replacement} ${out.slice(phrase.length).trim()}`;
    }
  }
  return upperFirst(out);
}

export function generateBulletVariations(input: {
  bullet: string;
  role: string;
  company: string;
  current: boolean;
  jdKeywords?: string[];
  userAnswer?: string;
  askMetric?: boolean;
  sources: string[];
}): BulletRewriteResult {
  const original = input.userAnswer?.trim() ? `${input.bullet} ${input.userAnswer.trim()}` : input.bullet;
  const source = cleanBullet(original);
  const first = firstVerb(source) || "owned";
  const synonyms = VERB_SYNONYMS[first] ?? uniqueVerbs().filter((v) => normalize(v) !== normalize(first)).slice(0, 3);
  const baseVerb = source.split(/\s+/)[0] ?? "Owned";
  const rest = source.slice(baseVerb.length).trim();

  const variants = [
    { text: source, formula: hasQuantifiedImpact(source) ? ("XYZ" as const) : ("action-result" as const) },
    { text: replaceOpener(source, synonyms[0] ?? "Owned"), formula: hasQuantifiedImpact(source) ? ("STAR" as const) : ("scope-action-result" as const) },
    { text: replaceOpener(source, synonyms[1] ?? synonyms[0] ?? "Managed"), formula: hasQuantifiedImpact(source) ? ("action-result" as const) : ("XYZ" as const) },
  ];

  const needsMetric = !hasQuantifiedImpact(source) || input.askMetric === true;
  const variations = variants.map((v, i) => {
    let text = cleanBullet(v.text);
    if (needsMetric && i === 0 && !hasQuantifiedImpact(source)) {
      text = `${text.replace(/\.$/, "")} [add metric]`;
    }
    return {
      text,
      formula: v.formula,
      source: input.userAnswer ? `Source: ${truncate(input.bullet, 80)}. User answer: ${truncate(input.userAnswer, 200)}` : `Source: ${truncate(input.bullet, 200)}`,
      needsMetric: needsMetric && !hasQuantifiedImpact(text),
    };
  });

  const questions: string[] = [];
  if (needsMetric) questions.push("What changed because of this work? Give a real number if one exists: time saved, percentage, users, dollars, volume or team size.");
  if (/\b(?:several|many|various|numerous|a lot of|some)\b/i.test(source)) questions.push("Replace the vague quantity with the real count. How many people, accounts, projects or hours?");
  if (!/\b(?:at|for|with|using|by|through)\b/i.test(source)) questions.push("What tool, process or method did you use to do this?");
  if (input.jdKeywords?.length) questions.push(`Does this work honestly involve any of these job terms: ${input.jdKeywords.slice(0, 5).join(", ")}? If yes, which one and how?`);
  if (input.current && /(?:ed|ied)$/.test(normalize(source).split(/\s+/)[0] ?? "")) questions.push("This is your current role. Is the work ongoing? If yes, rewrite in present tense.");

  const factCheck = factCheckProse({
    text: variations.map((v) => v.text).join("\n"),
    sources: [...input.sources, source, ...(input.userAnswer ? [input.userAnswer] : [])],
    label: "Bullet variations",
  });

  return {
    variations: variations.filter((v) => !writingRuleViolations(v.text).length).slice(0, 3),
    followUpQuestions: [...new Set(questions)].slice(0, 5),
    factCheck,
    generatedBy: "rules",
  };
}

export function generateSummariesRules(resume: ResumeData, jd?: ExtractedJd | null): { summaries: { text: string; angle: string }[]; skillsGroups: SkillGroup[] } {
  const text = resumeToPlainText(resume);
  const analysis = analyzeResume({ resume, jd: jd ?? null });
  const primary = resume.experience[0];
  const years = Math.floor(analysis.meta.experienceYears);
  const matched = jd ? presentKeywords(jd, text).filter((k) => !/communication|leadership|collaboration|teamwork/i.test(k)).slice(0, 4) : [];
  const skills = matched.length ? matched : resume.skills.flatMap((g) => g.skills).slice(0, 4);
  const quantified = resume.experience.flatMap((e) => e.bullets).find((b) => hasQuantifiedImpact(b.text) && countWords(b.text) <= 28)?.text;
  const target = jd ? (jd.company ? `${jd.role} at ${jd.company}` : jd.role) : primary?.title || "your target role";

  const roleLine = primary
    ? `${primary.title}${years >= 1 ? ` with ${years} ${years === 1 ? "year" : "years"} of experience` : ""}${skills.length ? ` across ${listSentence(skills.slice(0, 3))}` : ""}.`
    : resume.education[0]
      ? `${resume.education[0].degree || "Graduate"}${resume.education[0].field ? ` in ${resume.education[0].field}` : ""}${skills.length ? ` with project work in ${listSentence(skills.slice(0, 3))}` : ""}.`
      : "";

  const summaries = [
    {
      text: sanitizeProse([roleLine, quantified ? `${upperFirst(sanitizeProse(quantified).replace(/\.$/, ""))}.` : "", `Targeting ${target}.`].filter(Boolean).join(" ")),
      angle: "role-fit",
    },
    {
      text: sanitizeProse([quantified ? `${upperFirst(sanitizeProse(quantified).replace(/\.$/, ""))}.` : "", roleLine, `Targeting ${target}.`].filter(Boolean).join(" ")),
      angle: "impact-led",
    },
    {
      text: sanitizeProse([roleLine, skills.length ? `Strongest tools: ${listSentence(skills.slice(0, 3))}.` : "", `Targeting ${target}.`].filter(Boolean).join(" ")),
      angle: resume.experience.length ? "role-fit" : "fresher",
    },
  ].filter((s) => countWords(s.text) >= 12);

  const groupMap = new Map<string, Set<string>>();
  for (const group of resume.skills) {
    const key = group.name || "Skills";
    const set = groupMap.get(key) ?? new Set<string>();
    for (const skill of group.skills) set.add(skill);
    groupMap.set(key, set);
  }
  const skillsGroups = [...groupMap.entries()].map(([name, set]) => ({
    id: resume.skills.find((g) => g.name === name)?.id ?? `group_${normalize(name).replace(/\W+/g, "_")}`,
    name,
    skills: [...set].sort((a, b) => {
      const ra = jd ? jd.keywords.findIndex((k) => normalize(k.keyword) === normalize(a)) : 999;
      const rb = jd ? jd.keywords.findIndex((k) => normalize(k.keyword) === normalize(b)) : 999;
      return (ra < 0 ? 999 : ra) - (rb < 0 ? 999 : rb);
    }),
  }));

  return { summaries: summaries.slice(0, 3), skillsGroups };
}

function listSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function generateCoverLetterRules(resume: ResumeData, jd: ExtractedJd, hiringManager?: string): CoverLetterResult {
  const analysis = analyzeResume({ resume, jd });
  const text = resumeToPlainText(resume);
  const matched = presentKeywords(jd, text);
  const requirements = [...jd.requiredSkills, ...jd.responsibilities].filter((r) => matched.some((m) => normalize(r).includes(normalize(m)) || normalize(m).includes(normalize(r))));
  const bullets = resume.experience.flatMap((e) => e.bullets.map((b) => ({ bullet: b.text, role: e.title, company: e.company }))).filter((b) => countWords(b.bullet) <= 32);
  const quantified = bullets.filter((b) => hasQuantifiedImpact(b.bullet));
  const first = quantified[0] ?? bullets[0];
  const second = quantified[1] ?? bullets.find((b) => b !== first) ?? bullets[0];
  const name = resume.contact.fullName || "Candidate";
  const role = jd.role || "the advertised role";
  const company = jd.company || "your team";

  const paragraphs: string[] = [];
  paragraphs.push(
    `I am applying for the ${role} role at ${company}. ${analysis.meta.experienceYears >= 1 ? `My work over the past ${Math.floor(analysis.meta.experienceYears)} years has focused on ${listSentence(matched.filter((m) => !/communication|leadership/i.test(m)).slice(0, 3)) || "building and improving products"}.` : `I am early in my career and have built my evidence through projects in ${listSentence(matched.slice(0, 3)) || "the areas named in the posting"}.`}`,
  );

  if (first) {
    paragraphs.push(
      `In my ${first.role || "recent"} role at ${first.company || "my current company"}, ${lowerFirst(first.bullet.replace(/\.$/, ""))}. That work maps directly to ${requirements[0] ? `the requirement for ${lowerFirst(requirements[0])}` : "the core responsibilities in the posting"}.`,
    );
  }
  if (second && second !== first) {
    paragraphs.push(
      `I also ${lowerFirst(second.bullet.replace(/\.$/, ""))}. ${requirements[1] ? `This is the kind of ${lowerFirst(requirements[1])} work the role describes.` : "The result was measurable and repeatable."}`,
    );
  }
  paragraphs.push(
    `What draws me to ${company} is the ${jd.companyValues[0] ?? "clear ownership"} focus in the posting. I would welcome a conversation about where the team needs the most help and how my experience with ${listSentence(matched.slice(0, 3)) || "the work described"} could contribute.`,
  );
  paragraphs.push(`Thank you for your time and consideration.\n\n${name}`);

  const greeting = hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Manager,";
  const content = `${greeting}\n\n${paragraphs.join("\n\n")}`;
  const factCheck = factCheckProse({
    text: content,
    sources: [resumeToPlainText(resume), ...bullets.map((b) => b.bullet), ...(jd.company ? [jd.company] : []), ...(jd.role ? [jd.role] : [])],
    allowedEntities: [jd.company, jd.role, name].filter(Boolean),
    label: "Cover letter",
  });
  return {
    role,
    company,
    greeting,
    content,
    wordCount: countWords(content),
    factCheck,
    generatedBy: "rules",
  };
}

export function generateCoverLetterFromParts(
  resume: ResumeData,
  jd: ExtractedJd,
  parts: { greeting: string; content: string },
): CoverLetterResult {
  const content = `${parts.greeting}\n\n${parts.content}`;
  const factCheck = factCheckProse({
    text: content,
    sources: [resumeToPlainText(resume), ...(jd.company ? [jd.company] : []), ...(jd.role ? [jd.role] : [])],
    allowedEntities: [jd.company, jd.role, resume.contact.fullName].filter(Boolean),
    label: "Cover letter",
  });
  return {
    role: jd.role,
    company: jd.company,
    greeting: parts.greeting,
    content,
    wordCount: countWords(content),
    factCheck,
    generatedBy: "llm",
  };
}

function lowerFirst(input: string): string {
  if (!input) return input;
  return input[0].toLowerCase() + input.slice(1);
}

export function generateInterviewRules(resume: ResumeData, jd: ExtractedJd, missingSkills: string[] = []): InterviewPrepResult {
  const analysis = analyzeResume({ resume, jd });
  const bullets = resume.experience.flatMap((e) => e.bullets.map((b) => ({ text: b.text, role: e.title, company: e.company })));
  const questions: InterviewQuestion[] = [];

  const topRequirements = jd.requiredSkills.slice(0, 3);
  for (const req of topRequirements) {
    const related = bullets.find((b) => matchKeyword(req, b.text, "hard", "must").matchType !== "missing");
    questions.push({
      question: `How would you approach ${req} in the first 90 days of this role?`,
      category: "role",
      why: `${req} is a stated requirement, so the interviewer will test depth, not just vocabulary.`,
      framework: "Context, approach, proof, measure. State the situation, your method, the closest real example and how you would measure success.",
      talkingPoints: related
        ? [`Closest real example: ${truncate(related.text, 150)}`, `Role context: ${related.role} at ${related.company}`, "Name the first metric you would inspect and the first risk you would de-risk."]
        : [`You have not shown ${req} yet. Be direct about the gap and describe how you would close it in the first 30 days.`, "Offer a specific learning plan and a real adjacent skill.", "Do not claim experience you do not have."],
    });
  }

  for (const bullet of bullets.filter((b) => hasQuantifiedImpact(b.text)).slice(0, 2)) {
    questions.push({
      question: `Your resume says "${truncate(bullet.text, 120)}". Walk me through how you did that and what you would change.`,
      category: "resume",
      why: "Interviewers probe specific metrics to confirm ownership and depth.",
      framework: "STAR, with a short reflection at the end.",
      talkingPoints: [`Situation: the role, scale and constraint behind the result.`, `Action: the two decisions you personally made.`, `Result: the real metric and how it was measured.`, `Reflection: one thing you would do differently now.`],
    });
  }

  if (resume.experience.length > 1) {
    const gapOrTenure = analysis.issues.find((i) => i.category === "timeline");
    questions.push({
      question: gapOrTenure ? `Can you walk me through the timeline around ${gapOrTenure.location}?` : "What led you to move from your previous role to your current one?",
      category: "resume",
      why: "Recruiters ask about transitions and gaps to understand context, not to trap you.",
      framework: "Facts, reason, learning, forward link.",
      talkingPoints: ["State the factual timeline without apology.", "Give the real reason and what you optimized for.", "Connect the decision to the work you want next."],
    });
  }

  for (const value of jd.companyValues.slice(0, 2)) {
    const evidence = bullets.find((b) => normalize(b.text).includes(normalize(value))) ?? bullets[0];
    questions.push({
      question: `Tell me about a time you showed ${value}.`,
      category: "behavioural",
      why: `${value} appears in the job description, so the team will test it with a behavioural question.`,
      framework: "STAR",
      talkingPoints: evidence ? [`Use: ${truncate(evidence.text, 150)}`, "Keep the situation to two sentences.", "State the result and what you learned."] : ["Pick a real example from a project or course.", "Be specific about your action, not the team's.", "End with a measurable or observable result."],
    });
  }

  if (jd.company) {
    questions.push({
      question: `What do you understand about ${jd.company}'s work, and why this role now?`,
      category: "company",
      why: "The interviewer wants evidence that you read beyond the job title.",
      framework: "Three-part: what the company does, where this role fits, why your evidence matches.",
      talkingPoints: [`Reference the actual product or mission described in the posting.`, `Connect one real achievement from your resume to a stated company priority.`, `Ask one specific question about the team's next six months.`],
    });
  }

  const gap = missingSkills[0] ?? jd.requiredSkills.find((s) => !bullets.some((b) => matchKeyword(s, b.text, "hard", "must").matchType !== "missing"));
  if (gap) {
    questions.push({
      question: `This role requires ${gap}. You have not shown it on your resume. How would you handle that?`,
      category: "gap",
      why: "A direct gap question is likely. Honesty plus a concrete plan is stronger than bluffing.",
      framework: "Acknowledge, adjacent proof, plan, checkpoint.",
      talkingPoints: [`Acknowledge the gap in one sentence.`, `Name the closest real skill and how it transfers.`, `Describe a specific 30 day learning plan and a project you would ship.`, `Ask what good looks like in the first quarter.`],
    });
  }

  if (!questions.length) {
    questions.push({
      question: "Walk me through the experience on your resume that best matches this role.",
      category: "resume",
      why: "The resume does not show enough role-specific evidence, so the interview will start broad.",
      framework: "Present, evidence, relevance.",
      talkingPoints: ["Choose the role with the closest scope.", "Give one concrete result.", "Connect it to the job's first priority."],
    });
  }

  return { questions: questions.slice(0, 10), generatedBy: "rules" };
}

export function generateLinkedInRules(resume: ResumeData, jd: ExtractedJd): LinkedInResult {
  const analysis = analyzeResume({ resume, jd });
  const topSkills = presentKeywords(jd, resumeToPlainText(resume)).slice(0, 3);
  const primary = resume.experience[0];
  const headline = [primary?.title, topSkills.join(" | "), jd.company ? `Targeting ${jd.role}` : jd.role].filter(Boolean).join(" | ").slice(0, 200);
  const bullets = resume.experience.flatMap((e) => e.bullets).filter((b) => hasQuantifiedImpact(b.text)).slice(0, 2);
  const about = [
    primary
      ? `${primary.title} focused on ${topSkills.length ? topSkills.join(", ") : "building useful products"}.`
      : `Early-career professional focused on ${topSkills.length ? topSkills.join(", ") : "the work described in the posting"}.`,
    bullets.length ? bullets.map((b) => sanitizeProse(b.text)).join(" ") : "",
    `Looking for ${jd.role} work where ${jd.requiredSkills.slice(0, 2).join(" and ")} matter every day.`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1800);

  const skills = [...new Set(resume.skills.flatMap((g) => g.skills))];
  const factCheck = factCheckProse({
    text: `${headline}\n${about}\n${skills.join(", ")}`,
    sources: [resumeToPlainText(resume), jd.company, jd.role],
    allowedEntities: [jd.company, jd.role, resume.contact.fullName].filter(Boolean),
    label: "LinkedIn profile",
  });

  return {
    headline,
    about,
    skills: skills.slice(0, 20),
    featuredSuggestions: resume.projects.slice(0, 3).map((p) => `Feature "${p.name}"${p.url ? ` with ${p.url}` : " once it has a public link"}`),
    factCheck,
    generatedBy: "rules",
  };
}

export function generateLinkedInFromParts(
  resume: ResumeData,
  jd: ExtractedJd,
  parts: { headline: string; about: string; skills: string[]; featured?: string[] },
): LinkedInResult {
  const factCheck = factCheckProse({
    text: `${parts.headline}\n${parts.about}\n${parts.skills.join(", ")}`,
    sources: [resumeToPlainText(resume), jd.company, jd.role],
    allowedEntities: [jd.company, jd.role, resume.contact.fullName].filter(Boolean),
    label: "LinkedIn profile",
  });
  return {
    headline: parts.headline,
    about: parts.about,
    skills: parts.skills,
    featuredSuggestions: parts.featured ?? [],
    factCheck,
    generatedBy: "llm",
  };
}
