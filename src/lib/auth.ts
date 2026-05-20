import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env';

const COOKIE = 'iz_admin';

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// The cookie stores a value DERIVED from the admin secret, never the secret
// itself — so a stolen cookie can't be replayed as the master credential
// (e.g. against any future API that authenticates with the raw token).
export function sessionToken(): string {
  return createHmac('sha256', env().ADMIN_TOKEN).update('iz-admin-session-v1').digest('hex');
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  return safeEq(token, sessionToken());
}

export async function signIn(submittedToken: string): Promise<boolean> {
  if (!safeEq(submittedToken, env().ADMIN_TOKEN)) return false;
  const jar = await cookies();
  jar.set(COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
