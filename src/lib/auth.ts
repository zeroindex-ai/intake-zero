import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { env } from './env';

const COOKIE = 'iz_admin';

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  return safeEq(token, env().ADMIN_TOKEN);
}

export async function signIn(submittedToken: string): Promise<boolean> {
  if (!safeEq(submittedToken, env().ADMIN_TOKEN)) return false;
  const jar = await cookies();
  jar.set(COOKIE, submittedToken, {
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
