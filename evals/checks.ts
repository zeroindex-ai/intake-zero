import type { Check } from '@zeroindex-ai/eval-pack';

// Custom checks for intake-zero's classify + draft outputs. The subject returns
// the draft as `text` and the classification fields in `metadata`, so these
// read from both. Structured-output checks skip themselves when the golden item
// doesn't specify an expectation (so draft-only items don't fail them).

const CASE_STUDIES = ['ask-zeroindex', 'eval-pack', 'trace-pack', 'mcp-pack', 'evals-site'];

/** classify: the engagement type matches the labelled expectation. */
export const engagementTypeMatches: Check = (item, result) => {
  const expected = item.metadata?.expected_type;
  if (typeof expected !== 'string')
    return { name: 'engagement_type', ok: true, detail: { skipped: true } };
  const actual = result.metadata.engagementType;
  return { name: 'engagement_type', ok: actual === expected, detail: { expected, actual } };
};

/** classify: the fit score lands in the expected range (calibration). */
export const fitScoreInRange: Check = (item, result) => {
  const min = item.metadata?.fit_min;
  const max = item.metadata?.fit_max;
  if (typeof min !== 'number' || typeof max !== 'number')
    return { name: 'fit_score', ok: true, detail: { skipped: true } };
  const score = result.metadata.fitScore;
  const ok = typeof score === 'number' && score >= min && score <= max;
  return { name: 'fit_score', ok, detail: { score, min, max } };
};

/** draft rule: the reply signs off as Abhishek (applies to every draft). */
export const signsOff: Check = (_item, result) => {
  const ok = /abhishek/i.test(result.text);
  return { name: 'signs_off', ok, detail: ok ? undefined : { tail: result.text.slice(-80) } };
};

/** draft rule: stays within the ~180-word budget (220 with slack). */
export const withinWordLimit: Check = (_item, result) => {
  const words = result.text.trim().split(/\s+/).filter(Boolean).length;
  return { name: 'within_word_limit', ok: words <= 220, detail: { words, limit: 220 } };
};

/** draft rule: mentions at most one case-study slug by name. */
export const atMostOneCaseStudy: Check = (_item, result) => {
  const lower = result.text.toLowerCase();
  const mentioned = CASE_STUDIES.filter((slug) => lower.includes(slug));
  return { name: 'at_most_one_case_study', ok: mentioned.length <= 1, detail: { mentioned } };
};
