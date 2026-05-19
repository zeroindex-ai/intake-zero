/**
 * Stack options shown in the intake form's "Stack (tap any that apply)" picker.
 *
 * Source: zeroindexai/index.html §Stack (tier 1 "Daily drivers" + tier 2
 * "In the toolbox"). Order matches the apex marketing site so prospects who
 * scanned the Stack section there see the same lineup here.
 *
 * Tier 3 ("Full toolbox") pills are intentionally excluded — those are
 * completeness, not the selling stack a prospect typically asks about.
 *
 * Long-term goal: a single shared config (npm package or JSON) consumed by
 * both this form and the apex Stack section to prevent drift. For now this
 * is the single intake-side copy.
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
