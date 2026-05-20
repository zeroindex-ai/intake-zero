import { lt, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export type RateLimitRule = {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

// Deterministic bucket key for a fixed window: same (scope, identifier) maps to
// the same bucket for the whole window, then rolls over. Exported for testing.
export function bucketKey(
  scope: string,
  identifier: string,
  windowMs: number,
  now: number,
): string {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return `${scope}:${identifier}:${windowStart}`;
}

// Fixed-window counter backed by the rate_limits table. Atomically upserts and
// increments the bucket, then compares against the limit. One row per window;
// rows carry an expiry so a periodic sweep (or expired-row reuse) keeps the
// table small.
export async function checkRateLimit(
  rule: RateLimitRule,
  now = Date.now(),
): Promise<RateLimitResult> {
  const bucket = bucketKey(rule.scope, rule.identifier, rule.windowMs, now);
  const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
  const expiresAt = new Date(windowStart + rule.windowMs);

  const [row] = await db
    .insert(schema.rateLimits)
    .values({ bucket, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: schema.rateLimits.bucket,
      set: { count: sql`${schema.rateLimits.count} + 1` },
    })
    .returning({ count: schema.rateLimits.count });

  const count = row?.count ?? 1;
  const retryAfterSec = Math.ceil((windowStart + rule.windowMs - now) / 1000);
  return {
    ok: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSec,
  };
}

// Best-effort cleanup of expired buckets. Safe to call opportunistically.
export async function sweepExpiredRateLimits(now = Date.now()): Promise<void> {
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.expiresAt, new Date(now)));
}
