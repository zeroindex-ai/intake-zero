import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildModelEvent, emitModelEvent, type ModelEventInput } from './trace';

const okInput: ModelEventInput = {
  step: 'classify',
  model: 'claude-haiku-4-5-20251001',
  status: 'ok',
  submissionId: 'sub_123',
  totalMs: 842,
  usage: {
    input_tokens: 1200,
    output_tokens: 340,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 800,
  },
};

describe('buildModelEvent', () => {
  it('emits the trace-pack generic-event core with the step as the event type', () => {
    const e = buildModelEvent(okInput);
    expect(e.source).toBe('intake-zero');
    expect(e.event).toBe('classify');
    expect(e.status).toBe('ok');
    expect(e.model).toBe('claude-haiku-4-5-20251001');
    expect(e.totalMs).toBe(842);
    expect(typeof e.ts).toBe('string');
    expect(e.submissionId).toBe('sub_123'); // extension field (raw_json passthrough)
    expect(e).not.toHaveProperty('outcomeReason');
    expect(e).not.toHaveProperty('errorMessage');
  });

  it('maps token usage (incl. cache classes) so trace-pack can cost the call', () => {
    const e = buildModelEvent(okInput);
    expect(e.inputTokens).toBe(1200);
    expect(e.outputTokens).toBe(340);
    expect(e.cacheCreationInputTokens).toBe(0);
    expect(e.cacheReadInputTokens).toBe(800);
  });

  it('nulls token fields when usage is absent (e.g. a transient API error)', () => {
    const e = buildModelEvent({
      ...okInput,
      status: 'error',
      usage: null,
      outcomeReason: 'api_error',
    });
    expect(e.status).toBe('error');
    expect(e.outcomeReason).toBe('api_error');
    expect(e.inputTokens).toBeNull();
    expect(e.outputTokens).toBeNull();
  });
});

describe('emitModelEvent', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    process.env.TRACE_PACK_URL = 'https://traces.example.com/';
    process.env.TRACE_PACK_TOKEN = 'tok_test';
  });
  afterEach(() => {
    delete process.env.TRACE_PACK_URL;
    delete process.env.TRACE_PACK_TOKEN;
    global.fetch = originalFetch;
  });

  it('POSTs to /api/ingest with bearer auth and the generic event body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    global.fetch = fetchMock;
    await emitModelEvent(okInput);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://traces.example.com/api/ingest'); // trailing slash stripped
    expect(init.headers.authorization).toBe('Bearer tok_test');
    const body = JSON.parse(init.body as string);
    expect(body.event).toBe('classify');
    expect(body.inputTokens).toBe(1200);
  });

  it('is a no-op when TRACE_PACK env is unset', async () => {
    delete process.env.TRACE_PACK_URL;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    await emitModelEvent(okInput);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows fetch errors — telemetry never throws into the workflow step', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(emitModelEvent(okInput)).resolves.toBeUndefined();
  });
});
