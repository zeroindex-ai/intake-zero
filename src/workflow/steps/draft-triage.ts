'use step';

import type Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { ClassificationResult, EnrichmentResult, Submission } from '@/db/schema';
import { anthropic, DRAFT_MODEL } from '@/workflow/anthropic';
import { DRAFT_PROMPT } from '@/workflow/prompts';
import { ModelOutputError } from '@/workflow/model-output-error';
import { emitModelEvent, type ModelUsage } from '@/workflow/trace';
import { RetryableError, FatalError } from 'workflow';

export type DraftCoreInput = {
  submission: Pick<
    Submission,
    'name' | 'company' | 'problem' | 'lookingFor' | 'stack' | 'timeline' | 'budget'
  >;
  enrichment: EnrichmentResult;
  classification: ClassificationResult;
};

type DraftInput = DraftCoreInput & { submissionId: string; submission: Submission };

// Pure core: prompt → model → trimmed draft text. No DB writes; injectable
// client so the eval harness reuses the same prompt without the app env.
export async function runDraft(
  input: DraftCoreInput,
  client: Anthropic = anthropic(),
  // See runClassification: surfaces usage before the parse so a later failure
  // still records cost. Eval harness omits it; return type stays a plain string.
  onUsage?: (usage: ModelUsage) => void,
): Promise<string> {
  const userContent = JSON.stringify(
    {
      from: { name: input.submission.name, company: input.submission.company },
      problem: input.submission.problem,
      lookingFor: input.submission.lookingFor,
      stack: input.submission.stack,
      timeline: input.submission.timeline,
      budget: input.submission.budget,
      enrichmentSignals: input.enrichment.signals,
      classification: input.classification,
    },
    null,
    2,
  );

  const res = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 1_200,
    system: DRAFT_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });
  onUsage?.(res.usage);
  const block = res.content.find((c) => c.type === 'text');
  if (!block || block.type !== 'text') throw new ModelOutputError('no text block from drafter');
  return block.text.trim();
}

export async function draftTriage(input: DraftInput): Promise<string> {
  const startedAt = Date.now();
  let usage: ModelUsage | null = null;
  let draft: string;
  try {
    draft = await runDraft(input, anthropic(), (u) => {
      usage = u;
    });
  } catch (err) {
    await emitModelEvent({
      step: 'draft',
      model: DRAFT_MODEL,
      status: 'error',
      submissionId: input.submissionId,
      totalMs: Date.now() - startedAt,
      usage,
      outcomeReason: err instanceof ModelOutputError ? 'model_output_error' : 'api_error',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof ModelOutputError) throw new FatalError(err.message);
    if (err instanceof FatalError) throw err;
    throw new RetryableError(`draft failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  await emitModelEvent({
    step: 'draft',
    model: DRAFT_MODEL,
    status: 'ok',
    submissionId: input.submissionId,
    totalMs: Date.now() - startedAt,
    usage,
  });
  await db
    .update(schema.submissions)
    .set({ triageDraft: draft, status: 'notifying', updatedAt: new Date() })
    .where(eq(schema.submissions.id, input.submissionId));

  return draft;
}
