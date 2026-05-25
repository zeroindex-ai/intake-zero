import { describe, it, expect, vi, beforeEach } from 'vitest';

const { selectLimit, insertValues, updateSet, updateWhere, start } = vi.hoisted(() => ({
  selectLimit: vi.fn(),
  insertValues: vi.fn().mockResolvedValue(undefined),
  updateSet: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
  start: vi.fn(),
}));

vi.mock('@/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
    insert: () => ({ values: insertValues }),
    update: () => ({
      set: (values: unknown) => {
        updateSet(values);
        return { where: updateWhere };
      },
    }),
  },
  schema: { submissions: { id: 'id', dedupeHash: 'dedupe_hash', createdAt: 'created_at' } },
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  sweepExpiredRateLimits: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('workflow/api', () => ({ start }));
vi.mock('@/workflow/intake', () => ({ intakeWorkflow: 'WF' }));

import { POST } from './route';
import { checkRateLimit, sweepExpiredRateLimits } from '@/lib/rate-limit';

const okLimit = { ok: true, remaining: 5, retryAfterSec: 3600, firstInWindow: false };
const valid = { name: 'Dana', email: 'dana@example.com', problem: 'x'.repeat(40) };

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://intake.zeroindex.ai/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/intake', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockReset().mockResolvedValue(okLimit);
    vi.mocked(sweepExpiredRateLimits).mockClear();
    selectLimit.mockReset().mockResolvedValue([]);
    insertValues.mockClear();
    updateSet.mockClear();
    updateWhere.mockClear();
    start.mockReset().mockResolvedValue({ runId: 'wrun_test' });
  });

  it('returns a generic 400 (no Zod detail) on an invalid body', async () => {
    const res = await POST(post({ name: 'x', email: 'not-email', problem: 'short' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid body' });
    expect(start).not.toHaveBeenCalled();
  });

  it('returns 429 with retry-after when the per-IP cap is exceeded', async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (rule) =>
      rule.scope === 'intake-ip'
        ? { ok: false, remaining: 0, retryAfterSec: 1200, firstInWindow: false }
        : okLimit,
    );
    const res = await POST(post(valid));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('1200');
    expect(start).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-email cap is exceeded', async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (rule) =>
      rule.scope === 'intake-email'
        ? { ok: false, remaining: 0, retryAfterSec: 600, firstInWindow: false }
        : okLimit,
    );
    const res = await POST(post(valid));
    expect(res.status).toBe(429);
    expect(start).not.toHaveBeenCalled();
  });

  it('dedupes a repeat submission within the window without starting a workflow', async () => {
    selectLimit.mockResolvedValue([{ id: 'existing-id' }]);
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ submissionId: 'existing-id', deduped: true });
    expect(insertValues).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    // a deduped resubmit must not consume the per-email quota
    expect(checkRateLimit).not.toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'intake-email' }),
    );
  });

  it('persists, starts the workflow, and returns ids on a fresh submission', async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.runId).toBe('wrun_test');
    expect(typeof json.submissionId).toBe('string');
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('sweeps expired buckets deterministically when the IP opens a fresh window', async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (rule) =>
      rule.scope === 'intake-ip' ? { ...okLimit, firstInWindow: true } : okLimit,
    );
    await POST(post(valid));
    expect(sweepExpiredRateLimits).toHaveBeenCalledTimes(1);
  });

  it('does not sweep mid-window (no random trigger)', async () => {
    // firstInWindow is false for every limiter call, so the sweep never runs.
    await POST(post(valid));
    expect(sweepExpiredRateLimits).not.toHaveBeenCalled();
  });

  it('rejects an oversized body with 413 before buffering it', async () => {
    const res = await POST(post('x'.repeat(40_000)));
    expect(res.status).toBe(413);
    expect(start).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('marks the row failed and returns 500 if the workflow cannot start', async () => {
    start.mockRejectedValue(new Error('wdk infra down'));
    const res = await POST(post(valid));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'could not start processing' });
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(updateWhere).toHaveBeenCalled(); // the mark-failed update ran
  });

  it('writes status=failed at the received step when start() rejects', async () => {
    // The success path also issues an UPDATE (to set runId), so asserting that
    // *some* update ran isn't enough — pin the actual payload to prove the row
    // is moved to 'failed' rather than silently stranded at 'received'.
    start.mockRejectedValue(new Error('wdk infra down'));
    await POST(post(valid));
    expect(start).toHaveBeenCalledTimes(1);
    // The mark-failed branch issues exactly one UPDATE and never reaches the
    // runId update, so the only captured payload is the failure write.
    expect(updateSet).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', failedAtStep: 'received' }),
    );
  });
});
