import React, { useMemo, useState } from 'react';
import { api } from '../utils/api';
import { FluxOneModal } from './FluxOneModal';

export type EmailEventPayload = {
  to?: unknown;
  headers?: unknown;
  messagePreview?: string;
  message?: string;
  messageHtml?: string;
  messageIsHtml?: boolean;
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

function EmailHtml({ html }: { html: string }) {
  const srcDoc = useMemo(() => {
    const body = String(html || '');
    // Keep srcDoc simple + self-contained; rely on browser default styles.
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${body}</body></html>`;
  }, [html]);

  return (
    <iframe
      title="Email HTML"
      sandbox=""
      className="flux-one-email-html-frame"
      srcDoc={srcDoc}
    />
  );
}

function EventBlock({
  ev,
  onReleased,
}: {
  ev: EmailAggregateEvent;
  onReleased: (eventId: number) => void;
}) {
  const p = ev.payload || {};
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  async function onRelease() {
    if (releasing) return;
    setReleasing(true);
    setReleaseError(null);
    try {
      await api.releaseAggregateEmailEvent(ev.id);
      onReleased(ev.id);
    } catch (e: any) {
      const msg = String(e?.message || e?.data?.message || e?.message || 'Release failed.');
      setReleaseError(msg);
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div
      className="flux-one-email-modal-email"
      style={{
        marginBottom: 12,
        fontSize: 12,
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.10)',
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{eventLine(ev, 160)}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="button button-small"
            onClick={onRelease}
            disabled={releasing}
            aria-disabled={releasing}
          >
            {releasing ? 'Releasing…' : 'Release'}
          </button>
        </div>
      </div>

      {releaseError ? (
        <div style={{ marginTop: 8, fontSize: 12, color: '#8a2424' }}>{releaseError}</div>
      ) : null}

      {p.messageHtml ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 6 }}>Body</div>
          <EmailHtml html={p.messageHtml} />
        </div>
      ) : null}

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 11, opacity: 0.85 }}>Headers</summary>
        <pre
          className="flux-one-email-aggregate-headers"
          style={{
            margin: '6px 0 0',
            padding: 8,
            fontSize: 11,
            maxHeight: 160,
            overflow: 'auto',
            background: 'rgba(0,0,0,0.04)',
            borderRadius: 6,
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
  const [releasedIds, setReleasedIds] = useState<number[]>([]);

  const meta = data?.meta || {};

  const visibleEvents = useMemo(() => {
    const events = Array.isArray(data?.events) ? data!.events! : [];
    if (!releasedIds.length) return events;
    const gone = new Set(releasedIds);
    return events.filter((e) => !gone.has(e.id));
  }, [data?.events, releasedIds]);

  const eventsBySubject = useMemo(() => {
    const map: Record<string, EmailAggregateEvent[]> = {};
    for (const e of visibleEvents) {
      const k = subjectKey(e.subject || '');
      if (!map[k]) map[k] = [];
      map[k].push(e);
    }
    return map;
  }, [visibleEvents]);

  const modalEvents = modalSubject ? eventsBySubject[modalSubject] || [] : [];
  const groups = useMemo(() => {
    const out: Array<{ subject: string; count: number; latest?: string | null }> = [];
    for (const subject of Object.keys(eventsBySubject)) {
      const evs = eventsBySubject[subject] || [];
      if (!evs.length) continue;
      out.push({
        subject,
        count: evs.length,
        latest: evs[0]?.createdAt ?? null,
      });
    }
    out.sort((a, b) => (b.count || 0) - (a.count || 0));
    return out;
  }, [eventsBySubject]);

  if (!data) {
    return <div style={{ opacity: 0.75, fontSize: 13 }}>No data.</div>;
  }

  return (
    <div className="flux-one-email-aggregate">
      {data.summary ? (
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600 }}>{data.summary}</p>
      ) : null}
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        Window: {meta.days != null ? `${meta.days} day(s)` : '—'} · Events logged:{' '}
        {visibleEvents.length}
      </div>
      {groups.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.8 }}>No grouped subjects in this window.</div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 280 }}>
          {groups.map((g) => {
            const evs = eventsBySubject[g.subject] || [];
            const preview = evs.slice(0, 2);
            const canOpenModal = evs.length > 0;
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
                {canOpenModal ? (
                  <button
                    type="button"
                    className="button button-small"
                    style={{ marginTop: 6 }}
                    onClick={() => setModalSubject(g.subject)}
                  >
                    {evs.length > 2 ? `View all (${evs.length})` : 'View details'}
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
        className="flux-one-modal--wide"
      >
        <div
          className="flux-one-modal-doc-list"
          style={{
            maxHeight: 'min(70vh, 640px)',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {modalEvents.map((ev) => (
            <EventBlock
              key={ev.id}
              ev={ev}
              onReleased={(eventId) => {
                setReleasedIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
              }}
            />
          ))}
        </div>
      </FluxOneModal>
    </div>
  );
}
