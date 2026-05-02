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

export type EmailSummaryEntry = {
  summary: string;
  action?: string;
  isUrgent: boolean;
  summarizedAt?: string;
};

export type EmailSummaryMap = Record<number, EmailSummaryEntry>;

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
  function maybeDecodeEntities(s: string): string {
    const raw = String(s || '');
    // If it already contains real tags, don't decode (avoid unintended changes).
    if (/[<][a-zA-Z!/]/.test(raw)) return raw;
    // Only decode if it looks like escaped HTML.
    if (!raw.includes('&lt;') || !raw.includes('&gt;')) return raw;
    try {
      const ta = document.createElement('textarea');
      ta.innerHTML = raw;
      return ta.value || raw;
    } catch {
      return raw;
    }
  }

  const srcDoc = useMemo(() => {
    const body = maybeDecodeEntities(html);
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

function EmailRaw({ text }: { text: string }) {
  const body = String(text || '');
  if (!body.trim()) return null;
  return <pre className="flux-one-email-pre">{body}</pre>;
}

function scrollToEmailEvent(eventId: number) {
  const el = document.getElementById(`flux-one-email-event-${eventId}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function EventBlock({
  ev,
  onReleased,
  onDeleted,
  variant = 'list',
  showSubject = false,
  summaryEntry,
}: {
  ev: EmailAggregateEvent;
  onReleased: (eventId: number) => void;
  onDeleted?: (eventId: number) => void;
  variant?: 'modal' | 'list';
  showSubject?: boolean;
  summaryEntry?: EmailSummaryEntry | null;
}) {
  const p = ev.payload || {};
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function onDelete() {
    if (deleting) return;
    const ok = window.confirm('Delete this captured email? This cannot be undone.');
    if (!ok) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteAggregateEmailEvent(ev.id);
      onDeleted?.(ev.id);
    } catch (e: any) {
      const msg = String(e?.message || e?.data?.message || e?.message || 'Delete failed.');
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div id={`flux-one-email-event-${ev.id}`} className="flux-one-email-modal-email flux-one-email-card">
      {showSubject ? (
        <div className="flux-one-email-card-title">{subjectKey(ev.subject || '')}</div>
      ) : null}
      {summaryEntry && trimStr(summaryEntry.summary) !== '' ? (
        <div className="flux-one-email-summary-block">
          <span className="flux-one-email-summary-label">AI summary: </span>
          <span>{summaryEntry.summary}</span>
          {summaryEntry.action && trimStr(summaryEntry.action) !== '' ? (
            <span className="flux-one-email-summary-action">
              <span className="flux-one-email-summary-label">Action: </span>
              {summaryEntry.action}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flux-one-flex-between-wrap">
        {variant === 'modal' ? (
          <div className="flux-one-email-event-header">
            <div className="flux-one-email-event-subject">{subjectKey(ev.subject || '')}</div>
            <div className="flux-one-email-event-date">{ev.createdAt}</div>
          </div>
        ) : (
          <div className="flux-one-email-event-line">{eventLine(ev, 160)}</div>
        )}
        <div className="flux-one-flex-row-gap">
          <button
            type="button"
            className="button button-small"
            onClick={onRelease}
            disabled={releasing}
            aria-disabled={releasing}
          >
            {releasing ? 'Releasing…' : 'Release'}
          </button>
          <button
            type="button"
            className="button button-small"
            onClick={onDelete}
            disabled={deleting}
            aria-disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {releaseError ? <div className="flux-one-email-error">{releaseError}</div> : null}
      {deleteError ? <div className="flux-one-email-error">{deleteError}</div> : null}

      {p.messageHtml ? (
        <div className="flux-one-preview-stack">
          <div className="flux-one-email-body-label">Body</div>
          <EmailHtml html={p.messageHtml} />
        </div>
      ) : p.message ? (
        <div className="flux-one-preview-stack">
          <div className="flux-one-email-body-label">Body</div>
          <EmailRaw text={String(p.message || '')} />
        </div>
      ) : null}
    </div>
  );
}

export function EmailAggregateView({
  data,
  mode = 'grouped',
  emailSummaries,
}: {
  data: EmailAggregatePayload | null | undefined;
  mode?: 'flat_all' | 'grouped';
  emailSummaries?: EmailSummaryMap | null;
}) {
  const [modalSubject, setModalSubject] = useState<string | null>(null);
  const [releasedIds, setReleasedIds] = useState<number[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);

  const meta = data?.meta || {};

  const visibleEvents = useMemo(() => {
    const events = Array.isArray(data?.events) ? data!.events! : [];
    if (!releasedIds.length && !deletedIds.length) return events;
    const gone = new Set([...releasedIds, ...deletedIds]);
    return events.filter((e) => !gone.has(e.id));
  }, [data?.events, releasedIds, deletedIds]);

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
    return <div className="flux-one-email-empty">No data.</div>;
  }

  const summaryStrip = (() => {
    if (!emailSummaries || visibleEvents.length === 0) return null;
    const rows: { id: number; text: string; urgent: boolean }[] = [];
    for (const ev of visibleEvents) {
      const ent = emailSummaries[ev.id];
      if (ent && trimStr(ent.summary) !== '') {
        rows.push({ id: ev.id, text: ent.summary, urgent: !!ent.isUrgent });
      }
    }
    if (rows.length === 0) return null;
    return (
      <div className="flux-one-email-summary-strip">
        <div className="flux-one-email-summary-strip-title">Summaries (this page)</div>
        <ul className="flux-one-email-summary-list">
          {rows.map((r) => (
            <li key={r.id} className="flux-one-email-summary-li">
              <a
                href={`#flux-one-email-event-${r.id}`}
                data-testid={`flux-one-email-summary-link-${r.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToEmailEvent(r.id);
                }}
              >
                {r.urgent ? '⚠ ' : ''}
                {r.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  })();

  if (mode === 'flat_all') {
    return (
      <div className="flux-one-email-aggregate">
        <div className="flux-one-email-window-meta">
          Window: {meta.days != null ? `${meta.days} day(s)` : '—'} · Events: {visibleEvents.length}
        </div>
        {summaryStrip}
        <div className="flux-one-modal-doc-list flux-one-modal-doc-list--tall">
          {visibleEvents.map((ev) => (
            <EventBlock
              key={ev.id}
              ev={ev}
              variant="modal"
              summaryEntry={emailSummaries?.[ev.id] ?? null}
              onReleased={(eventId) => {
                setReleasedIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
              }}
              onDeleted={(eventId) => {
                setDeletedIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flux-one-email-aggregate">
      {data.summary ? <p className="flux-one-email-summary-lead">{data.summary}</p> : null}
      <div className="flux-one-email-window-meta">
        Window: {meta.days != null ? `${meta.days} day(s)` : '—'} · Events logged: {visibleEvents.length}
      </div>
      {groups.length === 0 ? (
        <div className="flux-one-email-empty-window">No grouped subjects in this window.</div>
      ) : (
        <div className="flux-one-email-group-scroll">
          {groups.map((g) => {
            const evs = eventsBySubject[g.subject] || [];
            const preview = evs.slice(0, 2);
            const canOpenModal = evs.length > 0;
            return (
              <div key={g.subject} className="flux-one-email-group-row">
                <div className="flux-one-email-group-subject">{g.subject}</div>
                <div className="flux-one-email-group-meta">Latest: {g.latest || '—'}</div>
                {preview.map((ev) => (
                  <div key={ev.id} className="flux-one-email-group-preview">
                    {eventLine(ev, 120)}
                  </div>
                ))}
                {canOpenModal ? (
                  <button
                    type="button"
                    className="button button-small flux-one-email-view-btn"
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
        <div className="flux-one-modal-doc-list flux-one-modal-doc-list--modal-view">
          {modalEvents.map((ev) => (
            <EventBlock
              key={ev.id}
              ev={ev}
              variant="modal"
              summaryEntry={emailSummaries?.[ev.id] ?? null}
              onReleased={(eventId) => {
                setReleasedIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
              }}
              onDeleted={(eventId) => {
                setDeletedIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
              }}
            />
          ))}
        </div>
      </FluxOneModal>
    </div>
  );
}
