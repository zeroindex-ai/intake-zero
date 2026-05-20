import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryableError } from 'workflow';

const { safeFetch, updateSet } = vi.hoisted(() => {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const safeFetch = vi.fn();
  return { safeFetch, updateSet };
});

vi.mock('@/db/client', () => ({
  db: { update: vi.fn(() => ({ set: updateSet })) },
  schema: { submissions: { id: 'id' } },
}));
vi.mock('@/lib/safe-fetch', () => ({ safeFetch }));

import { enrichCompany } from './enrich';

function res(init: { ok: boolean; status: number; body?: string }) {
  return { ok: init.ok, status: init.status, text: async () => init.body ?? '' };
}

describe('enrichCompany', () => {
  beforeEach(() => {
    safeFetch.mockReset();
    updateSet.mockClear();
  });

  it('returns an un-enriched result and advances status when no URL is given', async () => {
    const out = await enrichCompany({ submissionId: 's', url: null, company: null });
    expect(out).toEqual({ fetched: false, summary: null, signals: [] });
    expect(safeFetch).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'classifying' }));
  });

  it('strips HTML and detects tech signals on a successful fetch', async () => {
    safeFetch.mockResolvedValue(
      res({
        ok: true,
        status: 200,
        body: '<p>We build with Next.js on Vercel using Anthropic Claude.</p>',
      }),
    );
    const out = await enrichCompany({
      submissionId: 's',
      url: 'https://acme.com',
      company: 'Acme',
    });
    expect(out.fetched).toBe(true);
    expect(out.signals).toEqual(expect.arrayContaining(['nextjs', 'vercel', 'anthropic']));
    expect(out.summary).toContain('We build with Next.js on Vercel');
    expect(out.summary).not.toContain('<p>');
  });

  it('throws RetryableError on a 5xx upstream response', async () => {
    safeFetch.mockResolvedValue(res({ ok: false, status: 503 }));
    await expect(
      enrichCompany({ submissionId: 's', url: 'https://acme.com', company: null }),
    ).rejects.toBeInstanceOf(RetryableError);
  });

  it('falls through (fetched:false) on a non-5xx error response', async () => {
    safeFetch.mockResolvedValue(res({ ok: false, status: 404 }));
    const out = await enrichCompany({ submissionId: 's', url: 'https://acme.com', company: null });
    expect(out.fetched).toBe(false);
  });

  it('falls through when the fetch is SSRF-blocked or fails non-retryably', async () => {
    safeFetch.mockRejectedValue(new Error('blocked: non-public IP literal'));
    const out = await enrichCompany({
      submissionId: 's',
      url: 'http://169.254.169.254',
      company: null,
    });
    expect(out.fetched).toBe(false);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'classifying' }));
  });

  it('re-throws a RetryableError raised during fetch', async () => {
    safeFetch.mockRejectedValue(new RetryableError('upstream flaky'));
    await expect(
      enrichCompany({ submissionId: 's', url: 'https://acme.com', company: null }),
    ).rejects.toBeInstanceOf(RetryableError);
  });
});
