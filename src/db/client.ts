import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '@/lib/env';
import * as schema from './schema';

const makeDb = () =>
  drizzle(createClient({ url: env().TURSO_DATABASE_URL, authToken: env().TURSO_AUTH_TOKEN }), {
    schema,
  });

type DB = ReturnType<typeof makeDb>;

let instance: DB | null = null;

function getDb(): DB {
  if (!instance) instance = makeDb();
  return instance;
}

// Lazy proxy: the libsql client and the strict env() validation are deferred to
// first use at request time, NOT module load. `next build` imports route
// modules to collect page data, so a top-level env() call would force the build
// to require runtime secrets — which is why preview deployments (production-only
// Sensitive vars absent) failed env validation at build time. The proxy keeps
// `db.select()/insert()/...` working unchanged for every caller.
export const db = new Proxy({} as DB, {
  get(_target, prop: string | symbol) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value;
  },
});

export { schema };
