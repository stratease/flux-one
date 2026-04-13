import React, { useMemo, useState } from 'react';
import { FluxOneModal } from './FluxOneModal';

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

function eventLine(ev: EmailAggregateEvent, previewMax: number): string {
  const p = ev.payload || {};
  const prev = trimStr(p.messagePreview || '');
  const prevShort = prev
    ? prev.length > previewMax
      ? `${prev.slice(0, previewMax)}…`
      : prev
    : '';
  return `${ev.createdAt} · To: ${formatTo(p)} · ${ev.source || '—'}${prevShort ? ` · ${prevShort}` : ''}`;
}

function EventBlock({ ev }: { ev: EmailAggregateEvent }) {
  const p = ev.payload || {};
  return (
    <div style={{ marginBottom: 10, fontSize: 12 }}>
      <div>{eventLine(ev, 140)}</div>
      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer', fontSize: 11, opacity: 0.85 }}>Headers</summary>
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
    </div>
  );
}

export function EmailAggregateView({ data }: { data: EmailAggregatePayload | null | undefined }) {
  const [modalSubject, setModalSubject] = useState<string | null>(null);

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

  const modalEvents = modalSubject ? eventsBySubject[modalSubject] || [] : [];

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
          {groups.map((g) => {
            const evs = eventsBySubject[g.subject] || [];
            const preview = evs.slice(0, 2);
            const hasMore = evs.length > 2;
            return (
              <div
                key={g.subject}
                style={{
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  padding: '10px 0',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{g.subject}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                  Latest: {g.latest || '—'}
                </div>
                {preview.map((ev) => (
                  <div key={ev.id} style={{ fontSize: 12, opacity: 0.9, marginBottom: 4, paddingLeft: 4 }}>
                    {eventLine(ev, 120)}
                  </div>
                ))}
                {hasMore ? (
                  <button
                    type="button"
                    className="button button-small"
                    style={{ marginTop: 6 }}
                    onClick={() => setModalSubject(g.subject)}
                  >
                    View all ({evs.length})
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <FluxOneModal
        open={modalSubject !== null}
        onClose={() => setModalSubject(null)}
        title={modalSubject ? `Email: ${modalSubject}` : 'Email'}
      >
        <div className="flux-one-modal-doc-list" style={{ maxHeight: 'min(60vh, 420px)', overflow: 'auto' }}>
          {modalEvents.map((ev) => (
            <EventBlock key={ev.id} ev={ev} />
          ))}
        </div>
      </FluxOneModal>
    </div>
  );
}
