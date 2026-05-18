import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { start } from 'workflow/api';
import { intakeWorkflow } from '@/workflow/intake';

const Body = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(320),
  company: z.string().max(200).optional().default(''),
  role: z.string().max(120).optional().default(''),
  problem: z.string().min(20).max(8_000),
  url: z.string().url().max(2_048).optional().or(z.literal('')),
  stack: z.array(z.string().max(60)).max(20).default([]),
  timeline: z.string().max(60).optional().default(''),
  budget: z.string().max(60).optional().default(''),
});

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'invalid body', detail: String(err) }, { status: 400 });
  }

  const dedupeHash = createHash('sha256')
    .update(body.email.toLowerCase().trim())
    .update('|')
    .update(body.problem.trim())
    .digest('hex');

  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const existing = await db
    .select()
    .from(schema.submissions)
    .where(and(eq(schema.submissions.dedupeHash, dedupeHash), gt(schema.submissions.createdAt, cutoff)))
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
    problem: body.problem.trim(),
    stack: body.stack,
    timeline: body.timeline || null,
    budget: body.budget || null,
    url: body.url || null,
    dedupeHash,
    status: 'received',
  });

  const run = await start(intakeWorkflow, [{ submissionId: id }]);
  await db
    .update(schema.submissions)
    .set({ runId: run.runId, updatedAt: new Date() })
    .where(eq(schema.submissions.id, id));

  return NextResponse.json({ submissionId: id, runId: run.runId });
}
