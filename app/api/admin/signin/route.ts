import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { signIn } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';

// Tight per-IP cap on the credential endpoint to blunt token brute-forcing.
// The admin token is already a 32+ char timing-safe secret, so this is
// defense-in-depth, not the primary control.
const SIGNIN_LIMIT = 10;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function POST(req: Request) {
  const limit = await checkRateLimit({
    scope: 'admin-signin',
    identifier: hash(clientIp(req)),
    limit: SIGNIN_LIMIT,
    windowMs: WINDOW_MS,
  });
  // Redirect (not 429) on a form POST so the browser lands back on the page;
  // we don't reveal rate-limit state to a brute-forcer (same as a bad token).
  if (!limit.ok) {
    return NextResponse.redirect(new URL('/signin?error=1', req.url), { status: 303 });
  }

  const form = await req.formData();
  const token = String(form.get('token') ?? '');
  const ok = await signIn(token);
  if (!ok) {
    return NextResponse.redirect(new URL('/signin?error=1', req.url), { status: 303 });
  }
  return NextResponse.redirect(new URL('/admin', req.url), { status: 303 });
}
