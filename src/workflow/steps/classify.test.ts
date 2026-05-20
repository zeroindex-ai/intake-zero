import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryableError, FatalError } from 'workflow';
import type { EnrichmentResult } from '@/db/schema';

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
  CLASSIFY_MODEL: 'test-classify-model',
}));

import { classifySubmission } from './classify';

const enrichment: EnrichmentResult = { fetched: false, summary: null, signals: [] };
const input = {
  submissionId: 's1',
  problem: 'We need a RAG system',
  stack: ['nextjs'],
  timeline: '4-8 weeks',
  budget: '$10k+',
  enrichment,
};

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('classifySubmission', () => {
  beforeEach(() => {
    create.mockReset();
    updateSet.mockClear();
    updateWhere.mockClear();
  });

  it('parses a valid classification and advances status to drafting', async () => {
    create.mockResolvedValue(
      textResponse(
        JSON.stringify({
          engagementType: 'build',
          fitScore: 4,
          rationale: 'r',
          suggestedCaseStudies: [],
        }),
      ),
    );
    const out = await classifySubmission(input);
    expect(out.engagementType).toBe('build');
    expect(out.fitScore).toBe(4);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'drafting' }));
  });

  it('wraps a transient API failure in RetryableError', async () => {
    create.mockRejectedValue(new Error('socket hang up'));
    await expect(classifySubmission(input)).rejects.toBeInstanceOf(RetryableError);
    expect(updateSet).not.toHaveBeenCalled();
  });

  it('propagates a FatalError from the API without rewrapping', async () => {
    create.mockRejectedValue(new FatalError('bad request'));
    await expect(classifySubmission(input)).rejects.toBeInstanceOf(FatalError);
  });

  it('treats a response with no text block as FatalError', async () => {
    create.mockResolvedValue({ content: [{ type: 'tool_use' }] });
    await expect(classifySubmission(input)).rejects.toBeInstanceOf(FatalError);
  });

  it('surfaces FatalError when the model returns non-JSON', async () => {
    create.mockResolvedValue(textResponse('I cannot help with that.'));
    await expect(classifySubmission(input)).rejects.toBeInstanceOf(FatalError);
  });
});
