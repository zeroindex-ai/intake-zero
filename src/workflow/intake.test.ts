import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  persistSubmission,
  enrichCompany,
  classifySubmission,
  draftTriage,
  notifyOwner,
  ackProspect,
  markFailed,
} = vi.hoisted(() => ({
  persistSubmission: vi.fn(),
  enrichCompany: vi.fn(),
  classifySubmission: vi.fn(),
  draftTriage: vi.fn(),
  notifyOwner: vi.fn(),
  ackProspect: vi.fn(),
  markFailed: vi.fn(),
}));

vi.mock('./steps/persist', () => ({ persistSubmission }));
vi.mock('./steps/enrich', () => ({ enrichCompany }));
vi.mock('./steps/classify', () => ({ classifySubmission }));
vi.mock('./steps/draft-triage', () => ({ draftTriage }));
vi.mock('./steps/notify-owner', () => ({ notifyOwner }));
vi.mock('./steps/ack-prospect', () => ({ ackProspect }));
vi.mock('./steps/mark-failed', () => ({ markFailed }));

import { intakeWorkflow } from './intake';

const submission = {
  id: 's1',
  url: null,
  company: 'Acme',
  problem: 'p',
  stack: [],
  timeline: null,
  budget: null,
  name: 'Dana',
  email: 'd@a.co',
};

describe('intakeWorkflow', () => {
  beforeEach(() => {
    for (const fn of [
      persistSubmission,
      enrichCompany,
      classifySubmission,
      draftTriage,
      notifyOwner,
      ackProspect,
      markFailed,
    ])
      fn.mockReset();
    persistSubmission.mockResolvedValue(submission);
    enrichCompany.mockResolvedValue({ fetched: false, summary: null, signals: [] });
    classifySubmission.mockResolvedValue({
      engagementType: 'build',
      fitScore: 4,
      rationale: 'r',
      suggestedCaseStudies: [],
    });
    draftTriage.mockResolvedValue('draft');
    notifyOwner.mockResolvedValue(undefined);
    ackProspect.mockResolvedValue(undefined);
    markFailed.mockResolvedValue(undefined);
  });

  it('runs all six steps in order and reaches status "sent"', async () => {
    const out = await intakeWorkflow({ submissionId: 's1' });
    expect(out).toEqual({ submissionId: 's1', status: 'sent' });
    for (const fn of [
      persistSubmission,
      enrichCompany,
      classifySubmission,
      draftTriage,
      notifyOwner,
      ackProspect,
    ])
      expect(fn).toHaveBeenCalledTimes(1);
    expect(markFailed).not.toHaveBeenCalled();
    // ordering: persist → classify → ack
    expect(persistSubmission.mock.invocationCallOrder[0]).toBeLessThan(
      classifySubmission.mock.invocationCallOrder[0],
    );
    expect(classifySubmission.mock.invocationCallOrder[0]).toBeLessThan(
      ackProspect.mock.invocationCallOrder[0],
    );
  });

  it('calls markFailed and rethrows when a step fails', async () => {
    classifySubmission.mockRejectedValue(new Error('classify boom'));
    await expect(intakeWorkflow({ submissionId: 's1' })).rejects.toThrow('classify boom');
    expect(markFailed).toHaveBeenCalledWith('s1', 'classify boom');
    // steps after the failure must not run
    expect(notifyOwner).not.toHaveBeenCalled();
    expect(ackProspect).not.toHaveBeenCalled();
  });
});
