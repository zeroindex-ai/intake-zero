'use step';

import type Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { ClassificationResult, EnrichmentResult } from '@/db/schema';
import { anthropic, CLASSIFY_MODEL } from '@/workflow/anthropic';
import { CLASSIFY_PROMPT } from '@/workflow/prompts';
import { parseClassification } from '@/workflow/parse-classification';
import { ModelOutputError } from '@/workflow/model-output-error';
import { RetryableError, FatalError } from 'workflow';

export type ClassificationInput = {
  problem: string;
  stack: string[];
  timeline: string | null;
  budget: string | null;
  enrichment: EnrichmentResult;
};

type ClassifyInput = ClassificationInput & { submissionId: string };

// Pure core: prompt → model → parsed/validated result. No DB writes. Takes an
// injectable client so the eval harness can reuse the exact same prompt + parse
// without the app's full env() (it passes its own Anthropic client).
export async function runClassification(
  input: ClassificationInput,
  client: Anthropic = anthropic(),
): Promise<ClassificationResult> {
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

  const res = await client.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 600,
    system: CLASSIFY_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });
  const block = res.content.find((c) => c.type === 'text');
  if (!block || block.type !== 'text') throw new ModelOutputError('no text block from classifier');
  return parseClassification(block.text);
}

export async function classifySubmission(input: ClassifyInput): Promise<ClassificationResult> {
  let parsed: ClassificationResult;
  try {
    parsed = await runClassification(input);
  } catch (err) {
    // Bad model output is deterministic → Fatal (no retry); a real FatalError
    // passes through; anything else (transient API failure) → Retryable.
    if (err instanceof ModelOutputError) throw new FatalError(err.message);
    if (err instanceof FatalError) throw err;
    throw new RetryableError(
      `classify failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  await db
    .update(schema.submissions)
    .set({ classification: parsed, status: 'drafting', updatedAt: new Date() })
    .where(eq(schema.submissions.id, input.submissionId));
  return parsed;
}
