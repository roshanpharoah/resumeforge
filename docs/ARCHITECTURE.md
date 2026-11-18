# ResumeForge architecture

## Purpose

ResumeForge is a resume workspace with two non negotiable rules:

1. The score must be deterministic and explainable.
2. No claim may enter a final file unless it traces to user input or an explicit confirmation.

AI is an optional drafting layer. It never owns the score, the fact check decision or the export gate.

## System shape

```
Browser
  Next.js App Router pages
  Client views fetch typed JSON from /api
        |
        v
Route handlers
  Zod request validation
  Session check
  Ownership check
  Engine or AI call
  Prisma write
        |
        +--> PostgreSQL through Prisma
        +--> Local disk or S3 for uploads
        +--> OpenAI compatible endpoint when configured
        +--> SMTP for sign in codes
```

Pages under `/dashboard`, `/resumes`, `/jobs`, `/tools` and `/settings` are server wrappers around an authenticated shell. The shell verifies the session cookie with `jose`, then renders a client view. Client views fetch data from the API so a missing database produces an actionable message instead of a server render failure. The public share page at `/r/[token]` reads the database on the server and does not require a session.

## Main modules

| Module | Responsibility |
| --- | --- |
| `src/app/api/*` | HTTP boundary. Parses requests, authenticates, checks ownership, returns DTOs. |
| `src/lib/scoring.ts` | Eight dimension deterministic analysis. Produces score, issues and fixes. |
| `src/lib/keywords.ts` | JD extraction, taxonomy, keyword matching, role vocabulary. |
| `src/lib/fact-check.ts` | Claim tracing, metric checks, identity checks, placeholders, writing rules. |
| `src/lib/tailor.ts` | Safe reordering, summary and bullet changes with per change diffs. |
| `src/lib/gaps.ts` | Four option gap analysis and planned project plans. |
| `src/lib/generate.ts` | Rules based bullet, summary, letter and profile generators. |
| `src/lib/ai.ts` | Optional LLM calls, schema validation and merge with fallbacks. |
| `src/lib/parse-file.ts` | PDF, DOCX and TXT extraction and parse risk detection. |
| `src/lib/export.ts` | PDF through Puppeteer, DOCX through `docx`, TXT. |
| `src/lib/auth.ts` | Email code, Google OAuth, signed session cookie. |
| `src/lib/server-data.ts` | Ownership queries, serializers and version creation. |
| `src/prompts/*` | Prompt text plus Zod schemas for structured output. |

## Scoring

The deterministic scorer is the only source of the score. It returns eight dimensions:

| Dimension | Weight | What it checks |
| --- | --- | --- |
| Keywords | 30 | Must have and nice to have coverage against the JD, with semantic matches discounted. The dimension is removed when no JD is supplied. |
| Sections | 15 | Standard resume sections, ordering and evidence in each section. |
| Format | 14 | Single column, fonts, margins, length, parse risks, tables and images. |
| Contact | 8 | Email, phone, location and professional links. |
| Bullets | 15 | Action verbs, tense, length, numbers, repetition and one idea per line. |
| Readability | 7 | Word count, sentence length, grade level, banned language and filler. |
| Spelling | 3 | Common misspellings and suspicious tokens. |
| Timeline | 8 | Date format, chronology, current roles and unexplained gaps. |

When a dimension does not apply, its maximum is zero and it is excluded from the normalization. The overall score is `sum(score) / sum(max) * 100`, rounded and clamped to 0 through 100. Adding a JD therefore adds the keyword dimension rather than silently awarding 30 free points.

Issues are sorted by severity. A safe fix carries a typed patch:

- `replace_text` can apply a value.
- `fill_placeholder` asks the user for a real value.
- `add_section` adds a missing section.
- `set_heading` renames a heading.
- `open_tool` sends the user to the right surface, such as the editor or proofreader.

## Fact check pipeline

The checker runs on direct data, saved versions, exports, share creation and public downloads.

