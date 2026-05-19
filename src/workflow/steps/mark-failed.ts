'use step';

import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export async function markFailed(submissionId: string, message: string) {
  // Capture the in-flight status so the run-page timeline can render the
  // failing step with a red X instead of going all-gray.
  const [current] = await db
    .select({ status: schema.submissions.status })
    .from(schema.submissions)
    .where(eq(schema.submissions.id, submissionId))
    .limit(1);

  await db
    .update(schema.submissions)
    .set({
      status: 'failed',
      failedAtStep: current?.status ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.submissions.id, submissionId));
  return { submissionId, status: 'failed' as const, message: message.slice(0, 500) };
}
