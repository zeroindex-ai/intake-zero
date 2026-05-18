import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export const dynamic = 'force-dynamic';

export default async function AdminDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.id, id))
    .limit(1);
  if (!row) notFound();

  return (
    <div>
      <Link href="/admin" className="label mb-6 inline-block hover:opacity-70">
        ← all submissions
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">{row.name}</h1>
      <div className="muted mt-1">
        {row.role ? `${row.role} · ` : ''}
        {row.company ?? '—'} ·{' '}
        <a href={`mailto:${row.email}`} className="underline">
          {row.email}
        </a>
      </div>

      <section className="mt-8">
        <div className="label mb-2">Their problem</div>
        <p className="whitespace-pre-wrap">{row.problem}</p>
      </section>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
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
      </section>

      {row.classification ? (
        <section className="mt-8 p-5 rounded-xl bg-[var(--bg-soft)]">
          <div className="flex items-center gap-3 mb-2">
            <span className="mono text-xs uppercase tracking-wider">
              {row.classification.engagementType}
            </span>
            <span className="mono text-xs muted-2">fit {row.classification.fitScore}/5</span>
          </div>
          <p className="text-sm">{row.classification.rationale}</p>
          {row.classification.suggestedCaseStudies.length > 0 ? (
            <div className="mt-2 text-sm muted">
              Suggested: {row.classification.suggestedCaseStudies.join(', ')}
            </div>
          ) : null}
        </section>
      ) : null}

      {row.triageDraft ? (
        <section className="mt-8">
          <div className="label mb-2">Draft reply</div>
          <pre className="whitespace-pre-wrap font-sans p-5 rounded-xl border line bg-[var(--bg)] text-sm">
            {row.triageDraft}
          </pre>
        </section>
      ) : null}

      {row.enrichment ? (
        <section className="mt-8 text-sm muted">
          <div className="label mb-1" style={{ color: 'var(--muted)' }}>
            Enrichment
          </div>
          fetched: {String(row.enrichment.fetched)} · signals:{' '}
          {row.enrichment.signals.join(', ') || '—'}
        </section>
      ) : null}

      <section className="mt-12 mono text-xs muted-2">
        <div>id: {row.id}</div>
        <div>runId: {row.runId ?? '—'}</div>
        <div>status: {row.status}</div>
        <div>created: {new Date(row.createdAt).toISOString()}</div>
      </section>
    </div>
  );
}
