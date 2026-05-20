import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryableError } from 'workflow';
import type { Submission } from '@/db/schema';

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
vi.mock('@/email/templates/prospect-ack', () => ({ ProspectAck: vi.fn(() => null) }));
vi.mock('@/lib/env', () => ({ env: () => ({ FROM_EMAIL: 'from@zeroindex.ai' }) }));

import { ackProspect } from './ack-prospect';

const submission = { id: 's1', name: 'Dana', email: 'dana@acme.com' } as unknown as Submission;

describe('ackProspect', () => {
  beforeEach(() => {
    send.mockReset();
    updateSet.mockClear();
  });

  it('emails the prospect and marks the submission sent', async () => {
    send.mockResolvedValue({ id: 'email_1' });
    await ackProspect({ submissionId: 's1', submission });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'from@zeroindex.ai', to: 'dana@acme.com' }),
    );
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
  });

  it('wraps a send failure in RetryableError and does not mark sent', async () => {
    send.mockRejectedValue(new Error('resend 500'));
    await expect(ackProspect({ submissionId: 's1', submission })).rejects.toBeInstanceOf(
      RetryableError,
    );
    expect(updateSet).not.toHaveBeenCalled();
  });
});
