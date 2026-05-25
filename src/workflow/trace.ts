// Per-model-call telemetry → traces.zeroindex.ai (trace-pack). One event per
// Claude call in the intake pipeline (classify on haiku, draft on sonnet), so
// trace-pack costs each at its own model rate — a single per-run event can't be
// costed because the run spans two models.
//
// Emitted from the "use step" layer (full Node.js), AWAITED and error-swallowed:
// awaited because a WDK step can suspend/tear down between steps, which makes a
// fire-and-forget keepalive POST unreliable; swallowed because a telemetry
// failure must NEVER throw inside a step (a RetryableError there would re-run
// the paid model call). Env-gated — a no-op unless TRACE_PACK_URL + _TOKEN are
// set, so it's inert in dev/CI/eval runs.

const SOURCE = process.env.TRACE_PACK_SOURCE ?? 'intake-zero';

// Structural subset of Anthropic's `Usage` — what trace-pack needs to cost a call.
export type ModelUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export type ModelEventInput = {
  step: string; // becomes trace-pack's `event` (e.g. 'classify', 'draft')
  model: string;
  status: 'ok' | 'error';
  submissionId: string;
  totalMs: number;
  usage?: ModelUsage | null;
  outcomeReason?: string; // failure label when status = error
  errorMessage?: string;
};

// trace-pack v0.2 generic-event shape (core fields camelCase; submissionId is an
// extension field preserved in raw_json via passthrough).
export function buildModelEvent(input: ModelEventInput) {
  return {
    source: SOURCE,
    event: input.step,
    ts: new Date().toISOString(),
    model: input.model,
    status: input.status,
    totalMs: input.totalMs,
    inputTokens: input.usage?.input_tokens ?? null,
    outputTokens: input.usage?.output_tokens ?? null,
    cacheCreationInputTokens: input.usage?.cache_creation_input_tokens ?? null,
    cacheReadInputTokens: input.usage?.cache_read_input_tokens ?? null,
    ...(input.outcomeReason ? { outcomeReason: input.outcomeReason } : {}),
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
    submissionId: input.submissionId,
  };
}

export async function emitModelEvent(input: ModelEventInput): Promise<void> {
  const url = process.env.TRACE_PACK_URL;
  const token = process.env.TRACE_PACK_TOKEN;
  if (!url || !token) return; // optional dependency; inert when unconfigured

  try {
    await fetch(`${url.replace(/\/$/, '')}/api/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(buildModelEvent(input)),
    });
  } catch (err) {
    // Telemetry is best-effort — never let it surface into the workflow step.
    console.warn('[intake-zero] trace-pack emit failed:', err instanceof Error ? err.message : err);
  }
}
