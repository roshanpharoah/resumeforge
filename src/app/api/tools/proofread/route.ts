import { apiHandler, json, requireApiUser } from "@/lib/api";
import { proofreadSchema } from "@/lib/requests";
import {
  detectGrammarIssues,
  findBannedLanguage,
  findMisspellings,
  sanitizeProse,
  writingRuleViolations,
} from "@/lib/text";

export const runtime = "nodejs";

interface ProofIssue {
  severity: "critical" | "warning" | "info";
  category: "spelling" | "grammar" | "style" | "punctuation";
  title: string;
  detail: string;
  quote: string;
  suggestion: string;
}

export const POST = apiHandler(async (request: Request) => {
  await requireApiUser();
  const body = proofreadSchema.parse(await request.json());
  const text = body.text;
  const issues: ProofIssue[] = [];

  for (const misspelling of findMisspellings(text)) {
    issues.push({
      severity: "warning",
      category: "spelling",
      title: "Possible misspelling",
      detail: `Check "${misspelling.word}". ATS keyword matching can miss a misspelled skill.`,
      quote: misspelling.word,
      suggestion: misspelling.suggestion ?? `Correct "${misspelling.word}" or confirm the spelling.`,
    });
  }

  for (const grammar of detectGrammarIssues(text)) {
    issues.push({
      severity: "warning",
      category: "grammar",
      title: "Grammar check",
      detail: grammar.message,
      quote: grammar.quote,
      suggestion: "Rewrite the sentence so the subject and verb agree, then reread it aloud.",
    });
  }

  for (const violation of writingRuleViolations(text)) {
    issues.push({
      severity: "info",
      category: "style",
      title: "Writing rule",
      detail: violation,
      quote: violation,
      suggestion: "Replace the phrase with a plain verb and a specific detail.",
    });
  }

  for (const banned of findBannedLanguage(text)) {
    issues.push({
      severity: "warning",
      category: "style",
      title: "Cliché or banned phrase",
      detail: `"${banned.phrase}" adds no information and weakens the line.`,
      quote: banned.phrase,
      suggestion: "Say what you did and what changed.",
    });
  }

  if (text.includes("--")) {
    issues.push({
      severity: "info",
      category: "punctuation",
      title: "Double hyphen",
      detail: "Double hyphens read as decorative punctuation and can break date ranges in some parsers.",
      quote: "--",
      suggestion: "Use a single comma, colon or the word to.",
    });
  }
  if (/[\u2014\u2013]/.test(text)) {
    issues.push({
      severity: "info",
      category: "punctuation",
      title: "Long dash",
      detail: "Long dashes are not part of the house style and can confuse some date parsers.",
      quote: /[\u2014\u2013]/.exec(text)?.[0] ?? "",
      suggestion: "Use a comma, a colon or the word to.",
    });
  }
  if (/\s{2,}/.test(text.replace(/\n/g, ""))) {
    issues.push({
      severity: "info",
      category: "punctuation",
      title: "Extra spacing",
      detail: "Runs of spaces can create odd gaps when a parser flattens the page.",
      quote: "  ",
      suggestion: "Use one space between words.",
    });
  }

  const seen = new Set<string>();
  const unique = issues.filter((issue) => {
    const key = `${issue.category}|${issue.quote}|${issue.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return json({
    issues: unique.slice(0, 40),
    counts: {
      blocking: 0,
      warnings: unique.filter((i) => i.severity === "warning").length,
      info: unique.filter((i) => i.severity === "info").length,
    },
    cleaned: sanitizeProse(text),
  });
});
