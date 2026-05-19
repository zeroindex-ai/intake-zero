import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { RunTimeline } from '@/components/run-timeline';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Intake received · ZeroIndex' };

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const [row] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.id, runId))
    .limit(1);

  if (!row) notFound();

  return (
    <section className="pt-10 pb-24 max-w-4xl">
      <div className="label mb-3">Intake received</div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Thanks, {row.name.split(' ')[0]}.
      </h1>
      <p className="mt-4 muted text-base leading-relaxed">
        Your note is in. The pipeline below runs whether you stay on this page or not &mdash;
        reload, close the tab, come back tomorrow. The state survives.
      </p>

      <div className="mt-10">
        <RunTimeline submissionId={row.id} initialStatus={row.status} />
      </div>

      <p className="mt-12 muted-2 text-sm">
        You&rsquo;ll get a confirmation email at <strong>{row.email}</strong> when this finishes. My
        reply lands separately, usually within a business day.
      </p>
    </section>
  );
}
