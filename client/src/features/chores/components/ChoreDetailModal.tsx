import React, { useEffect, useMemo, useState } from 'react';
import { Chore, Person } from '../../../types';
import { Badge, Button, PointsBadge } from '../../../components/ui';
import { Modal } from '../../../components/common/Modal';
import { apiGet, resolveAssetUrl } from '../../../api';
import { detectChoreIcon, formatDaysTag } from '../choreUtils';

interface ChoreHistoryPayload {
  success: boolean;
  total: number;
  streak: number;
  on_time_pct: number;
  avg_points: number;
  day_keys: string[];
  per_day: Record<string, number>;
  recent: Array<{
    for_date: string;
    completed_at: string;
    person_name: string;
    points: number;
    was_overdue: boolean;
  }>;
}

export interface ChoreDetailModalProps {
  chore: Chore | null;
  person: Person | null;
  isCash: boolean;
  onClose: () => void;
  onComplete: (chore: Chore, person: Person) => void;
  onUndo: (choreId: number) => void;
  onStartTimer: (chore: Chore) => void;
}

const shortDay = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : String(d.getDate());
};

const friendlyDate = (iso: string): string => {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * Read-only chore view (kids / family). Tap a card → opens here with the same
 * actions as the card, plus a History tab built from real `chore_log` entries.
 */
export const ChoreDetailModal: React.FC<ChoreDetailModalProps> = ({
  chore,
  person,
  isCash,
  onClose,
  onComplete,
  onUndo,
  onStartTimer,
}) => {
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [history, setHistory] = useState<ChoreHistoryPayload | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const choreId = chore?.id || 0;

  useEffect(() => {
    if (!choreId) return;
    setTab('details');
    setHistory(null);
    setLoadingHistory(true);
    let cancelled = false;
    apiGet<ChoreHistoryPayload>(`chore_history/${choreId}`, 8000)
      .then((res: any) => {
        if (!cancelled && res?.success) setHistory(res);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [choreId]);

  const chartMax = useMemo(() => {
    if (!history) return 1;
    return Math.max(1, ...history.day_keys.map((key) => history.per_day[key] || 0));
  }, [history]);

  if (!chore) return null;

  const isDone = Boolean(chore.completed);
  const isTimed = Boolean(chore.duration_seconds && chore.duration_seconds > 0);
  const mins = isTimed ? Math.round((chore.duration_seconds || 0) / 60) : 0;
  const daysLabel = formatDaysTag(chore.days_of_week, chore.is_daily);
  const image = chore.image_url ? resolveAssetUrl(chore.image_url) : null;

  const footer = isDone ? (
    <Button variant="secondary" icon="fas fa-rotate-left" onClick={() => onUndo(chore.id)}>
      Undo completion
    </Button>
  ) : isTimed ? (
    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
      <Button
        variant="secondary"
        icon="fas fa-check"
        style={{ flex: '0 0 auto' }}
        onClick={() => person && onComplete(chore, person)}
      >
        Done
      </Button>
      <Button
        variant="primary"
        icon="fas fa-play"
        fullWidth
        onClick={() => {
          onStartTimer(chore);
          onClose();
        }}
      >
        Start timer · {mins}m
      </Button>
    </div>
  ) : (
    <Button variant="success" icon="fas fa-check" fullWidth onClick={() => person && onComplete(chore, person)}>
      I did it — {chore.points} {isCash ? 'cash' : '⭐'}
    </Button>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={chore.title}
      icon={chore.icon || detectChoreIcon(chore.title)}
      maxWidth={620}
      footer={footer}
    >
      {image && (
        <div
          className="cr-chore-detail__hero"
          style={{ margin: '0 0 14px', borderRadius: 'var(--card-radius, 16px)' }}
        >
          <img src={image} alt="" />
        </div>
      )}

      <div className="cr-chore-detail__chips">
        <PointsBadge amount={chore.points} isCash={isCash} />
        {isTimed && <Badge variant="info">⏱ {mins}m</Badge>}
        {daysLabel && <Badge variant="neutral">{daysLabel}</Badge>}
        {isDone && <Badge variant="success">Done today</Badge>}
      </div>

      <div className="cr-chore-detail__tabs">
        <button
          type="button"
          className={`cr-chore-detail__tab ${tab === 'details' ? 'is-active' : ''}`.trim()}
          onClick={() => setTab('details')}
        >
          📋 Details
        </button>
        <button
          type="button"
          className={`cr-chore-detail__tab ${tab === 'history' ? 'is-active' : ''}`.trim()}
          onClick={() => setTab('history')}
        >
          📈 History
        </button>
      </div>

      {tab === 'details' ? (
        <div>
          {chore.description ? (
            <p style={{ margin: '0 0 12px', color: 'var(--color-text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
              {chore.description}
            </p>
          ) : null}
          <div className="cr-chore-detail__row">
            <strong>For</strong>
            <span>{chore.assigned_to || person?.name || 'Anyone'}</span>
          </div>
          {chore.due_datetime ? (
            <div className="cr-chore-detail__row">
              <strong>Due</strong>
              <span>
                {new Date(chore.due_datetime.replace(' ', 'T')).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ) : null}
          <div className="cr-chore-detail__row">
            <strong>Reward</strong>
            <span>
              {chore.points} {isCash ? 'cash' : `⭐ point${chore.points === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="cr-chore-detail__row">
            <strong>Streak</strong>
            <span>{chore.streak && chore.streak > 1 ? `🔥 ${chore.streak} days in a row` : 'Not started yet'}</span>
          </div>
        </div>
      ) : loadingHistory ? (
        <div className="cr-chore-detail__empty">Loading history…</div>
      ) : history ? (
        <div>
          <div className="cr-chore-detail__stats">
            <div className="cr-chore-detail__stat">
              <b>{history.total}</b>
              <span>Done</span>
            </div>
            <div className="cr-chore-detail__stat">
              <b>🔥 {history.streak}</b>
              <span>Streak</span>
            </div>
            <div className="cr-chore-detail__stat">
              <b>{history.on_time_pct}%</b>
              <span>On time</span>
            </div>
            <div className="cr-chore-detail__stat">
              <b>{history.avg_points}</b>
              <span>Avg pts</span>
            </div>
          </div>

          <div className="cr-chore-detail__chart">
            {history.day_keys.map((key) => {
              const value = history.per_day[key] || 0;
              const height = value === 0 ? 3 : Math.max(8, Math.round((value / chartMax) * 100));
              return (
                <div
                  key={key}
                  className={`cr-chore-detail__bar ${value === 0 ? 'is-off' : ''}`.trim()}
                  style={{ height: `${height}%` }}
                  title={`${key}: ${value}`}
                />
              );
            })}
          </div>
          <div className="cr-chore-detail__axis">
            {history.day_keys.map((key) => (
              <span key={key}>{shortDay(key)}</span>
            ))}
          </div>

          {history.recent.length === 0 ? (
            <div className="cr-chore-detail__empty">No completions logged yet — be the first! 🎉</div>
          ) : (
            history.recent.map((row) => (
              <div className="cr-chore-detail__row" key={`${row.for_date}-${row.completed_at}`}>
                <strong>✓ {friendlyDate(row.for_date)}</strong>
                <span>{row.person_name}</span>
                <span>{row.points} ⭐</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="cr-chore-detail__empty">History unavailable right now.</div>
      )}
    </Modal>
  );
};

export default ChoreDetailModal;

