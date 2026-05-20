import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Submission · Intake Admin · ZeroIndex' };

export default async function AdminDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.id, id))
    .limit(1);
  if (!row) notFound();

  return (
    <>
      <section className="pt-10 pb-8">
        <Link href="/admin" className="label mb-3 inline-block hover:opacity-70">
          ← all submissions
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{row.name}</h1>
        <div className="muted mt-2 text-base">
          {row.role ? `${row.role} · ` : ''}
          {row.company ?? '—'} ·{' '}
          <a href={`mailto:${row.email}`} className="inline-link">
            {row.email}
          </a>
          {row.phone ? (
            <>
              {' · '}
              <a href={`tel:${row.phone}`} className="inline-link">
                {row.phone}
              </a>
            </>
          ) : null}
        </div>
      </section>

      <section className="pt-2 pb-8">
        <div className="card">
          <div className="label mb-3">Their problem</div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{row.problem}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[15px] mt-8 pt-6 border-t line">
            <div>
              <div className="label mb-1">Stack</div>
              <div>{row.stack.length ? row.stack.join(', ') : '—'}</div>
            </div>
            <div>
              <div className="label mb-1">Timeline</div>
              <div>{row.timeline ?? '—'}</div>
            </div>
            <div>
              <div className="label mb-1">Budget</div>
              <div>{row.budget ?? '—'}</div>
            </div>
          </div>
        </div>
      </section>

      {row.classification ? (
        <section className="pt-2 pb-8">
          <div className="card">
            <div className="flex items-center gap-3 mb-2">
              <span className="mono text-xs uppercase tracking-wider">
                {row.classification.engagementType}
              </span>
              <span className="mono text-xs muted-2">fit {row.classification.fitScore}/5</span>
            </div>
            <p className="text-[15px] leading-relaxed">{row.classification.rationale}</p>
            {row.classification.suggestedCaseStudies.length > 0 ? (
              <div className="mt-3 text-[15px] muted">
                Suggested: {row.classification.suggestedCaseStudies.join(', ')}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {row.triageDraft ? (
        <section className="pt-2 pb-8">
          <div className="label mb-3">Draft reply</div>
          <div className="card">
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
              {row.triageDraft}
            </pre>
          </div>
        </section>
      ) : null}

      {row.enrichment ? (
        <section className="pt-2 pb-8">
          <div className="card">
            <div className="label mb-2">Enrichment</div>
            <div className="text-[15px] muted">
              fetched: {String(row.enrichment.fetched)} · signals:{' '}
              {row.enrichment.signals.join(', ') || '—'}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pt-2 pb-24 mono text-xs muted-2">
        <div>id: {row.id}</div>
        <div>runId: {row.runId ?? '—'}</div>
        <div>status: {row.status}</div>
        <div>created: {new Date(row.createdAt).toISOString()}</div>
      </section>
    </>
  );
}
