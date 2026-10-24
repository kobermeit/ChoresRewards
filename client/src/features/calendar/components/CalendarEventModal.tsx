import React from 'react';
import { CalendarEvent } from '../../../types';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui';

interface CalendarEventModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({ event, onClose }) => {
  if (!event) return null;

  return (
    <Modal
      open={Boolean(event)}
      onClose={onClose}
      title={event.title || 'Event Details'}
      icon="fas fa-calendar-day"
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '2.2rem' }}>{event.emoji || '📅'}</span>
          <div style={{ flex: 1 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 700,
                color: event.all_day ? '#4ade80' : '#38bdf8',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${event.color || '#38bdf8'}44`,
              }}
            >
              {event.time_display || 'All Day'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.9rem', color: '#cbd5e1' }}>
          <div>
            <strong style={{ color: '#94a3b8', display: 'block', marginBottom: 2 }}>📅 Date:</strong>
            {new Date(`${event.start_date_iso}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>

          {event.location && (
            <div>
              <strong style={{ color: '#94a3b8', display: 'block', marginBottom: 2 }}>📍 Location:</strong>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#38bdf8', textDecoration: 'none' }}
              >
                {event.location} &rarr;
              </a>
            </div>
          )}

          {event.description && (
            <div>
              <strong style={{ color: '#94a3b8', display: 'block', marginBottom: 2 }}>📝 Description:</strong>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, color: '#e2e8f0' }}>
                {event.description}
              </p>
            </div>
          )}

          {event.person_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
              <strong style={{ color: '#94a3b8' }}>👤 Calendar:</strong>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: event.color || '#38bdf8',
                  background: `${event.color || '#38bdf8'}22`,
                  border: `1px solid ${event.color || '#38bdf8'}44`,
                  padding: '2px 8px',
                  borderRadius: 8,
                }}
              >
                {event.person_name}
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
