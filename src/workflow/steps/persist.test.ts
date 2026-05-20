import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FatalError } from 'workflow';

const { returning, updateSet } = vi.hoisted(() => {
  const returning = vi.fn();
  const where = vi.fn(() => ({ returning }));
  const updateSet = vi.fn(() => ({ where }));
  return { returning, updateSet };
});

vi.mock('@/db/client', () => ({
  db: { update: vi.fn(() => ({ set: updateSet })) },
  schema: { submissions: { id: 'id' } },
}));

import { persistSubmission } from './persist';

describe('persistSubmission', () => {
  beforeEach(() => {
    returning.mockReset();
    updateSet.mockClear();
  });

  it('advances status to enriching and returns the row', async () => {
    returning.mockResolvedValue([{ id: 's1', status: 'enriching' }]);
    const row = await persistSubmission('s1');
    expect(row).toEqual({ id: 's1', status: 'enriching' });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'enriching' }));
  });

  it('throws FatalError when the submission row is missing', async () => {
    returning.mockResolvedValue([]);
    await expect(persistSubmission('missing')).rejects.toBeInstanceOf(FatalError);
  });
});
