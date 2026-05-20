import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { checkRateLimit, sweepExpiredRateLimits } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';
import { start } from 'workflow/api';
import { intakeWorkflow } from '@/workflow/intake';

const Body = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(320),
  company: z.string().max(200).optional().default(''),
  role: z.string().max(120).optional().default(''),
  phone: z.string().max(40).optional().default(''),
  problem: z.string().min(20).max(8_000),
  url: z.string().url().max(2_048).optional().or(z.literal('')),
  stack: z.array(z.string().max(60)).max(20).default([]),
  timeline: z.string().max(60).optional().default(''),
  budget: z.string().max(60).optional().default(''),
});

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
// The form payload is tiny (problem caps at 8k chars); anything larger is abuse.
// Cap before buffering so a huge body can't be read into memory pre-auth.
const MAX_BODY_BYTES = 32 * 1024;

// Per-IP cap protects the founder's inbox and the LLM/email budget from a
// single source; per-email cap stops one prospect from flooding regardless of
// source IP. The IP comes from the platform-trusted x-real-ip (see clientIp),
// not a caller-spoofable x-forwarded-for hop. The 24h dedupe hash is NOT a rate
// limit — it only collapses identical resubmissions and is trivially defeated
// by varying one character.
const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function rateLimited(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'rate limited' },
    { status: 429, headers: { 'retry-after': String(retryAfterSec) } },
  );
}

export async function POST(req: Request) {
  // Per-IP cap first (hashed — no raw IP is persisted), before any body work.
  const ipLimit = await checkRateLimit({
    scope: 'intake-ip',
    identifier: hash(clientIp(req)),
    limit: IP_LIMIT,
    windowMs: HOUR_MS,
  });
  if (!ipLimit.ok) return rateLimited(ipLimit.retryAfterSec);

  // Opportunistically prune expired buckets (~2% of requests) so rate_limits
  // doesn't grow unbounded; a cheap DELETE at this volume.
  if (Math.random() < 0.02) await sweepExpiredRateLimits();

  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  let body: z.infer<typeof Body>;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'payload too large' }, { status: 413 });
    }
    body = Body.parse(JSON.parse(raw));
  } catch (err) {
    console.error('intake: invalid body', err);
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const emailLimit = await checkRateLimit({
    scope: 'intake-email',
    identifier: hash(body.email.toLowerCase().trim()),
    limit: EMAIL_LIMIT,
    windowMs: HOUR_MS,
  });
  if (!emailLimit.ok) return rateLimited(emailLimit.retryAfterSec);

  const dedupeHash = createHash('sha256')
    .update(body.email.toLowerCase().trim())
    .update('|')
    .update(body.problem.trim())
    .digest('hex');

  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const existing = await db
    .select()
    .from(schema.submissions)
    .where(
      and(eq(schema.submissions.dedupeHash, dedupeHash), gt(schema.submissions.createdAt, cutoff)),
    )
    .limit(1);

  if (existing[0]) {
    return NextResponse.json({ submissionId: existing[0].id, deduped: true });
  }

  const id = randomUUID();
  await db.insert(schema.submissions).values({
    id,
    email: body.email.trim(),
    name: body.name.trim(),
    company: body.company || null,
    role: body.role || null,
    phone: body.phone.trim() || null,
    problem: body.problem.trim(),
    stack: body.stack,
    timeline: body.timeline || null,
    budget: body.budget || null,
    url: body.url || null,
    dedupeHash,
    status: 'received',
  });

  let run: Awaited<ReturnType<typeof start>>;
  try {
    run = await start(intakeWorkflow, [{ submissionId: id }]);
  } catch (err) {
    // If the workflow never starts, the row would otherwise strand at
    // 'received' forever (the orchestrator's markFailed never runs). Mark it
    // failed here so it surfaces as a failure rather than a silent stall.
    console.error('intake: workflow start failed', err);
    await db
      .update(schema.submissions)
      .set({ status: 'failed', failedAtStep: 'received', updatedAt: new Date() })
      .where(eq(schema.submissions.id, id));
    return NextResponse.json({ error: 'could not start processing' }, { status: 500 });
  }

  await db
    .update(schema.submissions)
    .set({ runId: run.runId, updatedAt: new Date() })
    .where(eq(schema.submissions.id, id));

  return NextResponse.json({ submissionId: id, runId: run.runId });
}
