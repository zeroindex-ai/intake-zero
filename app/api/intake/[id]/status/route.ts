import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select({
      status: schema.submissions.status,
      failedAtStep: schema.submissions.failedAtStep,
      updatedAt: schema.submissions.updatedAt,
    })
    .from(schema.submissions)
    .where(eq(schema.submissions.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({
    status: row.status,
    failedAtStep: row.failedAtStep,
    updatedAt: row.updatedAt,
  });
}