1. Build a corpus from the source text, the base resume, bullet source quotes, saved user answers and explicit answers. Every export, share and version path calls `collectUserProvidedAnswers` so editor edits and accepted suggestions are not lost.
2. Collect claims from the summary, experience bullets, project bullets, education details and custom sections.
3. Reject unresolved placeholders and blocks such as `TODO` or `[X]`.
4. Reject planned projects that were placed on the resume.
5. Compare every metric with the corpus, normalizing percent, currency, word numbers and units.
6. Check proper nouns and hard skills against the corpus and the skill alias table.
7. When a base resume is supplied, compare employer, title, start date, end date, current flag, institution and degree.
8. Check that every skill appears in the source or the base resume.
9. Add non blocking warnings when wording does not closely trace to the source.
10. Add writing rule warnings for banned phrases, long dashes and decorative punctuation.

A blocking finding stops export and share creation with HTTP 422. The payload includes the fact check so the UI can show the exact claim and a confirmation action. A confirmation is recorded against a fingerprint built from location, claim and reason. On a later check the same finding becomes confirmed and no longer blocks.

Unresolved placeholders and planned projects that were placed on the resume are not confirmable. They carry `confirmable: false`, ignore any supplied confirmation and must be fixed in the resume text. This keeps a confirmation from turning a blank marker or unfinished project into shippable content.

## Tailoring

Tailoring is a review workflow, not a silent rewrite:

1. Resolve the job, either from a saved application or pasted text.
2. Analyzer output and gap seeds establish which requirements are already covered.
3. The tailor engine produces typed changes: summary, bullet rewrite, reorder, skills reorder, experience reorder or keyword insert.
4. Each change carries before text, after text, rationale, source and risk.
5. The client accepts or rejects changes individually.
6. Commit creates a `ResumeVersion` with the accepted changes and runs the fact check against the base resume.
7. Version level identity checks prevent a tailored copy from changing an employer, title, date or degree.

## AI layer

`LLM_API_KEY` is optional. When present, calls use an OpenAI compatible `/chat/completions` endpoint. Each prompt has a Zod schema and a JSON schema name. The client tries structured `json_schema` output first, then `json_object`, then validates with Zod. Failures fall back to the deterministic generator.

Generated content is subjected to the same fact check as user content. For bullets, summaries, cover letters and LinkedIn copy, blocking findings cause a fallback to rules output. The LLM never changes the ATS score.

## Data model

| Model | Purpose |
| --- | --- |
| `User` | Account identity, optional profile fields, relations to all owned data. |
| `AuthCode` | Hashed email sign in codes with expiry, attempt count and single use. |
| `OAuthAccount` | Google account link and tokens. OAuth tokens are excluded from exports. |
| `Resume` | Base resume, raw text, parsed JSON, design tokens, template, parse risks and original file key. |
| `ResumeVersion` | Immutable snapshot with data, design, source, optional job and match score. |
| `AnalysisReport` | Score, breakdown, issues, keyword analysis and metadata for a resume or version. |
| `Job` | Application record with raw JD, extracted requirements, status, salary range and notes. |
| `GapItem` | Missing skill, category, importance, four option plan, evidence and status. |
| `GapQuestion` | Follow up question and optional user answer for a gap. |
| `PlannedProject` | Plan for a gap, with stack, steps, status and public link. |
| `CoverLetter` | Saved letter for a job and optional resume version. |
| `InterviewPrep` | Generated questions for a job. |
| `ShareLink` | Public token, optional version, expiry and revocation timestamp. |

Ownership is checked through `userId` on every top level query and through parent records for nested routes.

