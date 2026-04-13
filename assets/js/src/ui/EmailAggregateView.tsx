import React, { useMemo, useState } from 'react';

export type EmailEventPayload = {
  to?: unknown;
  headers?: unknown;
  messagePreview?: string;
};

export type EmailAggregateEvent = {
  id: number;
  source: string;
  type: string;
  subject: string;
  payload?: EmailEventPayload | null;
  createdAt: string;
};

export type EmailAggregatePayload = {
  meta?: { days?: number; eventsCount?: number };
  summary?: string;
  groups?: Array<{ subject: string; count: number; latest?: string | null }>;
  events?: EmailAggregateEvent[];
};

function subjectKey(subject: string): string {
  const t = trimStr(subject);
  return t === '' ? '(no subject)' : t;
}

function trimStr(s: string): string {
  return String(s || '').trim();
}

function formatTo(payload: EmailEventPayload | null | undefined): string {
  const t = payload?.to;
  if (t == null) return '—';
  if (Array.isArray(t)) return t.map(String).join(', ');
  return String(t);
}

function formatHeaders(payload: EmailEventPayload | null | undefined): string {
  const h = payload?.headers;
  if (h == null) return '';
  if (Array.isArray(h)) return h.join('\n');
  return String(h);
}

export function EmailAggregateView({ data }: { data: EmailAggregatePayload | null | undefined }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const eventsBySubject = useMemo(() => {
    const events = Array.isArray(data?.events) ? data!.events! : [];
    const map: Record<string, EmailAggregateEvent[]> = {};
    for (const e of events) {
      const k = subjectKey(e.subject || '');
      if (!map[k]) map[k] = [];
      map[k].push(e);
    }
    return map;
  }, [data?.events]);

  if (!data) {
    return <div style={{ opacity: 0.75, fontSize: 13 }}>No data.</div>;
  }

  const meta = data.meta || {};
  const groups = Array.isArray(data.groups) ? data.groups : [];

  const toggle = (subject: string) => {
    setExpanded((prev) => ({ ...prev, [subject]: !prev[subject] }));
  };

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
                <th style={{ padding: '6px 8px', width: 36 }} aria-label="Expand" />
                <th style={{ padding: '6px 8px' }}>Subject</th>
                <th style={{ padding: '6px 8px', width: 72 }}>Count</th>
                <th style={{ padding: '6px 8px', width: 140 }}>Latest</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isOpen = !!expanded[g.subject];
                const evs = eventsBySubject[g.subject] || [];
                return (
                  <React.Fragment key={g.subject}>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                        <button
                          type="button"
                          className="flux-one-email-aggregate-toggle"
                          aria-expanded={isOpen}
                          onClick={() => toggle(g.subject)}
                          disabled={evs.length === 0}
                        >
                          {evs.length === 0 ? '—' : isOpen ? '▼' : '▶'}
                        </button>
                      </td>
                      <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>{g.subject}</td>
                      <td style={{ padding: '6px 8px' }}>{g.count}</td>
                      <td style={{ padding: '6px 8px', opacity: 0.8, fontSize: 12 }}>{g.latest || '—'}</td>
                    </tr>
                    {isOpen && evs.length > 0 ? (
                      <tr key={`${g.subject}-detail`} className="flux-one-email-aggregate-detail">
                        <td colSpan={4} style={{ padding: '0 8px 12px 48px', background: 'rgba(0,0,0,0.02)' }}>
                          <ul style={{ margin: 0, padding: '8px 0 0 16px', listStyle: 'disc' }}>
                            {evs.map((ev) => {
                              const p = ev.payload || {};
                              const prev = trimStr(p.messagePreview || '');
                              const line = `${ev.createdAt} · To: ${formatTo(p)} · ${ev.source || '—'}${
                                prev ? ` · ${prev.length > 140 ? `${prev.slice(0, 140)}…` : prev}` : ''
                              }`;
                              return (
                                <li key={ev.id} style={{ marginBottom: 8, fontSize: 12 }}>
                                  <div>{line}</div>
                                  <details style={{ marginTop: 4 }}>
                                    <summary style={{ cursor: 'pointer', fontSize: 11, opacity: 0.85 }}>
                                      Headers
                                    </summary>
                                    <pre
                                      className="flux-one-email-aggregate-headers"
                                      style={{
                                        margin: '6px 0 0',
                                        padding: 8,
                                        fontSize: 11,
                                        maxHeight: 120,
                                        overflow: 'auto',
                                        background: 'rgba(0,0,0,0.04)',
                                        borderRadius: 4,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                      }}
                                    >
                                      {formatHeaders(p) || '—'}
                                    </pre>
                                  </details>
                                </li>
                              );
                            })}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
