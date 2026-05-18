import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export const dynamic = 'force-dynamic';

export default async function AdminIndex() {
  const rows = await db
    .select()
    .from(schema.submissions)
    .orderBy(desc(schema.submissions.createdAt))
    .limit(100);

  return (
    <div>
      <div className="label mb-3">Admin · Submissions</div>
      <h1 className="text-3xl font-bold tracking-tight mb-8">Intake</h1>
      {rows.length === 0 ? (
        <p className="muted">No submissions yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left muted-2 mono text-xs uppercase tracking-wider">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Who</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Fit</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t line">
                <td className="py-3 pr-4 mono num">
                  {new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td className="py-3 pr-4">
                  <Link href={`/admin/${r.id}`} className="font-medium hover:opacity-70">
                    {r.name}
                  </Link>
                  <div className="muted-2 text-xs">{r.company ?? '—'}</div>
                </td>
                <td className="py-3 pr-4 mono text-xs">{r.classification?.engagementType ?? '—'}</td>
                <td className="py-3 pr-4 mono text-xs">
                  {r.classification ? `${r.classification.fitScore}/5` : '—'}
                </td>
                <td className="py-3 pr-4 mono text-xs">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
