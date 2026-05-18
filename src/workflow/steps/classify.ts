'use step';

import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { ClassificationResult, EnrichmentResult } from '@/db/schema';
import { anthropic, CLASSIFY_MODEL } from '@/workflow/anthropic';
import { CLASSIFY_PROMPT } from '@/workflow/prompts';
import { RetryableError, FatalError } from 'workflow';

type ClassifyInput = {
  submissionId: string;
  problem: string;
  stack: string[];
  timeline: string | null;
  budget: string | null;
  enrichment: EnrichmentResult;
};

export async function classifySubmission(input: ClassifyInput): Promise<ClassificationResult> {
  const userContent = JSON.stringify(
    {
      problem: input.problem,
      stack: input.stack,
      timeline: input.timeline,
      budget: input.budget,
      enrichment: {
        fetched: input.enrichment.fetched,
        signals: input.enrichment.signals,
        summary: input.enrichment.summary?.slice(0, 1_500) ?? null,
      },
    },
    null,
    2,
  );

  let raw: string;
  try {
    const res = await anthropic().messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 600,
      system: CLASSIFY_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    const block = res.content.find((c) => c.type === 'text');
    if (!block || block.type !== 'text') throw new FatalError('no text block from classifier');
    raw = block.text;
  } catch (err) {
    if (err instanceof FatalError) throw err;
    throw new RetryableError(`classify failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const parsed = parseClassification(raw);
  await db
    .update(schema.submissions)
    .set({ classification: parsed, status: 'drafting', updatedAt: new Date() })
    .where(eq(schema.submissions.id, input.submissionId));
  return parsed;
}

const ENGAGEMENT_TYPES = ['advisory', 'build', 'audit', 'training', 'unclear'] as const;

function parseClassification(raw: string): ClassificationResult {
  const json = extractJson(raw);
  const rawType = String(json.engagementType ?? '');
  const engagementType = (ENGAGEMENT_TYPES as readonly string[]).includes(rawType)
    ? (rawType as ClassificationResult['engagementType'])
    : 'unclear';
  const fitScore = Math.max(0, Math.min(5, Number(json.fitScore) || 0));
  return {
    engagementType,
    fitScore: fitScore as ClassificationResult['fitScore'],
    rationale: String(json.rationale ?? '').slice(0, 1_000),
    suggestedCaseStudies: Array.isArray(json.suggestedCaseStudies)
      ? json.suggestedCaseStudies.map(String).slice(0, 5)
      : [],
  };
}

function extractJson(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new FatalError('classifier did not return JSON');
  }
}
