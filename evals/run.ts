import { join } from 'node:path';
import { runEval, mustNotMention } from '@zeroindex-ai/eval-pack';
import { subject } from './subject';
import {
  engagementTypeMatches,
  fitScoreInRange,
  signsOff,
  withinWordLimit,
  atMostOneCaseStudy,
} from './checks';

// Run with: pnpm eval  (needs ANTHROPIC_API_KEY — this hits the real models)

async function main(): Promise<void> {
  const report = await runEval({
    golden: join(import.meta.dirname, 'golden.json'),
    subject,
    checks: [
      mustNotMention(), // per-item: injection promises / pricing must not appear
      engagementTypeMatches,
      fitScoreInRange,
      signsOff,
      withinWordLimit,
      atMostOneCaseStudy,
    ],
    throttleMs: 250, // gentle on rate limits
    resultsDir: join(import.meta.dirname, 'results'), // run-<ts>.json for CI artifacts
  });

  const passed = report.results.filter((r) => r.pass).length;
  const total = report.results.length;
  const pct = total ? Math.round((passed / total) * 100) : 0;
  console.log(`\n${passed}/${total} passed (${pct}%)\n`);

  for (const r of report.results) {
    console.log(`  ${r.pass ? '✓' : '✗'} ${r.category}/${r.id}`);
    for (const c of r.checks.filter((c) => !c.ok)) {
      console.log(`      - ${c.name}: ${JSON.stringify(c.detail)}`);
    }
  }

  if (report.errors.length > 0) {
    console.log(`\nerrors (${report.errors.length}):`);
    for (const e of report.errors) console.log(`  [${e.id}] ${e.error}`);
  }
  if (report.jsonPath !== undefined) console.log(`\nsaved: ${report.jsonPath}`);

  // Every item errored (e.g. bad/missing key) is a hard failure, not 0%.
  if (total === 0) throw new Error('No eval results — every item errored out');

  // Gate on pass rate (default 0.8, override via EVAL_PASS_THRESHOLD), matching
  // the ask-zeroindex eval workflow.
  const threshold = Number(process.env['EVAL_PASS_THRESHOLD'] ?? 0.8);
  if (passed / total < threshold) {
    throw new Error(`Pass rate ${pct}% below threshold ${(threshold * 100).toFixed(0)}%`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
