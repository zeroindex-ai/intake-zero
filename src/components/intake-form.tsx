'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STACK_SUGGESTIONS = [
  'Next.js',
  'Python',
  'Postgres',
  'Anthropic',
  'OpenAI',
  'LangChain',
  'Supabase',
  'Vercel',
  'AWS',
  'Snowflake',
];

const TIMELINE_OPTIONS = ['ASAP', '1-3 months', '3-6 months', 'Exploring'];
const BUDGET_OPTIONS = ['< $10k', '$10-25k', '$25-75k', '$75k+', 'Not sure yet'];

export function IntakeForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stack, setStack] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<string>('');
  const [budget, setBudget] = useState<string>('');

  function toggleStack(item: string) {
    setStack((prev) => (prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      company: String(form.get('company') ?? ''),
      role: String(form.get('role') ?? ''),
      problem: String(form.get('problem') ?? ''),
      url: String(form.get('url') ?? ''),
      stack,
      timeline,
      budget,
    };

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Submission failed');
      router.push(`/runs/${json.submissionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ background: 'var(--card)', color: 'var(--card-ink)' }}
      className="rounded-2xl p-8 md:p-10 max-w-2xl w-full"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="name" className="field-label">
            Name *
          </label>
          <input id="name" name="name" required className="field-input" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="email" className="field-label">
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="field-input"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="company" className="field-label">
            Company
          </label>
          <input id="company" name="company" className="field-input" autoComplete="organization" />
        </div>
        <div>
          <label htmlFor="role" className="field-label">
            Role
          </label>
          <input id="role" name="role" className="field-input" />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="url" className="field-label">
          Company URL
        </label>
        <input id="url" name="url" type="url" placeholder="https://" className="field-input" />
      </div>

      <div className="mb-4">
        <label htmlFor="problem" className="field-label">
          What are you trying to solve? *
        </label>
        <textarea
          id="problem"
          name="problem"
          required
          rows={6}
          className="field-input resize-y"
          placeholder="The shorter and more concrete, the better. Constraints, deadlines, and existing tooling all help."
        />
      </div>

      <div className="mb-4">
        <span className="field-label">Stack (tap any that apply)</span>
        <div className="flex flex-wrap gap-2">
          {STACK_SUGGESTIONS.map((s) => {
            const on = stack.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStack(s)}
                className="mono text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{
                  border: '1px solid var(--card-line)',
                  background: on ? 'var(--accent-1)' : 'transparent',
                  color: on ? 'var(--card-ink)' : 'var(--card-muted)',
                  borderColor: on ? 'var(--accent-1)' : 'var(--card-line)',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <span className="field-label">Timeline</span>
          <div className="flex flex-wrap gap-2">
            {TIMELINE_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeline(t)}
                className="mono text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{
                  border: '1px solid var(--card-line)',
                  background: timeline === t ? 'var(--accent-1)' : 'transparent',
                  color: timeline === t ? 'var(--card-ink)' : 'var(--card-muted)',
                  borderColor: timeline === t ? 'var(--accent-1)' : 'var(--card-line)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="field-label">Budget signal</span>
          <div className="flex flex-wrap gap-2">
            {BUDGET_OPTIONS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBudget(b)}
                className="mono text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{
                  border: '1px solid var(--card-line)',
                  background: budget === b ? 'var(--accent-1)' : 'transparent',
                  color: budget === b ? 'var(--card-ink)' : 'var(--card-muted)',
                  borderColor: budget === b ? 'var(--accent-1)' : 'var(--card-line)',
                }}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ color: 'var(--error)' }} className="mb-4 text-sm">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold"
        style={{ background: 'var(--card-ink)', color: 'var(--card)' }}
      >
        {submitting ? 'Sending…' : 'Send intake'}
        <span aria-hidden>→</span>
      </button>
      <p className="muted-2 text-xs mt-3" style={{ color: 'var(--card-muted)' }}>
        Response within one business day. Nothing is shared with third parties.
      </p>
    </form>
  );
}
