import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { fetch as undiciFetch } from 'undici';
import { env } from '@/lib/env';
import * as schema from './schema';

// libsql's hrana HTTP client calls fetch(new Request(...)) using the GLOBAL
// Request. On Vercel the global fetch is wrapped by runtime instrumentation that
// corrupts that request's body during a Server Component render ("fetch failed:
// expected non-null body source"). Route libsql through undici directly to dodge
// the instrumented global. undici won't accept a *global* Request object (it
// stringifies it → "Failed to parse URL from [object Request]"), so decompose it
// into url + init, buffering the body (sidesteps stream/duplex).
async function libsqlFetch(input: Request | string | URL, init?: RequestInit): Promise<Response> {
  if (input instanceof Request) {
    const hasBody = input.method !== 'GET' && input.method !== 'HEAD';
    const body = hasBody ? await input.arrayBuffer() : undefined;
    return undiciFetch(input.url, {
      method: input.method,
      headers: Object.fromEntries(input.headers.entries()),
      ...(body !== undefined ? { body } : {}),
    }) as unknown as Response;
  }
  return undiciFetch(input as never, init as never) as unknown as Response;
}

const makeDb = () =>
  drizzle(
    createClient({
      url: env().TURSO_DATABASE_URL,
      authToken: env().TURSO_AUTH_TOKEN,
      fetch: libsqlFetch as unknown as typeof globalThis.fetch,
    }),
    {
      schema,
    },
  );

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
