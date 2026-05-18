'use step';

import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { FatalError } from 'workflow';

export async function persistSubmission(submissionId: string) {
  const [row] = await db
    .update(schema.submissions)
    .set({ status: 'enriching', updatedAt: new Date() })
    .where(eq(schema.submissions.id, submissionId))
    .returning();

  if (!row) throw new FatalError(`submission ${submissionId} not found`);
  return row;
}
