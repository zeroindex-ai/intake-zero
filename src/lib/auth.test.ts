import { describe, it, expect, vi } from 'vitest';

const { envFn } = vi.hoisted(() => ({ envFn: vi.fn() }));

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('./env', () => ({ env: envFn }));

import { sessionToken } from './auth';

describe('sessionToken', () => {
  it('derives a stable 64-char hex token from the admin secret', () => {
    envFn.mockReturnValue({ ADMIN_TOKEN: 'a'.repeat(40) });
    const t1 = sessionToken();
    const t2 = sessionToken();
    expect(t1).toMatch(/^[0-9a-f]{64}$/);
    expect(t1).toBe(t2);
  });

  it('is not the raw secret (so a stolen cookie is not the master credential)', () => {
    const secret = 'b'.repeat(40);
    envFn.mockReturnValue({ ADMIN_TOKEN: secret });
    expect(sessionToken()).not.toBe(secret);
  });

  it('changes when the admin secret changes', () => {
    envFn.mockReturnValue({ ADMIN_TOKEN: 'a'.repeat(40) });
    const a = sessionToken();
    envFn.mockReturnValue({ ADMIN_TOKEN: 'c'.repeat(40) });
    const b = sessionToken();
    expect(a).not.toBe(b);
  });
});
