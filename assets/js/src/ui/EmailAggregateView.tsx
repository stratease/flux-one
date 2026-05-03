import React, { useEffect, useMemo, useState } from 'react';
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

export type EmailAggregateCachedSummaries = {
  by_event_id?: Record<string, EmailSummaryEntry>;
  urgent_event_ids?: number[];
};

export type EmailAggregatePayload = {
  meta?: { days?: number; eventsCount?: number; page?: number; totalPages?: number; total?: number };
  summary?: string;
  groups?: Array<{ subject: string; count: number; latest?: string | null }>;
  events?: EmailAggregateEvent[];
  summaries?: EmailAggregateCachedSummaries;
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

/**
 * @param map Cached summaries for visible page.
 * @param eventId Event id.
 * @return Summary entry with non-empty text, or null.
 * @since 1.2.0
 */
function getUsableSummary(
  map: EmailSummaryMap | null | undefined,
  eventId: number
): EmailSummaryEntry | null {
  const ent = map?.[eventId];
  if (!ent || trimStr(ent.summary) === '') {
    return null;
  }
  return ent;
}

/**
 * Accessible name for list rows; includes subject even when omitted visually on summarized rows.
 *
 * @since 1.2.0
 * @since 1.4.0 Includes urgent flag and suggested action for summarized rows.
 */
function ariaLabelForEmailListOption(ev: EmailAggregateEvent, summaryEnt: EmailSummaryEntry | null): string {
  const subj = subjectKey(ev.subject || '');
  if (summaryEnt) {
    const urgent = summaryEnt.isUrgent === true ? 'Urgent. ' : '';
    const sum = trimStr(summaryEnt.summary);
    const act = trimStr(summaryEnt.action || '');
    const actionPart = act !== '' ? ` Action: ${act}.` : '';
    if (sum !== '') {
      return `${urgent}${subj}. ${sum}.${actionPart}`.trim();
    }
    return `${urgent}${subj}.${actionPart}`.trim();
  }
  return `${subj}. ${ev.createdAt}`;
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

/**
 * Detail pane for one email (body + metadata). AI summary lives in list rows only.
 *
 * @since 1.2.0
 * @since 1.4.0 Detail shell uses flat styling (no card chrome) for readability.
 */
function EmailEventDetailPanel({
  ev,
  onReleased,
  onDeleted,
}: {
  ev: EmailAggregateEvent;
  onReleased: (eventId: number) => void;
  onDeleted?: (eventId: number) => void;
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
    <div id={`flux-one-email-event-${ev.id}`} className="flux-one-email-modal-email flux-one-email-detail-shell">
      <div className="flux-one-email-event-header">
        <div className="flux-one-email-event-subject">{subjectKey(ev.subject || '')}</div>
        <div className="flux-one-email-event-meta-line">
          <span>{ev.createdAt}</span>
          <span aria-hidden="true"> · </span>
          <span>To: {formatTo(p)}</span>
        </div>
      </div>
      <div className="flux-one-flex-row-gap flux-one-email-detail-actions">
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

function EventBlock({
  ev,
  onReleased,
  onDeleted,
  variant = 'list',
  showSubject = false,
}: {
  ev: EmailAggregateEvent;
  onReleased: (eventId: number) => void;
  onDeleted?: (eventId: number) => void;
  variant?: 'modal' | 'list';
  showSubject?: boolean;
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
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

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

  const { summarizedEvents, unsummarizedEvents } = useMemo(() => {
    const summarized: EmailAggregateEvent[] = [];
    const unsummarized: EmailAggregateEvent[] = [];
    for (const ev of visibleEvents) {
      if (getUsableSummary(emailSummaries, ev.id)) {
        summarized.push(ev);
      } else {
        unsummarized.push(ev);
      }
    }
    return { summarizedEvents: summarized, unsummarizedEvents: unsummarized };
  }, [visibleEvents, emailSummaries]);

  const orderedEvents = useMemo(
    () => [...summarizedEvents, ...unsummarizedEvents],
    [summarizedEvents, unsummarizedEvents]
  );

  useEffect(() => {
    if (mode !== 'flat_all') {
      return;
    }
    if (orderedEvents.length === 0) {
      setSelectedEventId(null);
      return;
    }
    const ids = new Set(orderedEvents.map((e) => e.id));
    if (selectedEventId != null && ids.has(selectedEventId)) {
      return;
    }
    setSelectedEventId(orderedEvents[0].id);
  }, [mode, orderedEvents, selectedEventId]);

  const selectedEventInOrderedList = useMemo(() => {
    if (mode !== 'flat_all') {
      return null;
    }
    return orderedEvents.find((e) => e.id === selectedEventId) ?? null;
  }, [mode, orderedEvents, selectedEventId]);

  if (!data) {
    return <div className="flux-one-email-empty">No data.</div>;
  }

  if (mode === 'flat_all') {
    return (
      <div className="flux-one-email-aggregate">
        <div className="flux-one-email-window-meta">
          Window: {meta.days != null ? `${meta.days} day(s)` : '—'} · Events: {visibleEvents.length}
        </div>

        <div className="flux-one-email-master-detail">
          <div className="flux-one-email-list-pane">
            <div className="flux-one-email-list-header">
              <span>Emails ({orderedEvents.length})</span>
            </div>

            <div className="flux-one-email-list-scroll">
              {orderedEvents.length === 0 ? (
                <div className="flux-one-email-list-empty">No emails on this page.</div>
              ) : (
                <ul role="listbox" aria-label="Emails on this page" className="flux-one-email-list">
                  {summarizedEvents.length > 0 ? (
                    <li className="flux-one-email-list-item flux-one-email-list-item--section" role="presentation">
                      <div className="flux-one-email-list-section-label">Summarized</div>
                    </li>
                  ) : null}
                  {summarizedEvents.map((ev) => {
                    const ent = getUsableSummary(emailSummaries, ev.id);
                    if (!ent) {
                      return null;
                    }
                    const hasAction = trimStr(ent.action) !== '';
                    const isUrgent = Boolean(ent.isUrgent);
                    const rowClass = [
                      'flux-one-email-list-row',
                      'flux-one-email-list-row--summarized',
                      isUrgent ? 'flux-one-email-list-row--urgent' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <li key={ev.id} className="flux-one-email-list-item">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedEventId === ev.id}
                          className={rowClass}
                          data-testid={`flux-one-email-list-option-${ev.id}`}
                          title={ent.summary}
                          aria-label={ariaLabelForEmailListOption(ev, ent)}
                          onClick={() => setSelectedEventId(ev.id)}
                        >
                          <span className="flux-one-email-list-row-stack">
                            {isUrgent ? (
                              <span className="flux-one-email-list-row-badge-row" aria-hidden="true">
                                <span className="flux-one-email-urgent-badge">Urgent</span>
                              </span>
                            ) : null}
                            <span className="flux-one-email-list-row-primary flux-one-email-list-row-summary">
                              {ent.summary}
                            </span>
                            {hasAction ? (
                              <span className="flux-one-email-list-row-action-block">
                                <span className="flux-one-email-list-row-action-label">Action</span>
                                <span className="flux-one-email-list-row-action-text">{ent.action}</span>
                              </span>
                            ) : null}
                            <span className="flux-one-email-list-row-secondary flux-one-email-list-row-secondary--meta">
                              <span className="flux-one-email-list-row-meta">{ev.createdAt}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {unsummarizedEvents.length > 0 ? (
                    <li className="flux-one-email-list-item flux-one-email-list-item--section" role="presentation">
                      <div className="flux-one-email-list-section-label">Not summarized</div>
                    </li>
                  ) : null}
                  {unsummarizedEvents.map((ev) => (
                    <li key={ev.id} className="flux-one-email-list-item">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedEventId === ev.id}
                        className="flux-one-email-list-row"
                        data-testid={`flux-one-email-list-option-${ev.id}`}
                        aria-label={ariaLabelForEmailListOption(ev, null)}
                        onClick={() => setSelectedEventId(ev.id)}
                      >
                        <span className="flux-one-email-list-row-primary">
                          {subjectKey(ev.subject || '')}
                        </span>
                        <span className="flux-one-email-list-row-secondary">
                          <span className="flux-one-email-list-row-meta">{ev.createdAt}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flux-one-email-detail-pane" role="region" aria-label="Selected email details">
            {!selectedEventInOrderedList ? (
              <div className="flux-one-email-empty">No email selected.</div>
            ) : (
              <EmailEventDetailPanel
                ev={selectedEventInOrderedList}
                onReleased={(eventId) => {
                  setReleasedIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
                }}
                onDeleted={(eventId) => {
                  setDeletedIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
                }}
              />
            )}
          </div>
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
        size="wide"
      >
        <div className="flux-one-modal-doc-list flux-one-modal-doc-list--modal-view">
          {modalEvents.map((ev) => (
            <EventBlock
              key={ev.id}
              ev={ev}
              variant="modal"
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
