'use step';

import type Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { ClassificationResult, EnrichmentResult, Submission } from '@/db/schema';
import { anthropic, DRAFT_MODEL } from '@/workflow/anthropic';
import { DRAFT_PROMPT } from '@/workflow/prompts';
import { RetryableError, FatalError } from 'workflow';

export type DraftCoreInput = {
  submission: Pick<Submission, 'name' | 'company' | 'problem' | 'stack' | 'timeline' | 'budget'>;
  enrichment: EnrichmentResult;
  classification: ClassificationResult;
};

type DraftInput = DraftCoreInput & { submissionId: string; submission: Submission };

// Pure core: prompt → model → trimmed draft text. No DB writes; injectable
// client so the eval harness reuses the same prompt without the app env.
export async function runDraft(
  input: DraftCoreInput,
  client: Anthropic = anthropic(),
): Promise<string> {
  const userContent = JSON.stringify(
    {
      from: { name: input.submission.name, company: input.submission.company },
      problem: input.submission.problem,
      stack: input.submission.stack,
      timeline: input.submission.timeline,
      budget: input.submission.budget,
      enrichmentSignals: input.enrichment.signals,
      classification: input.classification,
    },
    null,
    2,
  );

  let draft: string;
  try {
    const res = await client.messages.create({
      model: DRAFT_MODEL,
      max_tokens: 1_200,
      system: DRAFT_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    const block = res.content.find((c) => c.type === 'text');
    if (!block || block.type !== 'text') throw new FatalError('no text block from drafter');
    draft = block.text.trim();
  } catch (err) {
    if (err instanceof FatalError) throw err;
    throw new RetryableError(`draft failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return draft;
}

export async function draftTriage(input: DraftInput): Promise<string> {
  const draft = await runDraft(input);
  await db
    .update(schema.submissions)
    .set({ triageDraft: draft, status: 'notifying', updatedAt: new Date() })
    .where(eq(schema.submissions.id, input.submissionId));

  return draft;
}
