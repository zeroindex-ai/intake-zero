import { describe, it, expect, vi, beforeEach } from 'vitest';

const { selectLimit, updateSet } = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  return { selectLimit, updateSet, updateWhere };
});

vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) })),
    update: vi.fn(() => ({ set: updateSet })),
  },
  schema: { submissions: { id: 'id', status: 'status' } },
}));

import { markFailed } from './mark-failed';

describe('markFailed', () => {
  beforeEach(() => {
    selectLimit.mockReset();
    updateSet.mockClear();
  });

  it('captures the in-flight status as failedAtStep', async () => {
    selectLimit.mockResolvedValue([{ status: 'classifying' }]);
    const out = await markFailed('s1', 'classify failed: timeout');
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', failedAtStep: 'classifying' }),
    );
    expect(out).toEqual(expect.objectContaining({ submissionId: 's1', status: 'failed' }));
  });

  it('records null failedAtStep when the row is missing', async () => {
    selectLimit.mockResolvedValue([]);
    await markFailed('s2', 'gone');
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ failedAtStep: null }));
  });

  it('truncates the returned message to 500 chars', async () => {
    selectLimit.mockResolvedValue([{ status: 'drafting' }]);
    const out = await markFailed('s3', 'x'.repeat(1000));
    expect(out.message.length).toBe(500);
  });
});
