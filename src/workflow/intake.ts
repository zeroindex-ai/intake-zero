'use workflow';

import { persistSubmission } from './steps/persist';
import { enrichCompany } from './steps/enrich';
import { classifySubmission } from './steps/classify';
import { draftTriage } from './steps/draft-triage';
import { notifyOwner } from './steps/notify-owner';
import { ackProspect } from './steps/ack-prospect';
import { markFailed } from './steps/mark-failed';

export type IntakePayload = {
  submissionId: string;
};

export async function intakeWorkflow(payload: IntakePayload) {
  try {
    const submission = await persistSubmission(payload.submissionId);

    const enrichment = await enrichCompany({
      submissionId: submission.id,
      url: submission.url ?? null,
      company: submission.company ?? null,
    });

    const classification = await classifySubmission({
      submissionId: submission.id,
      problem: submission.problem,
      lookingFor: submission.lookingFor,
      stack: submission.stack,
      timeline: submission.timeline ?? null,
      budget: submission.budget ?? null,
      teamSize: submission.teamSize ?? null,
      enrichment,
    });

    const triage = await draftTriage({
      submissionId: submission.id,
      submission,
      enrichment,
      classification,
    });

    await notifyOwner({
      submissionId: submission.id,
      submission,
      enrichment,
      classification,
      triage,
    });

    await ackProspect({
      submissionId: submission.id,
      submission,
    });

    return { submissionId: submission.id, status: 'sent' as const };
  } catch (err) {
    await markFailed(payload.submissionId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
