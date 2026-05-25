import { describe, it, expect, vi, beforeEach } from 'vitest';

const { returning, insert } = vi.hoisted(() => {
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return { returning, values, onConflictDoUpdate, insert };
});

vi.mock('@/db/client', () => ({
  db: { insert },
  schema: { rateLimits: { bucket: 'bucket', count: 'count', expiresAt: 'expires_at' } },
}));

import { bucketKey, checkRateLimit } from './rate-limit';

describe('bucketKey', () => {
  it('is stable within a window and rolls over at the boundary', () => {
    const windowMs = 60_000;
    const a = bucketKey('ip', 'x', windowMs, 1_000);
    const b = bucketKey('ip', 'x', windowMs, 59_999);
    const c = bucketKey('ip', 'x', windowMs, 60_000);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('separates scopes and identifiers', () => {
    expect(bucketKey('ip', 'x', 1000, 0)).not.toBe(bucketKey('email', 'x', 1000, 0));
    expect(bucketKey('ip', 'x', 1000, 0)).not.toBe(bucketKey('ip', 'y', 1000, 0));
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => returning.mockReset());

  it('allows requests up to the limit', async () => {
    returning.mockResolvedValue([{ count: 5 }]);
    const res = await checkRateLimit({ scope: 'ip', identifier: 'a', limit: 5, windowMs: 60_000 });
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(0);
  });

  it('blocks once the count exceeds the limit', async () => {
    returning.mockResolvedValue([{ count: 6 }]);
    const res = await checkRateLimit({ scope: 'ip', identifier: 'a', limit: 5, windowMs: 60_000 });
    expect(res.ok).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.retryAfterSec).toBeGreaterThan(0);
  });

  it('reports remaining quota below the limit', async () => {
    returning.mockResolvedValue([{ count: 2 }]);
    const res = await checkRateLimit({
      scope: 'email',
      identifier: 'b',
      limit: 5,
      windowMs: 60_000,
    });
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(3);
  });

  it('flags the first request in a fresh window and resets the count on rollover', async () => {
    const windowMs = 60_000;
    const rule = { scope: 'ip', identifier: 'a', limit: 5, windowMs };

    // First request of a window: the upsert inserts the bucket with count 1.
    // A new window therefore starts the count over and signals firstInWindow,
    // the deterministic trigger the route uses to sweep expired buckets.
    returning.mockResolvedValue([{ count: 1 }]);
    const opening = await checkRateLimit(rule, 0);
    expect(opening.firstInWindow).toBe(true);
    expect(opening.ok).toBe(true);
    expect(opening.remaining).toBe(4);

    // Subsequent requests in the same window increment the existing bucket —
    // not first-in-window, so no sweep is triggered.
    returning.mockResolvedValue([{ count: 2 }]);
    const second = await checkRateLimit(rule, 30_000);
    expect(second.firstInWindow).toBe(false);

    // Crossing the window boundary maps to a new bucket whose count starts at 1
    // again, so the count resets and firstInWindow fires once more.
    expect(bucketKey('ip', 'a', windowMs, 30_000)).not.toBe(
      bucketKey('ip', 'a', windowMs, windowMs),
    );
    returning.mockResolvedValue([{ count: 1 }]);
    const rolledOver = await checkRateLimit(rule, windowMs);
    expect(rolledOver.firstInWindow).toBe(true);
    expect(rolledOver.remaining).toBe(4);
  });
});

describe('sweepExpiredRateLimits', () => {
  it('issues a delete keyed on the expiry cutoff', async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn(() => ({ where }));
    vi.resetModules();
    vi.doMock('@/db/client', () => ({
      db: { delete: del },
      schema: { rateLimits: { bucket: 'bucket', count: 'count', expiresAt: 'expires_at' } },
    }));
    const mod = await import('./rate-limit');
    await mod.sweepExpiredRateLimits(123_456);
    expect(del).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    vi.doUnmock('@/db/client');
    vi.resetModules();
  });
});
