import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';

export const CLASSIFY_MODEL = 'claude-haiku-4-5-20251001';
export const DRAFT_MODEL = 'claude-sonnet-4-6';

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return client;
}
