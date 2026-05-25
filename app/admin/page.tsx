import type { Metadata } from 'next';
import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Intake Admin · ZeroIndex' };

export default async function AdminIndex() {
  const rows = await db
    .select()
    .from(schema.submissions)
    .orderBy(desc(schema.submissions.createdAt))
    .limit(100);

  return (
    <>
      <section className="pt-10 pb-8">
        <div className="label mb-3">Admin</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Intake</h1>
      </section>

      <section className="pt-2 pb-24">
        <div className="card">
          {rows.length === 0 ? (
            <div className="empty-state">No submissions yet.</div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Type</th>
                    <th>Fit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="ts">
                        <Link href={`/admin/${r.id}`} className="row-link">
                          {new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                        </Link>
                      </td>
                      <td>
                        <span className="font-medium">{r.name}</span>
                        <div className="muted-2 text-xs">{r.company ?? '—'}</div>
                      </td>
                      <td className="email-cell" title={r.email}>
                        {r.email}
                      </td>
                      <td className="num-cell">{r.phone ?? '—'}</td>
                      <td className="num-cell">{r.classification?.engagementType ?? '—'}</td>
                      <td className="num-cell">
                        {r.classification ? `${r.classification.fitScore}/5` : '—'}
                      </td>
                      <td className="num-cell">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
