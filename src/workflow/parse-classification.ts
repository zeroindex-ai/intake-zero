import type { ClassificationResult } from '@/db/schema';
import { FatalError } from 'workflow';

const ENGAGEMENT_TYPES = ['advisory', 'build', 'audit', 'training', 'unclear'] as const;

export function parseClassification(raw: string): ClassificationResult {
  const json = extractJson(raw);
  const rawType = String(json.engagementType ?? '');
  const engagementType = (ENGAGEMENT_TYPES as readonly string[]).includes(rawType)
    ? (rawType as ClassificationResult['engagementType'])
    : 'unclear';
  const fitScore = Math.max(0, Math.min(5, Math.floor(Number(json.fitScore) || 0)));
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
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        // Brace-delimited substring still isn't valid JSON — this is bad model
        // output, not a transient failure, so it must be Fatal (not retryable).
        throw new FatalError('classifier did not return parseable JSON');
      }
    }
    throw new FatalError('classifier did not return JSON');
  }
}
