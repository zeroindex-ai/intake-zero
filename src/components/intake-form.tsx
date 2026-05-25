'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STACK_OPTIONS } from '@/lib/stack';

const TIMELINE_OPTIONS = ['ASAP', '1-3 months', '3-6 months', 'Exploring'];
const BUDGET_OPTIONS = ['< $10k', '$10-25k', '$25-75k', '$75k+', 'Not sure'];

// Outcome-phrased so a non-engineer can self-identify; doubles as the strongest
// intent signal to the classifier when the prose is thin. Distilled from the
// zeroindex.ai Services + Use Cases (not verbatim).
const LOOKING_FOR: ReadonlyArray<{ value: string; hint: string }> = [
  { value: 'Build something with AI', hint: 'A production app, API, or feature with Claude inside' },
  { value: 'Add AI to an existing product', hint: 'Search, an assistant, or automation in what you already have' },
  { value: 'Automate a workflow', hint: 'Triage, classify, summarize, or route repetitive work' },
  { value: 'Make sense of documents', hint: 'Pull structured data from contracts, invoices, or forms' },
  { value: 'Data + AI', hint: 'Pipelines, warehouses, or natural-language access to your data' },
  { value: 'Trust AI in production', hint: 'Monitoring, evals, and tracing so you know what the model did' },
  { value: 'Help my team adopt AI', hint: 'Hands-on enablement in how you build and work' },
  { value: 'An honest assessment first', hint: "Where AI fits — and where it doesn't — before you commit" },
  { value: 'Not sure yet', hint: "Help me figure out what's possible" },
];

const TEAM_SIZE_OPTIONS = ['Just me', '2–10', '11–50', '51–200', '200+'];
const CONTACT_OPTIONS = ['Email', 'Call'];
const REFERRAL_OPTIONS = ['Search', 'LinkedIn', 'GitHub', 'Word of mouth', 'Other'];

// Single-select chip row (click a selected chip to clear it). Matches the
// Timeline/Budget chip styling.
function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(on ? '' : o)}
              className="mono text-xs px-3 py-1.5 rounded-full transition-colors inline-flex items-center justify-center min-h-[40px] sm:min-h-0"
              style={{
                border: '1px solid var(--card-line)',
                background: on ? 'var(--accent-1)' : 'transparent',
                color: on ? 'var(--card-ink)' : 'var(--card-muted)',
                borderColor: on ? 'var(--accent-1)' : 'var(--card-line)',
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function IntakeForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [stack, setStack] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [teamSize, setTeamSize] = useState<string>('');
  const [contactPref, setContactPref] = useState<string>('');
  const [referral, setReferral] = useState<string>('');

  function toggleStack(item: string) {
    setStack((prev) => (prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]));
  }
  function toggleLookingFor(item: string) {
    setLookingFor((prev) => (prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]));
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
      phone: String(form.get('phone') ?? ''),
      problem: String(form.get('problem') ?? ''),
      url: String(form.get('url') ?? ''),
      lookingFor,
      stack,
      timeline,
      budget,
      teamSize,
      contactPref,
      referral,
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
      className="rounded-2xl p-8 md:p-10 max-w-[60rem] w-full"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="phone" className="field-label">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="Include country code if outside the US"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="url" className="field-label">
            Company URL
          </label>
          <input id="url" name="url" type="url" placeholder="https://" className="field-input" />
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="problem" className="field-label">
          What are you trying to solve? *
        </label>
        <textarea
          id="problem"
          name="problem"
          required
          rows={5}
          className="field-input resize-y"
          placeholder="A sentence or two is plenty — what you're hoping to do, plus any constraints or deadlines. Not sure how to phrase it? Pick from the options below."
        />
      </div>

      <div className="mb-8">
        <span className="field-label">What are you looking for? (tap any that apply)</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LOOKING_FOR.map((o) => {
            const on = lookingFor.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleLookingFor(o.value)}
                className="text-left rounded-xl p-3 transition-colors"
                style={{
                  border: `1px solid ${on ? 'var(--accent-1)' : 'var(--card-line)'}`,
                  background: on ? 'rgba(124, 58, 237, 0.10)' : 'transparent',
                }}
                aria-pressed={on}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--card-ink)' }}>
                    {o.value}
                  </span>
                  {on ? (
                    <span aria-hidden style={{ color: 'var(--accent-1)' }}>
                      ✓
                    </span>
                  ) : null}
                </div>
                <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--card-muted)' }}>
                  {o.hint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <ChipGroup label="Timeline" options={TIMELINE_OPTIONS} value={timeline} onChange={setTimeline} />
        <ChipGroup
          label="Budget signal"
          options={BUDGET_OPTIONS}
          value={budget}
          onChange={setBudget}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <ChipGroup label="Team size" options={TEAM_SIZE_OPTIONS} value={teamSize} onChange={setTeamSize} />
        <ChipGroup
          label="Prefer email or a call?"
          options={CONTACT_OPTIONS}
          value={contactPref}
          onChange={setContactPref}
        />
      </div>

      <div className="mb-8">
        <ChipGroup
          label="How did you hear about ZeroIndex?"
          options={REFERRAL_OPTIONS}
          value={referral}
          onChange={setReferral}
        />
      </div>

      <details className="mb-12">
        <summary
          className="field-label cursor-pointer select-none inline-flex items-center gap-1.5 [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden>▸</span> Tech stack{' '}
          <span style={{ color: 'var(--card-muted)' }}>(optional)</span>
        </summary>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {STACK_OPTIONS.map((s) => {
            const on = stack.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStack(s)}
                className="mono text-xs px-3 py-1.5 rounded-full transition-colors inline-flex items-center justify-center min-h-[40px] sm:min-h-0"
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
          {stack.length > 0 ? (
            <button
              type="button"
              onClick={() => setStack([])}
              className="mono text-xs px-2 py-1.5 ml-1 transition-opacity hover:opacity-100"
              style={{ color: 'var(--card-muted)', opacity: 0.7 }}
              aria-label="Reset stack selection"
              title="Reset"
            >
              Reset
            </button>
          ) : null}
        </div>
      </details>

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
