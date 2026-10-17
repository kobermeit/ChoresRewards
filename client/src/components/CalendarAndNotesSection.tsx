import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost } from '../api';

export const CalendarAndNotesSection: React.FC = () => {
  const { data, refresh, setActiveView, showToast } = useApp();

  // Calendar view mode
  const [calMode, setCalMode] = useState<'week' | 'list'>('week');

  // Notes Kanban state
  const [newNoteText, setNewNoteText] = useState<Record<string, string>>({});
  const [newColTitle, setNewColTitle] = useState('');
  const [newColColor, setNewColColor] = useState('#3b82f6');
  const [showAddCol, setShowAddCol] = useState(false);

  // Text Pads state
  const [newPadTitle, setNewPadTitle] = useState('');
  const [editingPadContent, setEditingPadContent] = useState<Record<string, string>>({});

  if (!data) return null;

  const gcal = data.google_calendar;
  const nk = data.notes_kanban || { columns: [], notes: [] };
  const columns = nk.columns || [];
  const activeNotes = (nk.notes || []).filter((n) => !n.deleted);
  const textPads = data.text_pads || [];

  const handleAddNote = async (colId: string, e: React.FormEvent) => {
    e.preventDefault();
    const txt = (newNoteText[colId] || '').trim();
    if (!txt) return;
    try {
      await apiPost('add_kanban_note', { column_id: colId, text: txt });
      setNewNoteText((prev) => ({ ...prev, [colId]: '' }));
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add note', { type: 'error' });
    }
  };

  const handleToggleNote = async (noteId: string, checked: boolean) => {
    try {
      await apiPost('update_kanban_note', { id: noteId, checked: !checked });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await apiPost('delete_kanban_note', { id: noteId, permanent: true });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColTitle.trim()) return;
    try {
      await apiPost('add_note_column', { title: newColTitle.trim(), color: newColColor });
      setNewColTitle('');
      setShowAddCol(false);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add column', { type: 'error' });
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    try {
      await apiPost('delete_note_column', { id: colId });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleAddTextPad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPadTitle.trim()) return;
    try {
      await apiPost('add_text_pad', { title: newPadTitle.trim(), content: '' });
      setNewPadTitle('');
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to create text pad', { type: 'error' });
    }
  };

  const handleSaveTextPad = async (padId: string, title: string) => {
    const content = editingPadContent[padId];
    if (content === undefined) return;
    try {
      await apiPost('update_text_pad', { id: padId, title, content });
      showToast(`Saved "${title}"`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save pad', { type: 'error' });
    }
  };

  const handleDeleteTextPad = async (padId: string) => {
    try {
      await apiPost('delete_text_pad', { id: padId });
      await refresh();
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* ===================================================================
          1. FAMILY CALENDAR SECTION
         =================================================================== */}
      <section className="section-heading" id="events-section" style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>📅 Family Calendar</h2>
            <p className="section-subtitle">Upcoming family schedule & events for the next 7 days.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setCalMode(calMode === 'week' ? 'list' : 'week')}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.08)',
                color: 'inherit',
                border: '1px solid rgba(255,255,255,0.14)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {calMode === 'week' ? '📋 List View' : '📆 Week Grid'}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('settings')}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(59,130,246,0.2)',
                color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.4)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ⚙️ Calendar Settings
            </button>
          </div>
        </div>
      </section>

      {!gcal?.enabled ? (
        <div className="card" style={{ padding: 24, borderRadius: 16, textAlign: 'center', opacity: 0.85 }}>
          <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>📅</div>
          <div>Google Calendar integration is not enabled yet.</div>
          <button
            type="button"
            onClick={() => setActiveView('settings')}
            className="btn-primary"
            style={{ marginTop: 12, padding: '8px 18px', borderRadius: 10 }}
          >
            Configure Google Calendar in Settings
          </button>
        </div>
      ) : gcal.error ? (
        <div
          className="card"
          style={{
            padding: 20,
            borderRadius: 16,
            border: '1px solid rgba(239,68,68,0.4)',
            color: '#f87171',
          }}
        >
          ⚠️ Calendar Error: {gcal.error}
        </div>
      ) : calMode === 'week' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
            gap: 12,
          }}
        >
          {(gcal.week_columns || []).map((col: any) => (
            <div
              key={col.date_iso}
              className="card"
              style={{
                padding: 14,
                borderRadius: 16,
                border: col.is_today ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                background: col.is_today ? 'rgba(59,130,246,0.1)' : undefined,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  paddingBottom: 6,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span style={{ fontWeight: 800 }}>{col.day_name}</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>{col.date_label}</span>
              </div>

              {/* All-day & timed events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(col.all_day_events || []).map((ev: any, idx: number) => (
                  <div
                    key={`ad-${idx}`}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: ev.color || '#3b82f6',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    📌 {ev.summary}
                  </div>
                ))}
                {(col.timed_events || []).map((ev: any, idx: number) => (
                  <div
                    key={`tm-${idx}`}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.07)',
                      borderLeft: `4px solid ${ev.color || '#3b82f6'}`,
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>{ev.time_label}</div>
                    <div style={{ fontWeight: 700 }}>{ev.summary}</div>
                  </div>
                ))}
                {!col.all_day_events?.length && !col.timed_events?.length && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.45, fontStyle: 'italic' }}>No events</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 20, borderRadius: 16 }}>
          {(gcal.events || []).length === 0 ? (
            <div style={{ opacity: 0.7 }}>No upcoming events in the next 7 days.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(gcal.events || []).map((ev: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    borderLeft: `4px solid ${ev.color || '#3b82f6'}`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{ev.summary}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                      {ev.date_label} • {ev.time_label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================
          2. NOTES KANBAN & TEXT PADS SECTION
         =================================================================== */}
      <section className="section-heading" id="notes-kanban-section" style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>📋 Lists & Notes Board</h2>
            <p className="section-subtitle">Keep track of family checklists, school reminders, and scratchpads.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddCol((prev) => !prev)}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: 'rgba(59,130,246,0.2)',
              color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.4)',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            + Add List Column
          </button>
        </div>
      </section>

      {showAddCol && (
        <form
          onSubmit={handleAddColumn}
          className="card"
          style={{ padding: 14, borderRadius: 14, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}
        >
          <input
            type="text"
            placeholder="Column title (e.g. To Do, Packing List, Ideas)..."
            value={newColTitle}
            onChange={(e) => setNewColTitle(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8 }}
          />
          <input
            type="color"
            value={newColColor}
            onChange={(e) => setNewColColor(e.target.value)}
            style={{ width: 42, height: 38, border: 'none', background: 'none', cursor: 'pointer' }}
          />
          <button type="submit" className="btn-primary" style={{ padding: '8px 16px', borderRadius: 8 }}>
            Create Column
          </button>
        </form>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {columns.map((col) => {
          const colNotes = activeNotes.filter((n) => n.column_id === col.id);
          return (
            <div
              key={col.id}
              className="card"
              style={{
                padding: 16,
                borderRadius: 16,
                borderTop: `4px solid ${col.color || '#3b82f6'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{col.title}</h3>
                {columns.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteColumn(col.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                    title="Delete column"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {colNotes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.05)',
                      opacity: note.checked ? 0.55 : 1,
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(note.checked)}
                        onChange={() => handleToggleNote(note.id, Boolean(note.checked))}
                      />
                      <span style={{ textDecoration: note.checked ? 'line-through' : 'none' }}>{note.text}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={(e) => handleAddNote(col.id, e)} style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Add item..."
                  value={newNoteText[col.id] || ''}
                  onChange={(e) => setNewNoteText((prev) => ({ ...prev, [col.id]: e.target.value }))}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8 }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: col.color || '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </form>
            </div>
          );
        })}
      </div>

      {/* Text Pads */}
      <div id="text-pads-section" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>📝 Scratchpads & Notes</h3>
          <form onSubmit={handleAddTextPad} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="New notepad title..."
              value={newPadTitle}
              onChange={(e) => setNewPadTitle(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8 }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '8px 14px', borderRadius: 8 }}>
              + New Pad
            </button>
          </form>
        </div>

        {textPads.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {textPads.map((pad) => {
              const val = editingPadContent[pad.id] !== undefined ? editingPadContent[pad.id] : pad.content;
              return (
                <div key={pad.id} className="card" style={{ padding: 16, borderRadius: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ margin: 0 }}>{pad.title}</h4>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleSaveTextPad(pad.id, pad.title)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'rgba(34,197,94,0.2)',
                          color: '#4ade80',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                        }}
                      >
                        💾 Save
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTextPad(pad.id)}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={5}
                    value={val}
                    onChange={(e) => setEditingPadContent((prev) => ({ ...prev, [pad.id]: e.target.value }))}
                    onBlur={() => handleSaveTextPad(pad.id, pad.title)}
                    placeholder="Write notes here..."
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 10,
                      background: 'rgba(0,0,0,0.2)',
                      color: 'inherit',
                      border: '1px solid rgba(255,255,255,0.12)',
                      resize: 'vertical',
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
