import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryableError, FatalError } from 'workflow';
import type { ClassificationResult, EnrichmentResult, Submission } from '@/db/schema';

const { create, updateSet, updateWhere } = vi.hoisted(() => {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const create = vi.fn();
  return { create, updateSet, updateWhere };
});

vi.mock('@/db/client', () => ({
  db: { update: vi.fn(() => ({ set: updateSet })) },
  schema: { submissions: { id: 'id', status: 'status' } },
}));

vi.mock('@/workflow/anthropic', () => ({
  anthropic: () => ({ messages: { create } }),
  DRAFT_MODEL: 'test-draft-model',
}));

import { draftTriage } from './draft-triage';

const enrichment: EnrichmentResult = { fetched: false, summary: null, signals: [] };
const classification: ClassificationResult = {
  engagementType: 'build',
  fitScore: 4,
  rationale: 'r',
  suggestedCaseStudies: ['ask-zeroindex'],
};
const submission = {
  id: 's1',
  name: 'Dana',
  company: 'Acme',
  problem: 'We need a RAG system',
  stack: ['nextjs'],
  timeline: '4-8 weeks',
  budget: '$10k+',
} as unknown as Submission;

const input = { submissionId: 's1', submission, enrichment, classification };

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('draftTriage', () => {
  beforeEach(() => {
    create.mockReset();
    updateSet.mockClear();
    updateWhere.mockClear();
  });

  it('returns the trimmed draft and advances status to notifying', async () => {
    create.mockResolvedValue(textResponse('  Hi Dana,\n\nLooks like a fit.\n\nAbhishek  '));
    const out = await draftTriage(input);
    expect(out.startsWith('Hi Dana,')).toBe(true);
    expect(out.endsWith('Abhishek')).toBe(true);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'notifying' }));
  });

  it('wraps a transient API failure in RetryableError', async () => {
    create.mockRejectedValue(new Error('429 overloaded'));
    await expect(draftTriage(input)).rejects.toBeInstanceOf(RetryableError);
    expect(updateSet).not.toHaveBeenCalled();
  });

  it('propagates a FatalError from the API without rewrapping', async () => {
    create.mockRejectedValue(new FatalError('bad request'));
    await expect(draftTriage(input)).rejects.toBeInstanceOf(FatalError);
  });

  it('treats a response with no text block as FatalError', async () => {
    create.mockResolvedValue({ content: [] });
    await expect(draftTriage(input)).rejects.toBeInstanceOf(FatalError);
  });
});
