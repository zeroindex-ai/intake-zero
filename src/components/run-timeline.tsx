'use client';

import { useEffect, useRef, useState } from 'react';

type Status = 'received' | 'enriching' | 'classifying' | 'drafting' | 'notifying' | 'sent' | 'failed';
type InFlightStatus = Exclude<Status, 'failed'>;

const STEPS: Array<{ key: InFlightStatus; label: string }> = [
  { key: 'received', label: 'Received' },
  { key: 'enriching', label: 'Reading your site' },
  { key: 'classifying', label: 'Classifying fit' },
  { key: 'drafting', label: 'Drafting a reply' },
  { key: 'notifying', label: 'Notifying Abhishek' },
  { key: 'sent', label: 'Confirmation sent' },
];

const ORDER: InFlightStatus[] = [
  'received',
  'enriching',
  'classifying',
  'drafting',
  'notifying',
  'sent',
];

// Each step stays visibly "active" at least this long before the timeline
// advances, so a backend step that finished faster than the 1.5s poll (notably
// `notifying`, often <1s) isn't skipped over silently between two polls.
const MIN_STEP_MS = 650;

export function RunTimeline({
  submissionId,
  initialStatus,
  initialFailedAtStep,
}: {
  submissionId: string;
  initialStatus: Status;
  initialFailedAtStep?: string | null;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [failedAtStep, setFailedAtStep] = useState<string | null>(initialFailedAtStep ?? null);

  // Mirror status into a ref so the polling effect can read the current value
  // without depending on `status`. Depending on it would tear down and recreate
  // the interval on every status transition; the ref lets the interval be set
  // up once (per submissionId) and self-cancel when it reaches a terminal state.
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (statusRef.current === 'sent' || statusRef.current === 'failed') return;
    let cancelled = false;
    const handle = setInterval(poll, 1500);

    async function poll() {
      try {
        const res = await fetch(`/api/intake/${submissionId}/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { status: Status; failedAtStep?: string | null };
        if (cancelled) return;
        setStatus(json.status);
        if (json.failedAtStep !== undefined) setFailedAtStep(json.failedAtStep);
        // Terminal state reached — stop polling without recreating the interval.
        if (json.status === 'sent' || json.status === 'failed') clearInterval(handle);
      } catch {
        // ignore — next tick will retry
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [submissionId]);

  // targetIdx — where the backend says we are:
  //   'sent'                   → ORDER.length (every step done)
  //   'failed' with known step → index of that step (failed marker on it, prior done, later pending)
  //   'failed' with no step    → -1 (legacy rows pre-failedAtStep column; render all pending)
  //   in-flight                → index of the current step
  const targetIdx =
    status === 'sent'
      ? ORDER.length
      : status === 'failed'
        ? failedAtStep
          ? ORDER.indexOf(failedAtStep as InFlightStatus)
          : -1
        : ORDER.indexOf(status as InFlightStatus);

  // displayIdx trails targetIdx, advancing one step at a time with a minimum
  // dwell so a step the backend blew through faster than the poll still gets a
  // visible "active" moment. Seeded at the initial target so an already-finished
  // run (revisited later) renders complete at once rather than re-animating.
  const [displayIdx, setDisplayIdx] = useState(targetIdx);
  useEffect(() => {
    if (displayIdx === targetIdx) return;
    // Advance one step toward target after a min dwell; if target ever regresses
    // (e.g. a late failure with no recorded step → -1) snap straight to it. Both
    // run inside the timer rather than synchronously in the effect, so the update
    // can't trigger a cascading render.
    const advancing = displayIdx < targetIdx;
    const t = setTimeout(
      () => setDisplayIdx((d) => (advancing ? d + 1 : targetIdx)),
      advancing ? MIN_STEP_MS : 0,
    );
    return () => clearTimeout(t);
  }, [displayIdx, targetIdx]);

  return (
    <ol className="space-y-3">
      {STEPS.map((step, i) => {
        const state: 'done' | 'active' | 'pending' | 'failed' =
          status === 'failed' && i === targetIdx && displayIdx >= targetIdx
            ? 'failed'
            : i < displayIdx
              ? 'done'
              : i === displayIdx
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
                      : state === 'failed'
                        ? 'var(--error)'
                        : 'var(--bg-soft)',
                border:
                  state === 'pending' ? '1px solid var(--line-strong)' : '1px solid transparent',
              }}
            >
              {state === 'done' ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : state === 'failed' ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
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
              style={{ fontWeight: state === 'active' || state === 'failed' ? 600 : 400 }}
            >
              {step.label}
              {state === 'active' ? <span className="muted-2"> &middot; in progress</span> : null}
              {state === 'failed' ? (
                <span style={{ color: 'var(--error)' }}> &middot; failed</span>
              ) : null}
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
