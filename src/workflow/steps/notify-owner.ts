'use step';

import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { ClassificationResult, EnrichmentResult, Submission } from '@/db/schema';
import { resend } from '@/email/resend';
import { OwnerNotify } from '@/email/templates/owner-notify';
import { env } from '@/lib/env';
import { RetryableError } from 'workflow';

type NotifyInput = {
  submissionId: string;
  submission: Submission;
  enrichment: EnrichmentResult;
  classification: ClassificationResult;
  triage: string;
};

export async function notifyOwner(input: NotifyInput) {
  try {
    await resend().emails.send(
      {
        from: env().FROM_EMAIL,
        to: env().OWNER_EMAIL,
        replyTo: input.submission.email,
        subject: `[intake] ${input.classification.engagementType} · fit ${input.classification.fitScore}/5 · ${input.submission.name}`,
        react: OwnerNotify({
          submission: input.submission,
          enrichment: input.enrichment,
          classification: input.classification,
          triage: input.triage,
          baseUrl: env().PUBLIC_BASE_URL,
        }),
      },
      // Idempotency key: if WDK retries/replays this step after a successful
      // send, Resend dedupes on the key rather than emailing the owner twice.
      { idempotencyKey: `owner-notify-${input.submissionId}` },
    );
  } catch (err) {
    throw new RetryableError(
      `resend owner failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  await db
    .update(schema.submissions)
    .set({ updatedAt: new Date() })
    .where(eq(schema.submissions.id, input.submissionId));
}
