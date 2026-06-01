# intake-zero — agent guide

Claude-backed prospect intake for the ZeroIndex consultancy. A public form at
`intake.zeroindex.ai` collects project inquiries; a durable Vercel Workflow DevKit
pipeline persists, enriches, classifies, drafts a triage reply, and notifies.

The *why* and the architecture live in `PROJECT.md`. This file is how to work here.

## Guardrails (do not violate)

- **Never commit secrets.** `.env.local` and real Turso/Anthropic/Resend/etc. keys
  stay out of git (`.gitignore` covers them — double-check before `git add -A`).
- **Public repo → sanitize docs.** No machine paths, vault names, private-memory
  refs, or sprint/portfolio framing in any committed `.md`. The `md-review-gate`
  hook enforces this at commit time.
- **Branch before the first commit.** Run `git branch` and confirm — repos are
  sometimes left on an in-flight feature branch. Don't assume `main`.
- **Visual changes: preview before commit.** Run the dev server and get a human
  eyeball/approval BEFORE committing UI changes. Non-visual changes follow normal flow.
- **Scope UI edits to the named element.** "Make X taller" changes only X. Decouple
  shared tokens first; don't grow siblings.
- **Admin stays Basic Auth.** `/admin` is gated by root `proxy.ts` (Basic Auth,
  `ADMIN_PASSWORD` + `timingSafeEqual`). Do NOT add a signin page, cookie, or users
  table until there's a second admin user.
- **Public endpoints need rate limiting + SSRF guards** (P0). A dedupe hash is not a
  rate limit.

## Commands

```bash
pnpm dev          # local dev (localhost:3000)
pnpm test         # vitest run
pnpm test:e2e     # playwright (boots dev server)
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm build        # next build (also the CI gate)
pnpm eval         # tsx evals/run.ts
pnpm db:generate  # drizzle-kit: generate a migration from schema changes
pnpm db:migrate   # apply migrations (local, --env-file=.env.local)
```

## Conventions & gotchas

- **Lazy `db()` singleton.** The libsql client + strict `env()` init are deferred to
  first request, NOT module load — a top-level `env()` makes `next build` require
  runtime secrets and preview deploys fail. Keep DB access behind the lazy proxy.
- **libsql on Vercel needs the undici fetch workaround.** Vercel's fetch
  instrumentation corrupts libsql's request ("expected non-null body source"); the
  client passes `undici`'s `fetch` (decomposed to url+init). Don't replace it with
  the global fetch.
- **Stale CSS after a `globals.css` edit** = Next 16 + Turbopack caching. `rm -rf
  .next` + restart dev (hard-refresh/incognito won't fix it).
- **Favicon lives in `app/favicon.ico`**, not `public/` (the app router intercepts it).
- **SSR everything** — no client-side data fetches for first paint; render on the server.

## Where to look

- `PROJECT.md` — why it exists, decisions, architecture, the public contract.
- Chrome/layout: the `zeroindex-app-layout` skill (canonical header/footer/spacing).
- Design tokens: `STYLE_GUIDE.md` in the `zeroindex-site` repo (mirrored in
  `app/globals.css`). Don't invent colors.
- Deploy: the `deploy-zeroindex-vercel-app` skill (Turso → Vercel env → migrations → domain).

## AI pipeline

- **Eval harness is the contract for quality.** `pnpm eval` runs the golden set;
  don't change retrieval/prompts/models without re-running it. Record the headline
  metric in PROJECT.md.
- **Model picks are deliberate and documented** in PROJECT.md's decision log — pick by
  eval, not vibe. `claude-haiku-4-5` for classification, `claude-sonnet-4-6` for the
  triage draft. Prompt caching where it helps.
- **Cited output must be escaped** — HTML-escape any model text rendered to the page
  (five-entity coverage).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# This is NOT the Workflow DevKit you guessed at

Vercel's Workflow DevKit (`workflow` on npm) is unfamiliar to most training data. **Before writing any WDK code, read the bundled docs in `node_modules/workflow/docs/`** — especially:

- `getting-started/next.mdx` — `withWorkflow(nextConfig)` wraps `next.config.ts`. The WDK auto-mounts its runtime at `/.well-known/workflow/*`. **Do not** create an `app/api/workflow/[...slug]/route.ts` — that was an early scaffolding mistake; the package's `next` entry is a Next config plugin, not an API handler.
- `api-reference/workflow-api/start.mdx` — `start(workflow, [arg1, arg2], options?)`. Arguments are passed as an **array** (positional), not as a single object.
- `foundations/workflows-and-steps.mdx` — orchestration in `"use workflow"`, side effects in `"use step"`. Steps get full Node.js; workflows run in a sandboxed VM and have a tiny stdlib.
- `errors/` — distinguish `FatalError` (don't retry, bad input) from `RetryableError` (transient, will be retried by the runtime).

# Style / palette

Source of truth is `STYLE_GUIDE.md` in the `zeroindex-site` repo. Local mirror is `app/globals.css` (CSS variables) and `src/lib/palette.ts` (TS constants). Do not invent colors; reuse tokens.

# Deploy

Follow `deploy-zeroindex-vercel-app` skill verbatim. Turso → Vercel env vars → migrations → custom domain (`intake.zeroindex.ai`) → Cloudflare CNAME. The marketing-site `mailto:` swap lives in the Astro `zeroindex-site` apex repo (the Contact CTA component, not a single `index.html`) and is hand-driven after deploy is verified.

# What not to do

- Don't add a CRM/Stripe integration in v0.1 — Turso is the system of record.
- Don't replace the single-secret admin Basic Auth gate (root `proxy.ts`) with full magic-link auth until there's a second admin user.
- Don't sweep visual changes; intake-zero shares tokens with the rest of the ZeroIndex sites — fix the named element only.
- Don't commit `.env.local` or any real Turso/Anthropic/Resend keys. The `.gitignore` already protects this; double-check before `git add -A`.
