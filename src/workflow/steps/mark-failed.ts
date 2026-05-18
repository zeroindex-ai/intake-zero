'use step';

import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export async function markFailed(submissionId: string, message: string) {
  await db
    .update(schema.submissions)
    .set({ status: 'failed', updatedAt: new Date() })
    .where(eq(schema.submissions.id, submissionId));
  return { submissionId, status: 'failed' as const, message: message.slice(0, 500) };
}