## API surface

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/auth/request-code` | POST | Send or return a development sign in code. |
| `/api/auth/verify-code` | POST | Verify the code and set the session cookie. |
| `/api/auth/google` | GET | Start Google OAuth. |
| `/api/auth/google/callback` | GET | Finish Google OAuth. |
| `/api/auth/logout` | POST | Clear the session cookie. |
| `/api/me` | GET | Session user plus integration status. |
| `/api/me/export` | GET | Full account JSON export with secrets removed. |
| `/api/dashboard` | GET | Resumes, applications, latest analysis, fixes and score history. |
| `/api/parse` | POST | Parse an uploaded file and detect risks. |
| `/api/resumes` | GET, POST | List and create resumes. |
| `/api/resumes/[id]` | GET, PATCH, DELETE | Read, update or delete an owned resume. |
| `/api/resumes/[id]/file` | GET | Download the original upload. |
| `/api/resumes/[id]/analyze` | POST | Run analysis, save a report and persist gaps. |
| `/api/resumes/[id]/analysis` | GET | Read the latest report. |
| `/api/resumes/[id]/versions` | GET, POST | List versions and save a snapshot. |
| `/api/resumes/[id]/tailor` | POST | Produce a tailored diff. |
| `/api/resumes/[id]/tailor/commit` | POST | Save accepted changes as a version. |
| `/api/resumes/[id]/fact-check` | POST | Check data or a version, with confirmations. |
| `/api/resumes/[id]/export` | POST | Export PDF, DOCX or TXT with the final gate. |
| `/api/resumes/[id]/leaderboard` | POST | Score one resume against saved jobs. |
| `/api/resumes/[id]/share` | GET, POST | List active links and create a new one. |
| `/api/share/[token]/export` | GET | Public download with a fresh fact check. |
| `/api/jobs` | GET, POST | List applications and create one. |
| `/api/jobs/[id]` | GET, PATCH, DELETE | Read, update or delete an application. |
| `/api/jobs/[id]/gaps` | GET, POST | List gaps and generate them for a resume. |
| `/api/jobs/[id]/cover-letter` | POST | Generate and save a cover letter. |
| `/api/jobs/[id]/interview` | POST | Generate interview questions. |
| `/api/gaps/[id]` | PATCH | Update gap status or evidence. |
| `/api/gaps/[id]/answer` | POST | Record a user answer and optionally add a bullet. |
| `/api/gaps/[id]/reframe` | POST | Apply a reframe option. |
| `/api/gaps/[id]/plan` | POST | Create or update a planned project. |
| `/api/analyze/jd-url` | POST | Fetch and extract a job posting from a URL. |
| `/api/tools/bullet-rewrite` | POST | Generate three bullet variations. |
| `/api/tools/summary` | POST | Generate summaries and skill groups. |
| `/api/tools/proofread` | POST | Spelling, grammar, style and punctuation checks. |
| `/api/tools/linkedin` | POST | Headline, About, skills and featured ideas. |
| `/api/health` | GET | Database, AI, auth, email and storage status. |

## Security and failure behavior

- Sessions are signed JWTs in an HTTP only, same site cookie. Production requires `AUTH_SECRET`.
- Middleware protects app routes. Public API routes still verify the session themselves.
- Auth endpoints are rate limited in memory by IP and email.
- Uploaded original files are keyed by user id and served only through an ownership checked route.
- Share links are unguessable, expiring, read only and gated by the fact check.
- Public pages are marked `noindex`.
- When `DATABASE_URL` is missing, pages still render and show a configuration banner. Saves fail with a clear error.
- When AI, SMTP, Google or S3 are missing, the related feature degrades or reports a configuration error rather than failing the whole app.
- PDF rendering needs Chrome. The export route returns a 503 with setup guidance while DOCX and TXT remain available.

## Extension points

- Add a scoring dimension by updating `WEIGHTS`, the dimension function, and the sum assertion test.
- Add a template in `src/lib/types.ts`, then it appears in the editor automatically.
- Add a keyword role in `src/lib/keywords.ts` and it appears in the keyword library.
- Add an LLM feature by creating a prompt module with a Zod schema, calling `callLlm`, validating output and running the fact check before return.
- Add a new export format in `src/lib/export.ts`, then wire it into both export routes and the public share page.
