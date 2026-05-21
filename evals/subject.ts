import Anthropic from '@anthropic-ai/sdk';
import type { Subject } from '@zeroindex-ai/eval-pack';
import type { EnrichmentResult } from '@/db/schema';
import { runClassification } from '@/workflow/steps/classify';
import { runDraft } from '@/workflow/steps/draft-triage';

// The subject runs intake-zero's REAL two-step pipeline (classify → draft) on
// each golden item, minus the DB/enrichment/email side effects. `question` is
// the prospect's problem statement; `text` is the draft reply and `metadata`
// carries the classification fields the structured-output checks read.
//
// It only needs ANTHROPIC_API_KEY: it injects its own client, so the app's
// strict env() (Turso/Resend/etc.) is never touched.

const EMPTY_ENRICHMENT: EnrichmentResult = { fetched: false, summary: null, signals: [] };

let client: Anthropic | null = null;
const getClient = (): Anthropic => (client ??= new Anthropic());

export const subject: Subject = async (question) => {
  const problem = question;

  const classification = await runClassification(
    { problem, stack: [], timeline: null, budget: null, enrichment: EMPTY_ENRICHMENT },
    getClient(),
  );

  const draft = await runDraft(
    {
      submission: {
        name: 'Prospect',
        company: null,
        problem,
        stack: [],
        timeline: null,
        budget: null,
      },
      enrichment: EMPTY_ENRICHMENT,
      classification,
    },
    getClient(),
  );

  return {
    text: draft,
    metadata: {
      engagementType: classification.engagementType,
      fitScore: classification.fitScore,
      suggestedCaseStudies: classification.suggestedCaseStudies,
    },
  };
};
