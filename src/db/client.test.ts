import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';

// NOTE: this file intentionally does NOT mock '@/db/client' — it exercises the
// real lazy proxy against an in-memory libsql database.

const RUNTIME_VARS = [
  'TURSO_DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'OWNER_EMAIL',
  'FROM_EMAIL',
  'PUBLIC_BASE_URL',
];

describe('db client', () => {
  // These tests mutate process.env; snapshot and fully restore so nothing
  // bleeds into other (parallel) test files.
  let savedEnv: NodeJS.ProcessEnv;
  beforeEach(() => {
    savedEnv = { ...process.env };
  });
  afterEach(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, savedEnv);
  });

  it('imports without requiring runtime secrets (build-safe lazy init)', async () => {
    // With every runtime var stripped, importing must not call env()/throw —
    // this is what lets `next build` collect page data without prod secrets.
    for (const k of RUNTIME_VARS) delete process.env[k];
    const mod = await import('@/db/client');
    expect(mod.db).toBeDefined();
    expect(mod.schema.rateLimits).toBeDefined();
  });

  it('lazily connects on first use and round-trips a query through the proxy', async () => {
    process.env.TURSO_DATABASE_URL = 'file::memory:?cache=shared';
    process.env.ANTHROPIC_API_KEY = 'x';
    process.env.RESEND_API_KEY = 'x';
    process.env.OWNER_EMAIL = 'a@b.co';
    process.env.FROM_EMAIL = 'a@b.co';
    process.env.PUBLIC_BASE_URL = 'http://localhost';

    const { db, schema } = await import('@/db/client');
    await db.run(
      sql`CREATE TABLE IF NOT EXISTS rate_limits (bucket text primary key, count integer not null default 0, expires_at integer not null)`,
    );
    await db
      .insert(schema.rateLimits)
      .values({ bucket: 'k', count: 3, expiresAt: new Date(1_000) });
    const rows = await db.select().from(schema.rateLimits);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.count).toBe(3);
  });
});
