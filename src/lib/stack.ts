/**
 * Stack options shown in the intake form's "Stack (tap any that apply)" picker.
 *
 * Mirror of the apex marketing site's `SELLING_STACK` (tier 1 + tier 2),
 * canonical in `zeroindex-ai/zeroindex-site` at `src/data/stack.ts`. The two
 * repos can't share a file, so this is a deliberate derived copy: the apex
 * Stack section renders from that data, and this list must match its tier 1 +
 * tier 2 pills and order, so a prospect sees the same lineup in both places.
 * Keep them in sync when either changes.
 *
 * Tier 3 ("Full toolbox") pills are intentionally excluded — those are
 * completeness, not the selling stack a prospect typically asks about.
 */
export const STACK_OPTIONS: readonly string[] = [
  // Tier 1 — Daily drivers (the sellers)
  'Claude',
  'TypeScript',
  'Azure',
  'Databricks',
  'C#',

  // Tier 2 — In the toolbox (AI depth + production engineering + observability)
  'MCP',
  'Python',
  'Anthropic SDK',
  'Voyage AI',
  'Azure OpenAI',
  'ASP.NET',
  'Node.js',
  'Next.js',
  'React',
  'Postgres',
  'Docker',
  'Kubernetes',
  'GitHub Actions',
  'Azure DevOps',
  'Application Insights',
  'Grafana',
] as const;
