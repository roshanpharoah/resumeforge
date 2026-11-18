# ResumeForge

An ATS first resume workspace. Upload the resume you already have, see what a parser actually reads, score it across eight dimensions, tailor it to a real job description, close genuine skill gaps, and export a clean file that survives an applicant tracking system.

The core rule is simple: every claim must trace back to something you wrote. The app will ask for a missing number before it will place one.

## What it does

- **Parse and inspect.** Upload PDF, DOCX or TXT. See the extracted text, the sections found, fonts, page count and parse risks such as tables, columns, text boxes and headers.
- **Score honestly.** A deterministic 0 to 100 score across keywords, sections, format, contact details, bullets, readability, spelling and timeline. Each dimension explains its deductions and offers fixes where a safe fix exists.
- **Tailor with control.** Compare a base resume with a tailored copy, accept or reject each change, and save the result as a version. Reordering and rewriting are separate operations.
- **Bridge gaps four ways.** Mark a skill as something you may already have, reframe real experience, plan a project, or learn it. Planned projects stay out of the resume until they are done and have a public link.
- **Write better bullets.** Three variations per line, each with the formula used, follow up questions and a source check. No invented metrics.
- **Keep the design.** Eleven templates, font and spacing controls, accent choices, and a one page fit that tightens spacing without deleting content.
- **Use the rest of the workflow.** Cover letters, LinkedIn copy, a kanban application tracker, interview prep, version comparison, a multi job leaderboard, a keyword library, proofreading, salary ranges from saved postings, public share links with QR codes, and outreach templates.

## Writing rules

These rules are enforced in generated copy and checked before export:

- No em dashes, double hyphens or decorative separators.
- No "results driven", "team player", "passionate", "dynamic", "go getter" or "responsible for".
- One idea per bullet, with a varied action verb.
- Present tense for current roles, past tense for previous roles.
- Concrete numbers only when the number appears in your input or you confirm it.

## Truthfulness model

- Every bullet carries a `source` object that points to the uploaded text, a user answer or a placeholder.
- The fact checker compares claims with the source text and, for tailored versions, with the base resume.
- It blocks invented metrics, unresolved placeholders, new employers, changed titles or dates, new degrees, new certifications, unsupported skills and planned projects that were placed on the resume.
- The final check runs on export, share link creation and public download. Blocking findings stop the file.
- You can confirm most findings explicitly. Confirmations are stored by fingerprint so a recheck does not silently drop them. Unresolved placeholders and placed planned projects cannot be confirmed away; the text must be fixed.
- AI output is never trusted on its own. The deterministic checker runs after generation and the deterministic score is always the score shown.

## Stack

- Next.js 14 App Router, React 18, TypeScript
- Tailwind CSS and shadcn/Radix primitives
- PostgreSQL with Prisma 5
- Custom email code and Google OAuth sessions using `jose`
- S3 compatible storage with a local disk fallback
- `pdf-parse` and `mammoth` for uploads
- Puppeteer for PDF, `docx` for Word, plain text fallback
- OpenAI compatible chat completions for optional drafting, with Zod validated JSON
- Vitest for scoring and fact check tests

## Local setup

### 1. Requirements

- Node.js 20 or newer. Node 22 is recommended.
- PostgreSQL 14 or newer, locally or hosted.
- Chrome for Puppeteer if you need PDF export. DOCX and TXT work without it.

### 2. Install

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Set at least:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/resumeforge?schema=public"
AUTH_SECRET="a long random string"
APP_URL="http://localhost:3000"
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 4. Create the schema

```bash
npm run db:push
```

For a migration based workflow use `npm run db:migrate` instead.

### 5. Optional demo data

```bash
npm run db:seed
```

This creates `demo@resumeforge.local` with a sample resume, two applications, versions and one analysis. Sign in with the email code flow and use that address.

### 6. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

### 7. Sign in without email delivery

When SMTP is not configured and you are not in production, the six digit code is returned by the API and displayed on the login screen. In production, configure SMTP or set `AUTH_DEV_OTP=true` only for a controlled environment.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `AUTH_SECRET` | Yes in production | Signs session cookies. The development fallback must not be used in production. |
| `APP_URL` | Recommended | Base URL for share links and QR codes. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | Enables Google sign in. Redirect URI is `${APP_URL}/api/auth/google/callback`. |
| `LLM_API_KEY` | No | Enables AI drafting. Without it, rules based generators run. |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TIMEOUT_MS` | No | OpenAI compatible endpoint, model and timeout. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Production | Delivers sign in codes. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | No | Stores original uploads. Falls back to `.data/uploads`. |
| `PUPPETEER_EXECUTABLE_PATH`, `CHROME_PATH` | No | Points the PDF renderer at a Chrome binary. |
| `MAX_UPLOAD_MB` | No | Upload size limit, default 12. |
| `AUTH_DEV_OTP` | No | Allows the development code in production. Keep false. |

## Scripts

```bash
npm run dev          # development server
npm run build        # prisma generate and production build
npm run start        # production server
npm run lint         # Next lint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest, runs once
npm run test:watch   # Vitest watch mode
npm run db:generate  # Prisma client
npm run db:push      # push schema to the database
npm run db:migrate   # create and apply a migration
npm run db:seed      # load the demo account
```

## Project map

```
src/
  app/                 App Router pages and API route handlers
  components/          Shell, views, editor panels, preview, shared UI
  lib/                 Scoring, fact check, parsing, keywords, AI, storage, auth
  prompts/             Prompt templates and Zod JSON schemas
prisma/
  schema.prisma        Data model
  seed.ts              Optional demo data
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the request flow, scoring weights, fact check pipeline and API surface.

## Testing

```bash
npm run test
```

The suite covers deterministic scoring behavior and the fact check guard. It does not need a database or an API key. Add a database test only if your changes touch Prisma queries, and keep it separate from the unit suite.

## Deployment notes

- Set `AUTH_SECRET` to a long random value and `APP_URL` to the public HTTPS origin.
- Run `npm run db:push` or apply migrations before starting the app.
- Configure SMTP for sign in codes.
- Configure S3 for durable uploads on ephemeral hosts.
- Confirm Chrome is available to Puppeteer, or restrict export to DOCX and TXT.
- Share links are public and read only. They expire, and downloads still run the fact check.
- The app stores OAuth tokens and original upload keys. Restrict database and bucket access accordingly.

## Known limits

- PDF layout fidelity from an uploaded file is preserved as font, margin and single column tokens, not as a pixel perfect reconstruction.
- The scoring model is deterministic and opinionated. It is a screen, not a hiring prediction.
- Salary insights only summarize ranges you saved or ranges found in the posting. There is no external market dataset.
- Links can be created and expire, but a revoke control is not exposed in the UI yet.
- The app has not been exercised against a live PostgreSQL instance in this workspace. Run the setup steps before treating a deployment as validated.

## License

Private project. Add a license before distributing.
