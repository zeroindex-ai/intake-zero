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
});
