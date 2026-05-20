import * as React from 'react';
import type { ClassificationResult, EnrichmentResult, Submission } from '@/db/schema';

type Props = {
  submission: Submission;
  enrichment: EnrichmentResult;
  classification: ClassificationResult;
  triage: string;
  baseUrl: string;
};

export function OwnerNotify({ submission, enrichment, classification, triage, baseUrl }: Props) {
  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#18181b',
        maxWidth: 640,
      }}
    >
      <h2 style={{ margin: '0 0 4px' }}>{submission.name}</h2>
      <div style={{ color: '#71717a', fontSize: 13, marginBottom: 16 }}>
        {submission.role ? `${submission.role} · ` : ''}
        {submission.company ?? '—'} · <a href={`mailto:${submission.email}`}>{submission.email}</a>
        {submission.phone ? (
          <>
            {' · '}
            <a href={`tel:${submission.phone}`}>{submission.phone}</a>
          </>
        ) : null}
      </div>

      <div style={{ background: '#f4f3ef', padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <strong>{classification.engagementType}</strong> · fit {classification.fitScore}/5
        <div style={{ color: '#52525b', fontSize: 14, marginTop: 4 }}>
          {classification.rationale}
        </div>
        {classification.suggestedCaseStudies.length > 0 ? (
          <div style={{ fontSize: 13, marginTop: 8 }}>
            Suggested case studies: {classification.suggestedCaseStudies.join(', ')}
          </div>
        ) : null}
      </div>

      <h3 style={{ margin: '0 0 6px', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
        Their problem
      </h3>
      <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>{submission.problem}</p>

      <h3 style={{ margin: '0 0 6px', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
        Draft reply
      </h3>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#fafaf9',
          border: '1px solid #cfc9bd',
          padding: 12,
          borderRadius: 8,
          margin: '0 0 16px',
        }}
      >
        {triage}
      </pre>

      <div style={{ fontSize: 13, color: '#52525b' }}>
        <div>Stack: {submission.stack.length ? submission.stack.join(', ') : '—'}</div>
        <div>Timeline: {submission.timeline ?? '—'}</div>
        <div>Budget: {submission.budget ?? '—'}</div>
        {submission.url ? <div>URL: {submission.url}</div> : null}
        {enrichment.fetched ? (
          <div>Enrichment signals: {enrichment.signals.join(', ') || '—'}</div>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <a href={`${baseUrl}/admin/${submission.id}`}>Open in admin →</a>
        </div>
      </div>
    </div>
  );
}
