'use step';

import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { Submission } from '@/db/schema';
import { resend } from '@/email/resend';
import { renderEmail } from '@/email/render';
import { ProspectAck } from '@/email/templates/prospect-ack';
import { env } from '@/lib/env';
import { RetryableError } from 'workflow';

type AckInput = {
  submissionId: string;
  submission: Submission;
};

export async function ackProspect(input: AckInput) {
  try {
    await resend().emails.send({
      from: env().FROM_EMAIL,
      to: input.submission.email,
      subject: 'Got your note — ZeroIndex',
      html: renderEmail(ProspectAck({ submission: input.submission })),
    });
  } catch (err) {
    throw new RetryableError(`resend ack failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  await db
    .update(schema.submissions)
    .set({ status: 'sent', updatedAt: new Date() })
    .where(eq(schema.submissions.id, input.submissionId));
}
