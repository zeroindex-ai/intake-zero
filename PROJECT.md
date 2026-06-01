# intake-zero — Project Documentation

> **Phase:** Production
> **Live:** [intake.zeroindex.ai](https://intake.zeroindex.ai) · **Repo:** github.com/zeroindex-ai/intake-zero

Claude-backed prospect intake behind the Contact CTA on `zeroindex.ai`: a prospect submits a structured form, and a durable [Vercel Workflow DevKit](https://useworkflow.dev) pipeline persists the submission, enriches it from the company URL, classifies engagement type with Claude Haiku, drafts a triage reply with Claude Sonnet, emails the owner with the draft, and acknowledges the prospect — surviving crashes, redeploys, and tab closes along the way. The prospect watches a public `/runs/[id]` page stream the pipeline status; that page is the marketing for the underlying capability — **durable orchestration you can watch happen.**

> **Section convention:** every numbered section below is expected. If one genuinely doesn't apply, the heading is kept with `— n/a: [reason]`. Family/repo-specific sections (the WDK pipeline detail) come after §8.

---

## 1. Why this exists

Three benefits, in order of weight:

1. **Submissions stop falling into a black hole.** A `mailto:` link gives the sender no confirmation and no visibility. The intake form returns a `submissionId`, shows the prospect a live pipeline timeline, and acknowledges receipt by email — they know it landed and roughly when to expect a reply.
2. **Triage lands ready to act on.** Classification + draft reply arrive in the owner's inbox next to the raw submission, so deciding-and-responding takes minutes instead of being deferred to "later."
3. **The pipeline is crash-safe.** Durable orchestration means a redeploy, a tab close, or a transient API failure mid-run doesn't drop the submission or repeat side effects — every step is checkpointed and retried under explicit retry/fatal rules, and the two email sends carry Resend idempotency keys so a step retry can't double-send.

### Goals & success criteria

| Goal | How I'll know it's met | Status |
| --- | --- | --- |
| Form ships and converts | `intake.zeroindex.ai` accepts submissions; >0 real submissions within 30 days of launch | ⏳ |
| Durable pipeline runs to completion | >95% of submissions reach `status: sent` without manual intervention | ⏳ |
| Owner sees triage draft fast | Median submit → owner-notify email ≤30s | ⏳ |
| Prospect sees the WDK pipeline live | `/runs/[id]` renders the timeline; a reload mid-run resumes display from the current step | ⏳ |
| Marketing-site swap is clean | The Astro `zeroindex-site` apex Contact CTA links to `intake.zeroindex.ai`; copy-email fallback remains | ✅ |
| Admin view is usable on phone | `/admin` table renders + paginates from a single-handed mobile view | ⏳ |

**Out of scope (v0.1):**

- **Scheduling embed** — a Cal.com link goes in the triage email; no widget on the page.
- **CRM sync, Stripe, proposals** — Turso is the system of record. Export-friendly schema; integrate later.
- **Magic-link or OIDC admin auth** — a single shared secret over HTTP Basic Auth is enough for one admin.
- **Multi-tenant** — single ZeroIndex tenant.
- **Conversational/chat intake** — structured fields convert better for B2B and feed the workflow with clean inputs.
- **Visual-regression / multi-browser e2e** — three critical-path Playwright specs only.
- **A "thank you" page that pretends to be the AI's reply** — the prospect sees pipeline status, not the LLM's triage of their own message; that stays internal.

## 2. Strategic decisions

### Tech stack

| Choice | Why this | Alternative rejected |
| --- | --- | --- |
| Next.js 16 (app router) on Vercel Pro | Consistent with `ask-zeroindex`/`trace-pack`; Server Components for admin pages, one client island for the form | — |
| Vercel Workflow DevKit (`workflow`, `workflow/next`) | The whole point — native to Vercel, crash-safe; its durable-state semantics power the prospect-facing `/runs/[id]` page, which is the marketing | plain API route + queue — no checkpoint/resume |
| Turso libsql + drizzle-orm | Consistent with `ask-zeroindex`/`trace-pack`; per-submission write volume is single-digit/day, SQLite semantics are right | Postgres — heavier than the write volume warrants |
| Anthropic SDK directly | DurableAgent earns its weight only with a tool-use loop to checkpoint; v0.1 has no tools, so two plain step fns calling `messages.create` are simpler and cheaper to reason about | `@workflow/ai` `DurableAgent` — abstraction without payoff here |
| `claude-haiku-4-5-20251001` (classify) | Cheap, fast; the JSON-classification task is well within Haiku's range | Sonnet — overkill for structured classification |
| `claude-sonnet-4-6` (triage draft) | Tone-of-voice and judgment matter here; Sonnet is the right pay-grade | Haiku — under-powered for tone |
| Resend + `@react-email/render` templates | Founder-friendly DX, transactional-only, plays well with Vercel | — |
| Tailwind 4 + CSS-variable tokens mirroring `STYLE_GUIDE.md` | Hand-rolled primitives keep the dependency surface small and tokens portable across all ZeroIndex sites | shadcn/ui — registry + generator + Radix footprint for ~5 primitives |
| HTTP Basic Auth on `/admin` via root `proxy.ts`, `ADMIN_PASSWORD` + `timingSafeEqual` | The canonical ZeroIndex admin model — one model across the portfolio, no signin page/cookie/users table; browser's native prompt is the login; fails closed (503 if unset, 401 otherwise) | `next-auth` v5 / OIDC — version drift + moving parts for one admin |
| Vitest (unit) + Playwright (critical-path e2e) | WDK timing-and-state behavior is exactly what Playwright is best at; Vitest covers pure helpers | — |
| MIT license · pnpm · Vercel | House default | — |

### Key decisions

Non-obvious choices kept with their rationale so they can be re-litigated with full context.

- **Workflow shape — one linear orchestrator (`intakeWorkflow`), six named steps.** Linear-with-named-steps is right for v0.1; branching/parallel arrives only if enrichment grows multiple parallel fetches.
- **Step contract — each step writes its own status transition + result back to the `submissions` row.** The DB row is the canonical view for both the prospect page and the admin; WDK's run history is debug-only.
- **Status delivery — client polls `/api/intake/[id]/status` every 1.5s.** WDK has streaming primitives (`getWritable` + readable streams) — deferred until polling proves insufficient; at single-digit RPS the cost is negligible.
- **Idempotent ingest — `sha256(lowercased email + '|' + problem)` dedupe with a 24h window.** Same prospect double-submitting the same message gets the same `submissionId`; a new message starts a new run. Dedupe runs *before* the per-email rate-limit quota so an identical resubmit doesn't burn budget.
- **Error boundaries — bad input → `FatalError` (no retry); transient API failures → `RetryableError` (WDK retries with backoff).** Eliminates the "stuck workflow" failure mode for genuinely transient outages.
- **Enrichment failure is non-fatal.** If the URL fetch fails or is SSRF-blocked, the step falls through with an un-enriched result (`fetched: false`) rather than failing the run — a broken/hostile consumer URL shouldn't block triage; classification just receives empty signals and the draft still goes out.
- **SSRF guard on enrichment (`src/lib/safe-fetch.ts`).** `safeFetch` DNS-resolves the user-supplied URL, rejects loopback/private/link-local/ULA/CGNAT/metadata addresses, **pins the connection to the validated IP** (via an undici dispatcher; Host/SNI stay the hostname), and re-validates every redirect hop. Validating only the host string is insufficient: a public URL can 30x-redirect to `169.254.169.254`, and a hostname can DNS-rebind between the check and the connect — pinning to the validated address closes that TOCTOU.
- **Rate limiting — fixed-window counters in a `rate_limits` table (`src/lib/rate-limit.ts`).** `POST /api/intake`: 10/hr per hashed IP + 5/hr per hashed email (429 + `retry-after`); a 32 KB body cap rejects oversized payloads pre-buffer. Expired buckets are pruned deterministically — only when a request opens a fresh window for its IP (`firstInWindow`), at most once per IP per window. The IP comes from the platform-trusted `x-real-ip` (not a spoofable `x-forwarded-for` hop, see `clientIp`); the per-email cap is the backstop. IP/email are hashed so no raw PII is stored. The 24h dedupe hash is **not** a rate limit — it's defeated by varying one character. The admin gate is Basic Auth at the proxy, so it needs no app-level throttle.
- **Run page is unauthenticated.** `submissionId` is a random UUID acting as a bearer token; anyone with the link sees status + the submitter's own name/email. Acceptable for a bearer-token URL, but it is not zero-PII — email-match auth is deferred until there's a reason.
- **Deliberately NOT chosen** — `@workflow/ai` `DurableAgent` (no multi-turn tool loop to checkpoint); `next-auth`/OIDC (one admin); shadcn/ui (other ZeroIndex sites don't use it); chat-style intake (gimmicky for B2B, worse inputs); showing the prospect the triage classification (honest framing — the AI's read of their problem stays between owner and LLM); a calendaring widget (a Cal.com link in the email is one less third-party script on a page that needs to feel fast).

## 3. Architecture

```
[browser form] → POST /api/intake → Zod validate → rate-limit → dedupe → insert(submissions)
                                                                              │
                                                                  start(intakeWorkflow)
                                                                              │
   browser ⇄ GET /api/intake/[id]/status (poll 1.5s) ⇄ submissions.status ⇄ WDK steps
                                                                              │
                                                          Turso libsql (system of record)
```

A `POST /api/intake` request is rate-limited (per-IP, then per-email), size-capped, Zod-validated, and deduped against the 24h window before a `submissions` row is inserted with `status: received`. The route then calls `start(intakeWorkflow, [{ submissionId }])` and stores the returned `runId` on the row; if `start()` throws, the row is marked `failed` (step `received`) so it surfaces rather than stranding.

`intakeWorkflow` (`src/workflow/intake.ts`, `'use workflow'`) is a linear orchestrator wrapping six `'use step'` functions in a try/catch; any thrown error routes to `markFailed`, which captures the in-flight status into `failed_at_step` and re-throws. Each step does its own side effect (full Node.js runtime), then writes its result + the next status transition back to the `submissions` row — so the row is the single source of truth the prospect page and admin both read. The named steps:

1. **persist** — loads the row, marks it `enriching`.
2. **enrich** — `safeFetch`es the company URL (SSRF-guarded), strips HTML to text, detects tech signals (nextjs/vercel/anthropic/rag/healthcare/…); non-fatal on failure; marks `classifying`.
3. **classify** — Haiku → `{ engagementType, fitScore, rationale, suggestedCaseStudies }`; marks `drafting`.
4. **draft-triage** — Sonnet → the reply draft; marks `notifying`.
5. **notify-owner** — Resend → `OWNER_EMAIL` with the raw submission + classification + draft (idempotency-keyed).
6. **ack-prospect** — Resend → the prospect (idempotency-keyed); marks `sent`.

The WDK runtime is auto-mounted at `/.well-known/workflow/*` by `withWorkflow(nextConfig)` — no hand-written workflow route handler.

### Status state machine

```
received → enriching → classifying → drafting → notifying → sent
                                                              └→ prospect ack
   (any step) ── RetryableError ──→ WDK retries with backoff
   (any step) ── FatalError / uncaught ──→ markFailed → failed (failed_at_step = in-flight status)
```

## 4. Public contract

The stable HTTP surface the browser client depends on. Shapes are derived from the route handlers + Zod schema (`app/api/intake/route.ts`, `app/api/intake/[id]/status/route.ts`).

- **`POST /api/intake`** — public, unauthenticated. Rate-limited 10/hr per hashed IP + 5/hr per hashed email; 32 KB body cap. Request body (Zod):

  ```ts
  {
    name: string,            // 1–120
    email: string,           // email, ≤320
    problem: string,         // 10–8000
    company?: string,        // ≤200, default ''
    role?: string,           // ≤120, default ''
    phone?: string,          // ≤40,  default ''
    url?: string,            // url, ≤2048, or ''
    lookingFor?: string[],   // each ≤80, ≤15 items, default []
    stack?: string[],        // each ≤60, ≤20 items, default []
    timeline?: string,       // ≤60, default ''
    budget?: string,         // ≤60, default ''
    teamSize?: string,       // ≤40, default ''
    contactPref?: string,    // ≤20, default ''
    referral?: string        // ≤60, default ''
  }
  ```

  Responses:
  - `200 { submissionId, runId }` — accepted, workflow started.
  - `200 { submissionId, deduped: true }` — identical submission within 24h; returns the original `submissionId`, starts no new run.
  - `400 { error: 'invalid body' }` — Zod/JSON parse failure (generic; raw Zod errors are not echoed).
  - `413 { error: 'payload too large' }` — body > 32 KB.
  - `429 { error: 'rate limited' }` + `retry-after` header — IP or email window exhausted.
  - `500 { error: 'could not start processing' }` — workflow `start()` failed (row marked `failed`).

- **`GET /api/intake/[id]/status`** — public (the `id` UUID is the bearer token), `force-dynamic`, polled every 1.5s.
  - `200 { status, failedAtStep, updatedAt }` — `status` is one of `received | enriching | classifying | drafting | notifying | sent | failed`; `failedAtStep` is the in-flight status captured on failure (else `null`).
  - `404 { error: 'not found' }` — unknown `id`.

- **`/admin`, `/admin/[id]`** — HTTP Basic Auth at root `proxy.ts` (`ADMIN_PASSWORD` + `timingSafeEqual`); `401` unauthenticated, `503` if `ADMIN_PASSWORD` unset. Internal admin surface, not a stable contract.

## 5. Data model

Turso libsql via drizzle-orm (`src/db/schema.ts`), migrations in `src/db/migrations/`.

**`submissions`** — one row per intake; the canonical state both the prospect page and admin read. The status transition is owned by whichever step is in flight, so the row doubles as the pipeline's progress record.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | random UUID; doubles as the `/runs/[id]` bearer token |
| `run_id` | text | WDK run id, set after `start()` |
| `status` | text NOT NULL, default `received` | enum: `received·enriching·classifying·drafting·notifying·sent·failed` |
| `email`, `name` | text NOT NULL | submitter contact |
| `company`, `role`, `phone` | text | optional contact fields |
| `problem` | text NOT NULL | the prospect's problem statement (classifier input) |
| `looking_for` | json text NOT NULL, default `[]` | selected "what are you looking for?" outcomes — strongest intent signal when prose is thin |
| `stack` | json text NOT NULL, default `[]` | declared tech stack |
| `timeline`, `budget`, `team_size`, `contact_pref`, `referral` | text | optional structured fields |
| `url` | text | company URL (enrichment source) |
| `dedupe_hash` | text NOT NULL | `sha256(email\|problem)`; 24h idempotency window |
| `enrichment` | json text | `{ fetched, summary, signals[] }` or null |
| `classification` | json text | `{ engagementType, fitScore, rationale, suggestedCaseStudies[] }` or null |
| `triage_draft` | text | Sonnet-drafted reply |
| `failed_at_step` | text | in-flight status captured by `markFailed`; null on non-failed rows |
| `created_at`, `updated_at` | integer timestamp NOT NULL | `unixepoch()` default |

**`rate_limits`** — fixed-window counters; one row per `(scope:identifier:window-start)` bucket.

| Column | Type | Notes |
| --- | --- | --- |
| `bucket` | text PK | `scope:hashedIdentifier:windowStart` |
| `count` | integer NOT NULL, default 0 | incremented per request |
| `expires_at` | integer timestamp NOT NULL | swept opportunistically (`sweepExpiredRateLimits`) |

**Migrations:** `0000` initial `submissions`; `0001` `failed_at_step`; `0002` `rate_limits` table; `0003` `phone`; `0004` `looking_for`/`team_size`/`contact_pref`/`referral`.

## 6. Project structure

```
app/
  page.tsx                       public intake form page
  runs/[id]/page.tsx             prospect-visible pipeline timeline
  admin/page.tsx, [id]/page.tsx  submissions table + detail (Basic Auth)
  api/intake/route.ts            POST: Zod validate → rate-limit → dedupe → insert → start(workflow)
  api/intake/[id]/status/route.ts GET: { status, failedAtStep, updatedAt } for polling
  layout.tsx, HeaderNav.tsx,     chrome (canonical ZeroIndex app layout) + favicon links
    globals.css, not-found.tsx
  .well-known/workflow/*         WDK runtime (auto-mounted by withWorkflow; generated)
proxy.ts                         Basic-Auth gate on /admin (Next 16 middleware)
src/
  workflow/
    intake.ts                    'use workflow' linear orchestrator (6 steps + markFailed)
    steps/                       persist · enrich · classify · draft-triage · notify-owner · ack-prospect · mark-failed
    anthropic.ts                 lazy Anthropic client
    prompts.ts                   classify + draft prompts (with injection notes)
    parse-classification.ts      tolerant JSON parser for the Haiku output
    model-output-error.ts        Retryable/Fatal mapping for model failures
    trace.ts                     OpenTelemetry span helper
  db/
    schema.ts                    drizzle schema (submissions, rate_limits) + result types
    client.ts                    lazy db() singleton (undici-fetch workaround for Vercel)
    migrate.ts                   migration runner
    migrations/                  generated SQL + meta
  lib/
    env.ts                       strict Zod env() (lazy, cached)
    safe-fetch.ts                SSRF-guarded fetch (IP-pinned, per-hop revalidation)
    rate-limit.ts                fixed-window counter check + sweep
    request-ip.ts                clientIp() from platform-trusted x-real-ip
    timingSafeCompare.ts         constant-time secret compare
    palette.ts, stack.ts         design tokens + the cross-repo stack mirror
  components/
    intake-form.tsx              the one client island
    run-timeline.tsx             polled timeline with min-dwell display
  email/
    resend.ts                    Resend client
    templates/                   owner-notify.tsx · prospect-ack.tsx (react-email)
evals/                           eval-pack suite over the LLM steps (golden.json, checks.ts, subject.ts, run.ts)
tests/e2e/intake.spec.ts         Playwright critical-path specs
next.config.ts                   withWorkflow(nextConfig); serverExternalPackages
drizzle.config.ts, playwright.config.ts, vitest.config.ts
```

## 7. Distribution

Ships as `intake.zeroindex.ai` on Vercel (DNS-only at Cloudflare, CNAME), backed by the prod Turso `intake-zero` DB (`aws-us-east-1`), via the `deploy-zeroindex-vercel-app` skill. `next build` wraps `next.config.ts` with `withWorkflow`, which contacts Vercel-side WDK infrastructure — so the build runs only on Vercel, not in CI. Companion repo: the Astro `zeroindex-site` apex (deployed separately on Vercel) whose Contact CTA links here; the marketing `mailto:`→intake swap is hand-driven post-deploy.

### Configuration

| Env var | Required? | Purpose / default |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | yes | prod libsql URL (non-Sensitive in Vercel so `env pull` works) |
| `TURSO_AUTH_TOKEN` | prod | DB auth token (optional locally with a `file:` DB) |
| `ANTHROPIC_API_KEY` | yes | classify + draft steps |
| `RESEND_API_KEY` | yes | notify-owner + ack-prospect steps |
| `FROM_EMAIL` | yes | sender; `intake@zeroindex.ai` (verified domain) |
| `OWNER_EMAIL` | yes | triage-notification recipient; `hello@zeroindex.ai` |
| `ADMIN_PASSWORD` | yes | `/admin` Basic Auth (user `admin`); read raw by `proxy.ts`, not the strict `env()`; generate `openssl rand -base64 48` |
| `PUBLIC_BASE_URL` | yes | run-status page metadata + email links; `https://intake.zeroindex.ai` |

`env.ts` validates `TURSO_DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `OWNER_EMAIL`, `FROM_EMAIL`, `PUBLIC_BASE_URL` (all required there); `ADMIN_PASSWORD` is read separately by the middleware so the build doesn't need it.

## 8. Testing & evaluation

- **Unit (Vitest, `pnpm test`)** — pure helpers and step guards with mocked Anthropic SDK + db: `parse-classification` (11 cases), `classify`, `draft-triage` (Retryable/Fatal mapping), `mark-failed` (status capture), `safe-fetch` (IP-range classification), `rate-limit`, `request-ip`, and the API route.
- **E2E (Playwright, `pnpm test:e2e`)** — three critical-path specs in `tests/e2e/intake.spec.ts`: happy path (submit → run page → reaches `sent`; the terminal-state assertion is skipped under CI, which has no live Anthropic/Resend), validation (missing required fields blocks submission), admin gate (unauthenticated `/admin` → 401 Basic Auth).
- **Eval harness (`pnpm eval`, `evals/`)** — a `@zeroindex-ai/eval-pack` suite over the two LLM steps (`runClassification` → `runDraft`, no DB/email side effects). Checks: classification calibration (`engagementType` matches the label, `fitScore` in the expected range), draft rules (signs off as Abhishek, ≤~180 words, ≤1 case study), **injection resistance** (a hostile `problem` must not leak into the prospect-facing draft — doubles as a security guard), and no over-promising (no guaranteed price/timeline). Hits the real models (Haiku/Sonnet), so it costs per run; `EVAL_PASS_THRESHOLD` (default `0.8`) gates the exit code. Baseline run was 16/16.
- **CI gate** — `.github/workflows/ci.yml` runs `typecheck` + `lint` + `test` and the Playwright `e2e` job on push/PR (`next build` deliberately omitted — see §7). `.github/workflows/eval.yml` runs the eval on changes to `src/workflow/**` or `evals/**`, on a daily cron, and on dispatch — a separate **Eval** check (dependabot skipped); it uploads `evals/results/` and, if `EVALS_SITE_TOKEN` is set, publishes a `--redact-answers` report to `evals.zeroindex.ai/intake-zero` (strips draft bodies, keeps pass-rate/categories/timings).

---

## Ordered work list

Ordered, not calendared. Check off as shipped.

- [x] v0.1 scaffold (Next 16 + WDK + Turso + Resend + Anthropic), drizzle schema + migrations, CI, docs
- [x] Public-surface hardening — rate limiting, SSRF guard (IP-pinned), generic 400, 32 KB body cap, `start()`-failure handling, Resend idempotency keys
- [x] Eval harness + the **Eval** CI check publishing to `evals.zeroindex.ai/intake-zero`
- [x] Admin-auth migration to the canonical Basic-Auth-at-`proxy.ts` model
- [x] v0.2 polish — run-timeline min-dwell display; Stack-pill dedup via the canonical `zeroindex-site` source
- [ ] WDK readable-stream live updates (replace polling) — the deferred proper fix for the min-dwell band-aid
- [ ] Cal.com booking link auto-injected when `fitScore ≥ 4`
- [ ] CSV export from `/admin`
- [ ] Per-source intake (e.g. a separate URL/prompt for podcast inquiries)
- [ ] Magic-link admin auth (only when a second admin exists)

## Decision log (running)

Newest first. Every entry is dated.

- **2026-06-01** — Documentation normalized to the 14-section web-service baseline: added the public-contract shapes (§4), data model (§5), full project tree (§6), config table (§7), and a consolidated testing & evaluation section (§8); trimmed the build-diary "Done/Next" list into this log + the ordered work list.
- **2026-05-25** — v0.2 polish: (1) run-timeline min-dwell — `/runs/[id]` trails the polled status via a `displayIdx` advancing one step at a time with a ~650ms minimum dwell, so a sub-second backend step (`notifying`) gets a visible "active" moment instead of flashing between two 1.5s polls (`src/components/run-timeline.tsx`); WDK readable-stream rewrite remains the deferred proper fix. (2) Stack-pill dedup — the apex Stack section now renders from a canonical `src/data/stack.ts` in `zeroindex-site`; this repo's `src/lib/stack.ts` is documented as its cross-repo derived mirror (the two repos can't share a file).
- **2026-05-22** (`e8d50bb`) — Admin-auth migration: retired the shared-secret signin cookie (the `/admin/signin` page, `POST /api/admin/signin`, HMAC-derived cookie) for the canonical ZeroIndex model — HTTP Basic Auth on `/admin` at root `proxy.ts`, `ADMIN_PASSWORD` + `timingSafeEqual`, no signin page/cookie/users table, identical to `trace-pack`/`contract-lens`. The earlier signin/cookie entries are history, superseded by this.
- **2026-05-19** — Hardening round 2: SSRF guard pins the connection to the validated IP (closes the DNS-rebinding TOCTOU); 32 KB body cap on `POST /api/intake`; `start()` failure marks the row failed instead of stranding it; email steps carry Resend idempotency keys; the `safeFetch` dispatcher is closed on every path; Playwright specs wired into the CI `e2e` job. Vitest coverage added for the workflow steps + guards.
- **2026-05-19** — Public-surface hardening round 1: rate limiting on `POST /api/intake` (per-hashed-IP + per-hashed-email fixed windows, `rate_limits` table, migration `0002`), SSRF guard on enrichment (`src/lib/safe-fetch.ts`, per-redirect-hop validation), generic 400 (stopped echoing raw Zod errors), prompt-injection notes in both LLM prompts.
- **2026-05-18** — Resend domain `zeroindex.ai` (apex) verified; DKIM at `resend._domainkey`, SPF+MX at `send` subdomain (Resend's SES bounce-domain pattern keeps apex SPF untouched); `FROM_EMAIL` swapped to `intake@zeroindex.ai`; cross-address delivery confirmed.
- **2026-05-18** (zeroindexai `045b62f`) — Marketing-site swap: the Contact CTA on `zeroindex.ai` points to `https://intake.zeroindex.ai` instead of `mailto:hello@zeroindex.ai`; the copy-email button is retained as fallback. Favicon wiring added to `app/layout.tsx` (canonical `[Z]` mark, no per-service variant).
- **2026-05-18** — First prod deploy: Turso DB `intake-zero` provisioned (`aws-us-east-1`), Vercel project linked to the LLC team with 8 prod env vars, custom domain `intake.zeroindex.ai`. Live e2e: full pipeline reaches `sent` in 14–19s with correct classification + populated draft.

## Known constraints & future work

- **Polling, not streaming.** `/runs/[id]` polls every 1.5s; sub-second steps need the min-dwell band-aid to be visible. The proper fix is the deferred WDK readable-stream rewrite.
- **Run page is not zero-PII.** The `submissionId` bearer URL exposes the submitter's own name/email; email-match auth deferred until there's a reason.
- **Eval costs real money per run** (hits live Haiku/Sonnet) and the golden fit-score ranges are still loose (baseline 16/16) — tighten over time to make the eval more discriminating.
- **Turso is the only system of record** — no CRM/Stripe/proposal integration yet (deliberate v0.1 scope).
- **Single admin** — Basic Auth only; magic-link/OIDC deferred until a second admin exists.

## User personas

- **The prospect (B2B founder/eng-leader)** — submits once, wants confirmation it landed and a sense of when a reply comes. Values the live timeline as proof the inquiry isn't in a black hole; sees pipeline status, never the AI's read of their own message.
- **The owner (Abhishek)** — wants triage that's ready to act on: classification + draft reply in the inbox next to the raw submission, so responding is minutes not "later." Reviews/edits the draft before sending; the LLM never replies autonomously.

## Cross-references

- **`zeroindex-site`** (Astro apex, live) — hosts the Contact CTA that links here; canonical `STYLE_GUIDE.md` and `src/data/stack.ts` (this repo's `src/lib/stack.ts` mirrors it).
- **`trace-pack`, `contract-lens`** (live) — share the canonical admin Basic-Auth model and app-layout chrome.
- **`@zeroindex-ai/eval-pack`** (npm) — the eval harness `evals/` is built on it; reports publish to `evals.zeroindex.ai/intake-zero`.
- **Skills** — `deploy-zeroindex-vercel-app` (deploy), `zeroindex-app-layout` (chrome).
</content>
</invoke>
