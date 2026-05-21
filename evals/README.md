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
little per run and is **manual / not wired into CI** (like ask-zeroindex's set).
Capture the pass rate as the baseline; re-run after prompt or model changes.

## Scope notes (v0.1, deliberately lean)

- `question` is just the problem text; structured `stack`/`timeline`/`budget` inputs
  aren't varied per item (the model still reads any budget/timeline mentioned inline).
- Classification uses custom checks (eval-pack is shaped for text answers; structured
  fields ride in `metadata`). An LLM judge (`@zeroindex-ai/eval-pack/judge-claude`) for
  draft *tone* is an easy future add — left out here to keep the run cheap and offline-ish.
