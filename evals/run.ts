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
  });

  const passed = report.results.filter((r) => r.pass).length;
  const total = report.results.length;
  console.log(`\n${passed}/${total} passed (${total ? Math.round((passed / total) * 100) : 0}%)\n`);

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

  if (passed !== total) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
