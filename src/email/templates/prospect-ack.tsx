import * as React from 'react';
import type { Submission } from '@/db/schema';

export function ProspectAck({ submission }: { submission: Submission }) {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#18181b', maxWidth: 560 }}>
      <p>Hi {submission.name.split(' ')[0] || 'there'},</p>
      <p>
        Thanks for reaching out about your project. I&rsquo;ve got it and will respond within one
        business day with whether it&rsquo;s a fit and what the next step looks like.
      </p>
      <p>
        If you want to add anything in the meantime &mdash; constraints, deadlines, existing tooling
        &mdash; just reply to this email.
      </p>
      <p style={{ marginTop: 24 }}>&mdash; Abhishek</p>
      <p style={{ color: '#71717a', fontSize: 12, marginTop: 24 }}>
        ZeroIndex &middot; an AI-native software consultancy &middot; zeroindex.ai
      </p>
    </div>
  );
}
