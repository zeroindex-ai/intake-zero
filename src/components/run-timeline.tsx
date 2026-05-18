'use client';

import { useEffect, useState } from 'react';

type Status = 'received' | 'enriching' | 'classifying' | 'drafting' | 'notifying' | 'sent' | 'failed';

const STEPS: Array<{ key: Status; label: string }> = [
  { key: 'received', label: 'Received' },
  { key: 'enriching', label: 'Reading your site' },
  { key: 'classifying', label: 'Classifying fit' },
  { key: 'drafting', label: 'Drafting a reply' },
  { key: 'notifying', label: 'Notifying Abhishek' },
  { key: 'sent', label: 'Confirmation sent' },
];

const ORDER: Status[] = ['received', 'enriching', 'classifying', 'drafting', 'notifying', 'sent'];

export function RunTimeline({
  submissionId,
  initialStatus,
}: {
  submissionId: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);

  useEffect(() => {
    if (status === 'sent' || status === 'failed') return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/intake/${submissionId}/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { status: Status };
        if (!cancelled) setStatus(json.status);
      } catch {
        // ignore — next tick will retry
      }
    }

    const handle = setInterval(poll, 1500);
    poll();
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [submissionId, status]);

  const currentIdx = ORDER.indexOf(status);

  return (
    <ol className="space-y-3">
      {STEPS.map((step, i) => {
        const state: 'done' | 'active' | 'pending' =
          status === 'failed'
            ? i < currentIdx
              ? 'done'
              : i === currentIdx
                ? 'active'
                : 'pending'
            : i < currentIdx
              ? 'done'
              : i === currentIdx
                ? 'active'
                : 'pending';
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex items-center justify-center rounded-full"
              style={{
                width: 20,
                height: 20,
                background:
                  state === 'done'
                    ? 'var(--accent-go)'
                    : state === 'active'
                      ? 'var(--accent-1)'
                      : 'var(--bg-soft)',
                border:
                  state === 'pending' ? '1px solid var(--line-strong)' : '1px solid transparent',
              }}
            >
              {state === 'done' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : state === 'active' ? (
                <span
                  className="block rounded-full"
                  style={{ width: 8, height: 8, background: 'white' }}
                />
              ) : null}
            </span>
            <span
              className={state === 'pending' ? 'muted-2' : ''}
              style={{ fontWeight: state === 'active' ? 600 : 400 }}
            >
              {step.label}
              {state === 'active' ? <span className="muted-2"> &middot; in progress</span> : null}
            </span>
          </li>
        );
      })}
      {status === 'failed' ? (
        <li style={{ color: 'var(--error)' }} className="text-sm pt-2">
          Something went wrong on our side. Your submission was saved &mdash; Abhishek will see it.
        </li>
      ) : null}
    </ol>
  );
}
