import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryableError } from 'workflow';
import type { ClassificationResult, EnrichmentResult, Submission } from '@/db/schema';

const { send, updateSet } = vi.hoisted(() => {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const send = vi.fn();
  return { send, updateSet };
});

vi.mock('@/db/client', () => ({
  db: { update: vi.fn(() => ({ set: updateSet })) },
  schema: { submissions: { id: 'id' } },
}));
vi.mock('@/email/resend', () => ({ resend: () => ({ emails: { send } }) }));
vi.mock('@/email/templates/owner-notify', () => ({ OwnerNotify: vi.fn(() => null) }));
vi.mock('@/lib/env', () => ({
  env: () => ({
    FROM_EMAIL: 'from@zeroindex.ai',
    OWNER_EMAIL: 'owner@zeroindex.ai',
    PUBLIC_BASE_URL: 'https://x.test',
  }),
}));

import { notifyOwner } from './notify-owner';

const submission = {
  id: 's1',
  name: 'Dana',
  email: 'dana@acme.com',
  company: 'Acme',
} as unknown as Submission;
const enrichment: EnrichmentResult = { fetched: false, summary: null, signals: [] };
const classification: ClassificationResult = {
  engagementType: 'build',
  fitScore: 4,
  rationale: 'r',
  suggestedCaseStudies: [],
};
const input = { submissionId: 's1', submission, enrichment, classification, triage: 'draft body' };

describe('notifyOwner', () => {
  beforeEach(() => {
    send.mockReset();
    updateSet.mockClear();
  });

  it('sends to the owner with reply-to set to the prospect and a fit-tagged subject', async () => {
    send.mockResolvedValue({ id: 'email_1' });
    await notifyOwner(input);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'from@zeroindex.ai',
        to: 'owner@zeroindex.ai',
        replyTo: 'dana@acme.com',
        subject: expect.stringContaining('build'),
      }),
    );
    expect(updateSet).toHaveBeenCalledTimes(1);
  });

  it('wraps a send failure in RetryableError', async () => {
    send.mockRejectedValue(new Error('resend 500'));
    await expect(notifyOwner(input)).rejects.toBeInstanceOf(RetryableError);
    expect(updateSet).not.toHaveBeenCalled();
  });
});
