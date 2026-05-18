import { NextResponse } from 'next/server';
import { signIn } from '@/lib/auth';

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get('token') ?? '');
  const ok = await signIn(token);
  if (!ok) {
    return NextResponse.redirect(new URL('/signin?error=1', req.url), { status: 303 });
  }
  return NextResponse.redirect(new URL('/admin', req.url), { status: 303 });
}
