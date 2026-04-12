import React from 'react';

export type EmailAggregatePayload = {
  meta?: { days?: number; eventsCount?: number };
  summary?: string;
  groups?: Array<{ subject: string; count: number; latest?: string | null }>;
  events?: unknown[];
};

export function EmailAggregateView({ data }: { data: EmailAggregatePayload | null | undefined }) {
  if (!data) {
    return <div style={{ opacity: 0.75, fontSize: 13 }}>No data.</div>;
  }

  const meta = data.meta || {};
  const groups = Array.isArray(data.groups) ? data.groups : [];

  return (
    <div className="flux-one-email-aggregate">
      {data.summary ? (
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600 }}>{data.summary}</p>
      ) : null}
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        Window: {meta.days != null ? `${meta.days} day(s)` : '—'} · Events logged:{' '}
        {meta.eventsCount != null ? meta.eventsCount : '—'}
      </div>
      {groups.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.8 }}>No grouped subjects in this window.</div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 280 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
                <th style={{ padding: '6px 8px' }}>Subject</th>
                <th style={{ padding: '6px 8px', width: 72 }}>Count</th>
                <th style={{ padding: '6px 8px', width: 140 }}>Latest</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.subject} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>{g.subject}</td>
                  <td style={{ padding: '6px 8px' }}>{g.count}</td>
                  <td style={{ padding: '6px 8px', opacity: 0.8, fontSize: 12 }}>{g.latest || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
