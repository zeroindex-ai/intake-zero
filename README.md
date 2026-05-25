# intake-zero

Claude-backed prospect intake for the ZeroIndex consultancy. A public form at
`intake.zeroindex.ai` collects project inquiries; a durable
[Vercel Workflow DevKit](https://useworkflow.dev) pipeline persists, enriches,
classifies, drafts a triage reply, and sends notifications &mdash; surviving
crashes and tab closes along the way.

## Stack

- Next.js 16 (app router) on Vercel
- Vercel Workflow DevKit (`workflow`, `workflow/next`)
- Turso libsql + drizzle-orm
- Anthropic SDK &mdash; `claude-haiku-4-5` for classification, `claude-sonnet-4-6` for the triage draft
- Resend for transactional email
- Tailwind 4 (no shadcn; design tokens mirror `STYLE_GUIDE.md`)
- Playwright for critical-path e2e

## Pipeline

```
POST /api/intake
  → row inserted (status: received)
  → workflow.start(intakeWorkflow, { submissionId })
    1. persistSubmission   (status: enriching)
    2. enrichCompany       fetch + parse URL → signals (status: classifying)
    3. classifySubmission  haiku → engagementType + fitScore   (status: drafting)
    4. draftTriage         sonnet → reply draft                (status: notifying)
    5. notifyOwner         resend → owner inbox
    6. ackProspect         resend → prospect inbox             (status: sent)
```

Steps use `'use step'`; the orchestrator uses `'use workflow'`. Idempotent
ingest dedupes on `sha256(email + problem)` within a 24h window. Transient
Anthropic/Resend failures throw `RetryableError`; bad input throws `FatalError`.

## Local dev

```bash
pnpm install
cp .env.example .env.local         # fill in values
pnpm db:generate                   # generate first migration
pnpm db:migrate                    # apply
pnpm dev
```

For Turso provisioning, env-var population, and custom-domain wiring, follow
the `deploy-zeroindex-vercel-app` skill end-to-end.

## Tests

```bash
pnpm test          # vitest unit/integration
pnpm test:e2e      # playwright (boots dev server)
pnpm typecheck
pnpm lint
```

Playwright covers three critical paths only: form submit → durable run page,
required-field validation, and the `/admin` redirect gate. These run in CI (the
`e2e` job boots the app against a local SQLite file with dummy keys). The
happy-path's terminal-state assertion (`sent`) needs live Anthropic/Resend, so
it runs only locally with real keys — CI asserts the submission persisted and
the run page rendered. No visual regression, no cross-browser matrix.

## Routes

| Path                              | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `/`                               | Public intake form                            |
| `/runs/[id]`                      | Prospect-visible run timeline (polls status)  |
| `/admin`                          | Submissions table (HTTP Basic Auth via root `proxy.ts`) |
| `/admin/[id]`                     | Submission detail + classification + draft    |
| `POST /api/intake`                | Validates payload, starts workflow run        |
| `GET /api/intake/[id]/status`     | JSON `{ status }` for polling                 |
| `/.well-known/workflow/*`         | WDK runtime endpoints (mounted by `withWorkflow` in `next.config.ts`) |

## What&rsquo;s deferred

- Magic-link or OIDC admin auth (a single shared secret over HTTP Basic Auth is fine for v0.1).
- CRM sync / Stripe / scheduling embed (Cal.com link goes in the triage email).
- Visual-regression tests, multi-browser e2e.
- Replacing the marketing site&rsquo;s `mailto:` CTA &mdash; one-line edit in
  `zeroindexai/index.html` after first deploy is verified.
