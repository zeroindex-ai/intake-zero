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

Source of truth is `STYLE_GUIDE.md` in the `zeroindexai` repo. Local mirror is `app/globals.css` (CSS variables) and `src/lib/palette.ts` (TS constants). Do not invent colors; reuse tokens.

# Deploy

Follow `deploy-zeroindex-vercel-app` skill verbatim. Turso → Vercel env vars → migrations → custom domain (`intake.zeroindex.ai`) → Cloudflare CNAME. The marketing-site `mailto:` swap in `zeroindexai/index.html:955` is hand-driven after deploy is verified.

# What not to do

- Don't add a CRM/Stripe integration in v0.1 — Turso is the system of record.
- Don't replace the single-secret admin Basic Auth gate (root `proxy.ts`) with full magic-link auth until there's a second admin user.
- Don't sweep visual changes; intake-zero shares tokens with the rest of the ZeroIndex sites — fix the named element only.
- Don't commit `.env.local` or any real Turso/Anthropic/Resend keys. The `.gitignore` already protects this; double-check before `git add -A`.
