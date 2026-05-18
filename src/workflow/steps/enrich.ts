'use step';

import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { EnrichmentResult } from '@/db/schema';
import { RetryableError } from 'workflow';

type EnrichInput = {
  submissionId: string;
  url: string | null;
  company: string | null;
};

const MAX_BYTES = 200_000;

export async function enrichCompany(input: EnrichInput): Promise<EnrichmentResult> {
  let result: EnrichmentResult = { fetched: false, summary: null, signals: [] };

  if (input.url) {
    try {
      const res = await fetch(input.url, {
        headers: { 'user-agent': 'intake-zero/0.1 (+https://intake.zeroindex.ai)' },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        if (res.status >= 500) throw new RetryableError(`upstream ${res.status}`);
      } else {
        const text = (await res.text()).slice(0, MAX_BYTES);
        result = {
          fetched: true,
          summary: stripToText(text).slice(0, 4_000),
          signals: detectSignals(text),
        };
      }
    } catch (err) {
      if (err instanceof RetryableError) throw err;
      // Non-retryable network/parse error — fall through with un-enriched result.
    }
  }

  await db
    .update(schema.submissions)
    .set({ enrichment: result, status: 'classifying', updatedAt: new Date() })
    .where(eq(schema.submissions.id, input.submissionId));

  return result;
}

function stripToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSignals(html: string): string[] {
  const signals: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/\bnext\.?js\b/i, 'nextjs'],
    [/\bvercel\b/i, 'vercel'],
    [/\bsupabase\b/i, 'supabase'],
    [/\bopenai\b/i, 'openai'],
    [/\banthropic\b|claude/i, 'anthropic'],
    [/\bllama\b|huggingface/i, 'oss-llm'],
    [/\brag\b|retrieval/i, 'rag'],
    [/\bagent(s|ic)?\b/i, 'agents'],
    [/\bhipaa\b|phi\b/i, 'healthcare'],
    [/\bfintech\b|payments?/i, 'fintech'],
  ];
  for (const [re, tag] of checks) if (re.test(html)) signals.push(tag);
  return signals;
}
