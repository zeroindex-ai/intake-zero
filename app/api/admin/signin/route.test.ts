import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ signIn: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }));

import { POST } from './route';
import { signIn } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

const okLimit = { ok: true, remaining: 9, retryAfterSec: 600 };

function post(token: string, headers: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set('token', token);
  return new Request('https://intake.zeroindex.ai/api/admin/signin', {
    method: 'POST',
    headers: { 'x-real-ip': '203.0.113.5', ...headers },
    body: fd,
  });
}

describe('POST /api/admin/signin', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockReset().mockResolvedValue(okLimit);
    vi.mocked(signIn).mockReset();
  });

  it('blocks once the per-IP cap is exceeded, without checking the token', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, remaining: 0, retryAfterSec: 300 });
    const res = await POST(post('anything'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/signin');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rate-limits per hashed IP (scope admin-signin)', async () => {
    await POST(post('x'));
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'admin-signin', limit: 10 }),
    );
  });

  it('redirects back to signin on a bad token', async () => {
    vi.mocked(signIn).mockResolvedValue(false);
    const res = await POST(post('bad-token'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/signin');
  });

  it('redirects to /admin on a valid token', async () => {
    vi.mocked(signIn).mockResolvedValue(true);
    const res = await POST(post('good-token'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/admin');
  });
});
