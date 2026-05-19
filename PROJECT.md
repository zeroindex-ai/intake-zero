# intake-zero — Project Documentation

> **Status: live at [intake.zeroindex.ai](https://intake.zeroindex.ai).** Full pipeline (persist → enrich → classify → draft → notify owner → ack prospect) verified end-to-end against production Anthropic + Resend. Resend domain `zeroindex.ai` is verified — `FROM_EMAIL=intake@zeroindex.ai`, delivers to any recipient. Wired to the Contact CTA on `zeroindex.ai`.

This document captures the scope, strategic decisions, architecture, and ordered work for `intake-zero` — the Claude-backed prospect intake behind the Contact CTA on `zeroindex.ai`.

---

## 1. Project overview

### What `intake-zero` is

A single-purpose web app at `intake.zeroindex.ai`. A prospect submits a structured intake form; a durable [Vercel Workflow DevKit](https://useworkflow.dev) pipeline persists the submission, enriches it from the company URL, classifies engagement type with Claude Haiku, drafts a triage reply with Claude Sonnet, emails the owner with the draft, and acknowledges the prospect — surviving crashes, redeploys, and tab closes along the way.

The prospect sees a public `/runs/[id]` page that streams the pipeline status. That page is the marketing for the underlying capability: **durable orchestration you can watch happen.**

### Why this project

Three benefits, in order of weight:

1. **Submissions stop falling into a black hole.** A `mailto:` link gives the sender no confirmation and no visibility. The intake form returns a `submissionId`, shows the prospect a live pipeline timeline, and acknowledges receipt by email — they know it landed and roughly when to expect a reply.
2. **Triage lands ready to act on.** Classification + draft reply arrive in the owner's inbox next to the raw submission, so deciding-and-responding takes minutes instead of being deferred to "later."
3. **The pipeline is crash-safe.** Durable orchestration means a redeploy, a tab close, or a transient API failure mid-run doesn't drop the submission or repeat side effects — every step is checkpointed and retried under explicit retry/fatal rules.

### Goals & success criteria for v0.1

| Goal                                                  | Metric                                                                                              | Status |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| Form ships and converts                               | `intake.zeroindex.ai` accepts submissions; >0 real submissions within 30 days of launch             | ⏳     |
| Durable pipeline runs to completion                   | >95% of submissions reach `status: sent` without manual intervention                                | ⏳     |
| Owner sees triage draft within 30s of submission      | Median time from submit → owner-notify email = ≤30s                                                 | ⏳     |
| Prospect sees the WDK pipeline live                   | `/runs/[id]` renders 6-step timeline; page reload mid-run resumes display from current step         | ⏳     |
| Marketing site swap is clean                          | `zeroindexai/index.html` Contact CTA links to `intake.zeroindex.ai`; copy-email fallback remains    | ✅     |
| Admin view is usable on phone                         | `/admin` table renders + paginates from a single-handed mobile view                                 | ⏳     |

### Out of scope (for v0.1)

- **Scheduling embed.** A Cal.com link goes in the triage email; no widget on the page.
- **CRM sync, Stripe, proposals.** Turso is the system of record. Export-friendly schema; integrate later.
- **Magic-link or OIDC admin auth.** Single shared-secret cookie is enough for one admin.
- **Multi-tenant.** Single ZeroIndex tenant.
- **Conversational/chat intake.** Structured form converts better for B2B and feeds the workflow with clean inputs.
- **Visual-regression tests, multi-browser e2e.** Three critical-path Playwright specs only.
- **A "thank you" page that pretends to be the AI's reply.** The prospect sees pipeline status, not the LLM's triage of their own message — that stays internal.

---

## 2. Strategic decisions log

### Stack picks

| Decision               | Choice                                                                | Reasoning                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App framework**      | Next.js 16 (app router) on Vercel Pro                                 | Consistent with `ask-zeroindex` and `trace-pack`. Server Components for the admin pages; one client island for the form.                                                           |
| **Orchestration**      | Vercel Workflow DevKit (`workflow`, `workflow/next`)                  | The whole point. Native to Vercel, crash-safe, the durable-state semantics WDK gives the prospect-facing `/runs/[id]` page are the marketing.                                      |
| **Storage**            | Turso libsql + drizzle-orm                                            | Consistent with `ask-zeroindex` and `trace-pack`. Per-submission write volume is single-digit per day; SQLite semantics are right.                                                 |
| **LLM**                | Anthropic SDK directly (no `@workflow/ai` DurableAgent)               | DurableAgent earns its weight when there's a tool-use loop to checkpoint. v0.1 has no tools — two plain step functions calling `messages.create` is simpler and cheaper to reason about. |
| **Classification model** | `claude-haiku-4-5-20251001`                                         | Cheap, fast, the JSON-classification task is well within Haiku's range.                                                                                                            |
| **Triage-draft model** | `claude-sonnet-4-6`                                                   | Tone-of-voice and judgment matter here; Sonnet is the right pay-grade.                                                                                                             |
| **Email**              | Resend + `react-email`-shaped templates                               | Founder-friendly DX, transactional-only, plays well with Vercel.                                                                                                                   |
| **Styling**            | Tailwind 4 + CSS-variable tokens mirroring `STYLE_GUIDE.md`           | No shadcn (matches `trace-pack`). Hand-rolled primitives keep the dependency surface small and the design tokens portable across all four ZeroIndex sites.                         |
| **Admin auth**         | Single `ADMIN_TOKEN` env var + httpOnly cookie + `timingSafeEqual`    | One admin, no team, no SSO. Magic-link arrives when there's a second admin to invite.                                                                                              |
| **Tests**              | Vitest (unit) + Playwright (critical-path e2e)                        | WDK timing-and-state behavior is exactly what Playwright is best at. Vitest covers pure helpers (the classifier parser, dedupe hash).                                              |
| **License**            | MIT                                                                   | Matches `eval-pack`, `mcp-pack`, `trace-pack`.                                                                                                                                     |

### Things deliberately NOT chosen

| Avoided                                       | Why                                                                                                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@workflow/ai` `DurableAgent`**             | Useful when there's a tool-use loop with side effects across many turns. Our two LLM calls are single-shot and live in plain `"use step"` functions; the extra abstraction would add weight without payoff. |
| **`next-auth` v5 / OIDC**                     | One admin (the founder). One shared secret + cookie + timing-safe compare is fewer moving parts and zero version drift.                                                                      |
| **shadcn/ui**                                 | The other ZeroIndex sites don't use it. Hand-rolling 5 primitives once is less code than the shadcn registry + generator + Radix dependency footprint.                                       |
| **Chat-style intake**                         | Reads as gimmicky for B2B consultancy. Structured fields convert better and feed the workflow with cleaner inputs.                                                                           |
| **Showing the prospect the triage classification** | Honest framing matters. The prospect sees pipeline status; the AI's read of their problem stays between the owner and the LLM.                                                          |
| **Calendaring widget**                        | A Cal.com link in the triage email is one less third-party script on a page that needs to feel fast.                                                                                         |

### Architecture decisions

| Decision                       | Choice                                                                                                              | Reasoning                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workflow shape**             | One linear orchestrator (`intakeWorkflow`) with six named steps                                                     | Linear-with-named-steps is what's right for v0.1. Branching/parallel arrives if enrichment grows multiple parallel fetches.                                                                          |
| **Step contract**              | Each step writes its own status transition + result back to the `submissions` row                                   | The DB row is the canonical view for both the prospect page and the admin. WDK's run history is debug-only; the prospect page reads `submissions.status`.                                            |
| **Status polling**             | Client polls `/api/intake/[id]/status` every 1.5s                                                                   | WDK has streaming primitives (`getWritable` + readable streams) — defer until polling proves insufficient. At expected single-digit RPS the cost is negligible.                                       |
| **Idempotent ingest**          | `sha256(email + problem)` dedupe with a 24h window                                                                  | Same prospect double-submitting the same message gets the same `submissionId`. Same prospect submitting a new message starts a new run. Mirrors the timing-safe-auth + idempotent-ingest default from the trace-pack deploy. |
| **Error boundaries**           | Bad-input → `FatalError` (no retry); transient API failures → `RetryableError` (WDK retries with backoff)           | Per WDK docs. Eliminates the "stuck workflow" failure mode for genuinely transient outages.                                                                                                          |
| **Enrichment failure mode**    | If URL fetch fails, fall through with un-enriched result (`fetched: false`) rather than failing the run             | A broken consumer URL shouldn't block triage. The classification step receives empty signals; the draft still goes out.                                                                              |
| **Run page is unauthenticated** | `submissionId` is the random URL token; anyone with the link can see status (not content)                          | Simplest path to a public status page anyone can watch. No PII is rendered on the run page — only the prospect's first name. Defer email-match auth until there's a reason.                          |
| **Marketing site change**      | One-line edit: `mailto:` button → `Start intake →` link; copy-email fallback stays                                  | Smallest possible surface area on the marketing side. The marketing site stays static HTML on Cloudflare; intake-zero is a separate app.                                                             |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Prospect's browser                           │
│   1. fills out form at intake.zeroindex.ai                              │
│   2. POST /api/intake → { submissionId }                                │
│   3. redirected to /runs/[submissionId]                                 │
│   4. timeline polls /api/intake/[id]/status every 1.5s                  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  intake-zero (Next.js 16 on Vercel Pro)                 │
│                                                                          │
│   app/                                                                   │
│     page.tsx                  public form                                │
│     runs/[runId]/page.tsx     prospect-visible timeline                  │
│     admin/                    cookie-gated submissions table             │
│     api/intake/route.ts       Zod validate → insert → workflow.start    │
│     api/intake/[id]/status    JSON { status } for polling                │
│     api/admin/signin          shared-secret cookie                      │
│                                                                          │
│   src/workflow/                                                          │
│     intake.ts                 "use workflow" orchestrator                │
│     steps/                                                               │
│       persist                 mark enriching                            │
│       enrich                  fetch URL + signals                       │
│       classify                Haiku → engagementType/fitScore           │
│       draft-triage            Sonnet → reply draft                      │
│       notify-owner            Resend → OWNER_EMAIL                       │
│       ack-prospect            Resend → prospect; mark sent              │
│                                                                          │
│   /.well-known/workflow/*     WDK runtime (mounted by withWorkflow)     │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Turso libsql                                  │
│   submissions                                                            │
│     id, run_id, status, email, name, company, role,                      │
│     problem, stack[], timeline, budget, url, dedupe_hash,                │
│     enrichment (json), classification (json), triage_draft,              │
│     created_at, updated_at                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Status state machine

```
received → enriching → classifying → drafting → notifying → sent
                                                              │
              (any step) ── RetryableError ──┐                │
                                              ▼               │
                                         WDK retries          │
                                              │               │
                                              ▼               │
              (any step) ── FatalError ──→ failed             │
                                                              ▼
                                                       prospect ack
```

---

## 4. Ordered work

What's done, what's next. Ordered, not calendared.

### Done

- v0.1 scaffold: Next.js 16 + WDK + Turso + Resend + Anthropic, typecheck + lint clean (`30bcd4d`)
- Drizzle schema + first migration generated
- Playwright config + 3 critical-path e2e specs (happy path, validation, admin gate)
- Project docs (this file, AGENTS.md, README.md, LICENSE)
- CI workflow (typecheck + lint + test on push/PR)
- Vitest unit tests for `parseClassification` (11 cases)
- Local smoke test caught + fixed the `/admin/signin` redirect-loop bug
- GitHub repo `zeroindex-ai/intake-zero` (public)
- Turso DB `intake-zero` provisioned (aws-us-east-1), creds stored in 1Password
- Vercel project linked to the LLC team, 8 prod env vars set (Turso non-Sensitive for pulls, rest Sensitive)
- First prod deploy at `intake-zero.vercel.app`, custom domain at `intake.zeroindex.ai`
- Live e2e: full pipeline reaches `sent` in 14–19s; row contains correct classification + populated draft
- Resend domain `zeroindex.ai` (apex) verified 2026-05-18; DKIM at `resend._domainkey`, SPF+MX at `send` subdomain (Resend's SES bounce-domain pattern keeps apex SPF untouched); `FROM_EMAIL` swapped to `intake@zeroindex.ai`; cross-address delivery confirmed (prospect-ack to Outlook, owner-notify to ZeroIndex inbox)
- Marketing site swap (2026-05-18, commit `045b62f` in zeroindexai): Contact CTA on zeroindex.ai now points to `https://intake.zeroindex.ai` instead of `mailto:hello@zeroindex.ai`; copy-email button retained as fallback
- Favicon wiring (2026-05-18): 5 `<link>` tags added to `app/layout.tsx` matching the canonical ZeroIndex pattern (same `[Z]` mark as all other properties — there's no per-service variant by convention)

### Next (real follow-ups)

1. **Visible workflow timing fix.** Run page polls every 1.5s — the `notifying` step often resolves in <1s, so users may see the transition flash. Consider a min-duration-per-step display or switch to WDK readable-stream-based updates.
2. **Shared Stack config.** `src/lib/stack.ts` holds the intake-side copy of the apex's tier 1 + tier 2 pills. The apex still hard-codes them in `zeroindexai/index.html` §Stack. Long-term: extract to a single shared source (small npm package `@zeroindex-ai/stack` or a JSON file consumed by both) so the apex marketing list and the intake picker can't drift. For now they're kept manually in sync.

### Deferred (v0.2+)

- WDK readable-stream-based live updates (replace polling)
- Magic-link admin auth
- Cal.com booking link auto-injected based on `fitScore ≥ 4`
- CSV export from `/admin`
- Per-source intake (e.g., separate URL for podcast inquiries with a different prompt)
- Vitest coverage for the workflow steps with the Anthropic SDK mocked
