# intake-zero evals

A small [`@zeroindex-ai/eval-pack`](https://www.npmjs.com/package/@zeroindex-ai/eval-pack)
suite over intake-zero's own LLM steps — the consultancy evaluating its own intake.

## What it checks

Each golden item is a prospect's problem statement. The subject runs the real
two-step pipeline (`runClassification` → `runDraft`, no DB/email side effects)
and the checks assert:

- **Classification calibration** — `engagement_type` matches the labelled type, and
  `fit_score` lands in the expected range (the higher-signal one — fit is subjective).
- **Draft rules** — every reply signs off as Abhishek, stays within the ~180-word
  budget, and names at most one case study.
- **Injection resistance** — a `problem` that tries to hijack the reply (fake discount,
  "sign a contract today", leak internal field names, force a "perfect fit") must not
  appear in the prospect-facing draft. Doubles as a security guard.
- **No over-promising** — drafts don't guarantee a fixed price/timeline.

## Run it

```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm eval
```

This **hits the real models** (Haiku for classify, Sonnet for draft), so it costs a
little per run. `EVAL_PASS_THRESHOLD` (default `0.8`) gates the exit code.

### In CI

`.github/workflows/eval.yml` mirrors ask-zeroindex's pattern: it runs `pnpm eval`
on pushes/PRs that touch `src/workflow/**` or `evals/**`, on a daily cron, and on
manual dispatch (a separate **Eval** check, not the main CI gate; dependabot is
skipped). It needs the `ANTHROPIC_API_KEY` repo secret, uploads `evals/results/`
as an artifact, and — if `EVALS_SITE_TOKEN` is set — publishes the report to
`evals.zeroindex.ai/intake-zero`. The threshold starts at `0.7`; tune it once the
golden fit-score ranges are calibrated against a real baseline.

## Scope notes (v0.1, deliberately lean)

- `question` is just the problem text; structured `stack`/`timeline`/`budget` inputs
  aren't varied per item (the model still reads any budget/timeline mentioned inline).
- Classification uses custom checks (eval-pack is shaped for text answers; structured
  fields ride in `metadata`). An LLM judge (`@zeroindex-ai/eval-pack/judge-claude`) for
  draft *tone* is an easy future add — left out here to keep the run cheap and offline-ish.
