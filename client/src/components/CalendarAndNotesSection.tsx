import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost } from '../api';
import { SectionHelpTip } from './HelpTooltipAndView';

const POSTIT_COLORS = ['#fef08a', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74', '#c4b5fd', '#6ee7b7', '#fca5a5'];

export const NotesSection: React.FC = () => {
  const { data, refresh, showToast } = useApp();

  const [sectionCollapsed, setSectionCollapsed] = useState(true);
  const [deletedCollapsed, setDeletedCollapsed] = useState(true);
  const [padsCollapsed, setPadsCollapsed] = useState(true);

  const [newNoteText, setNewNoteText] = useState<Record<string, string>>({});
  const [newPadTitle, setNewPadTitle] = useState('');
  const [newPadContent, setNewPadContent] = useState('');
  const [editingPadContent, setEditingPadContent] = useState<Record<string, string>>({});

  if (!data) return null;

  const nk = data.notes_kanban || { columns: [], notes: [] };
  const columns = [...(nk.columns || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const activeNotes = (nk.notes || []).filter((n) => !n.deleted);
  const deletedNotes = (nk.notes || []).filter((n) => n.deleted);
  const textPads = data.text_pads || [];

  const handleAddNote = async (colId: string) => {
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

  const handleDeleteNote = async (noteId: string, permanent = false) => {
    try {
      await apiPost('delete_kanban_note', { id: noteId, permanent });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleAddColumnPrompt = async () => {
    const title = window.prompt('List name:');
    if (!title || !title.trim()) return;
    const color = POSTIT_COLORS[columns.length % POSTIT_COLORS.length];
    try {
      await apiPost('add_note_column', { title: title.trim(), color });
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add column', { type: 'error' });
    }
  };

  const handleDeleteColumn = async (colId: string, colTitle: string) => {
    if (!window.confirm(`Delete list "${colTitle}"?`)) return;
    try {
      await apiPost('delete_note_column', { id: colId });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleClearChecked = async () => {
    const checkedList = activeNotes.filter((n) => n.checked);
    if (!checkedList.length) return;
    if (!window.confirm(`Move ${checkedList.length} checked note(s) to Deleted Notes?`)) return;
    try {
      await Promise.all(checkedList.map((n) => apiPost('delete_kanban_note', { id: n.id, permanent: false })));
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleEmptyDeleted = async () => {
    if (!deletedNotes.length) return;
    if (!window.confirm(`Permanently delete ${deletedNotes.length} note(s)?`)) return;
    try {
      await Promise.all(deletedNotes.map((n) => apiPost('delete_kanban_note', { id: n.id, permanent: true })));
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleAddTextPad = async () => {
    if (!newPadContent.trim()) return;
    try {
      await apiPost('add_text_pad', {
        title: newPadTitle.trim() || 'Untitled',
        content: newPadContent,
      });
      setNewPadTitle('');
      setNewPadContent('');
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
    if (!window.confirm('Delete this text pad?')) return;
    try {
      await apiPost('delete_text_pad', { id: padId });
      await refresh();
    } catch {
      // ignore
    }
  };

  return (
    <section
      className={`notes-kanban-section collapsible-section${sectionCollapsed ? ' collapsed' : ''}`}
      id="notes-kanban-section"
    >
      <h2
        className="section-title section-toggle"
        onClick={() => setSectionCollapsed((p) => !p)}
      >
        <i className="fas fa-sticky-note" style={{ color: '#fbbf24' }} /> <span>Notes</span>
        <SectionHelpTip
          title="Sticky Notes & Text Pads"
          tips={[
            'Create colour-coded lists for to-dos, school reminders, or family packing lists.',
            'Tick off notes as you complete them and use "Clear Checked" to archive them.',
            'Expand "Text Pads" below for longer freeform scratchpads with 1-click copy.',
          ]}
        />
        <i className="fas fa-chevron-down section-chevron" />
      </h2>

      <div className="notes-kanban-board" id="notes-kanban-board">
        {columns.map((col) => {
          const colNotes = activeNotes.filter((n) => n.column_id === col.id);
          return (
            <div key={col.id} className="notes-kanban-col" data-col-id={col.id}>
              <div
                className="notes-col-header"
                style={{ '--col-color': col.color } as React.CSSProperties}
              >
                <span className="notes-col-drag-handle" title="Hold and drag to reorder lists">
                  <i className="fas fa-grip-vertical" />
                </span>
                <span className="notes-col-dot" style={{ background: col.color }} />
                <span className="notes-col-title">{col.title}</span>
                <button
                  type="button"
                  className="notes-col-delete-btn"
                  title="Delete list"
                  onClick={() => handleDeleteColumn(col.id, col.title)}
                >
                  <i className="fas fa-times" />
                </button>
              </div>

              <div className="notes-list">
                {colNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`notes-sticky${note.checked ? ' notes-sticky-checked' : ''}`}
                    style={{ '--note-color': col.color } as React.CSSProperties}
                  >
                    <input
                      type="checkbox"
                      className="notes-sticky-check"
                      checked={Boolean(note.checked)}
                      onChange={() => handleToggleNote(note.id, Boolean(note.checked))}
                    />
                    <span className="notes-sticky-text">{note.text}</span>
                    <button
                      type="button"
                      className="notes-sticky-del"
                      title="Delete note"
                      onClick={() => handleDeleteNote(note.id, false)}
                    >
                      <i className="fas fa-times" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="notes-add-row">
                <textarea
                  className="notes-add-input"
                  placeholder="New note..."
                  rows={2}
                  value={newNoteText[col.id] || ''}
                  onChange={(e) => setNewNoteText((prev) => ({ ...prev, [col.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote(col.id);
                    }
                  }}
                />
                <button
                  type="button"
                  className="notes-add-btn edit-btn"
                  onClick={() => handleAddNote(col.id)}
                >
                  <i className="fas fa-plus" /> Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="notes-action-row">
        <button type="button" className="edit-btn" id="notes-add-column-btn" onClick={handleAddColumnPrompt}>
          <i className="fas fa-plus" /> Add List
        </button>
        <button type="button" className="edit-btn" id="notes-clear-checked-btn" onClick={handleClearChecked}>
          <i className="fas fa-broom" /> Clear Checked
        </button>
      </div>

      <div
        className={`notes-deleted-wrap collapsible-section${deletedCollapsed ? ' collapsed' : ''}`}
        id="notes-deleted-section"
      >
        <h3
          className="notes-deleted-toggle section-toggle"
          onClick={() => setDeletedCollapsed((p) => !p)}
        >
          <i className="fas fa-trash" /> Deleted Notes
          <span id="notes-deleted-count" className="notes-deleted-count">
            {deletedNotes.length}
          </span>
          <i className="fas fa-chevron-down section-chevron" />
        </h3>
        <div id="notes-deleted-list" className="notes-deleted-list">
          {deletedNotes.length === 0 ? (
            <p className="notes-deleted-empty">No deleted notes.</p>
          ) : (
            deletedNotes.map((note) => (
              <div key={note.id} className="notes-deleted-item">
                <span className="notes-deleted-text">{note.text}</span>
                <div className="notes-deleted-item-actions">
                  <button
                    type="button"
                    className="notes-deleted-permanent"
                    title="Delete permanently"
                    onClick={() => handleDeleteNote(note.id, true)}
                  >
                    <i className="fas fa-trash-alt" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="notes-deleted-actions">
          <button type="button" className="edit-btn" id="notes-empty-trash-btn" onClick={handleEmptyDeleted}>
            <i className="fas fa-trash-alt" /> Empty Deleted
          </button>
        </div>
      </div>

      <div
        className={`text-pads-wrap collapsible-section${padsCollapsed ? ' collapsed' : ''}`}
        id="text-pads-section"
      >
        <h3
          className="text-pads-section-toggle section-toggle"
          onClick={() => setPadsCollapsed((p) => !p)}
        >
          <i className="fas fa-file-alt" /> Text Pads
          <i className="fas fa-chevron-down section-chevron" />
        </h3>
        <div id="text-pads-list" className="text-pads-list">
          {textPads.length === 0 ? (
            <p className="text-pads-empty">No text pads yet — add one below.</p>
          ) : (
            textPads.map((pad) => {
              const val = editingPadContent[pad.id] !== undefined ? editingPadContent[pad.id] : pad.content;
              return (
                <div key={pad.id} className="text-pad-card">
                  <div className="text-pad-card-header">
                    <input
                      type="text"
                      className="text-pad-title-input modern-input"
                      value={pad.title || ''}
                      readOnly
                    />
                    <span className="text-pad-meta">{(val || '').length.toLocaleString()} chars</span>
                    <div className="text-pad-actions">
                      <button
                        type="button"
                        className="edit-btn text-pad-copy-btn"
                        title="Copy to clipboard"
                        onClick={() => {
                          navigator.clipboard?.writeText(val || '');
                          showToast('Copied to clipboard');
                        }}
                      >
                        <i className="fas fa-copy" />
                      </button>
                      <button
                        type="button"
                        className="notes-col-delete-btn text-pad-del-btn"
                        title="Delete pad"
                        onClick={() => handleDeleteTextPad(pad.id)}
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="text-pad-textarea"
                    rows={8}
                    value={val}
                    onChange={(e) => setEditingPadContent((prev) => ({ ...prev, [pad.id]: e.target.value }))}
                    onBlur={() => handleSaveTextPad(pad.id, pad.title)}
                  />
                </div>
              );
            })
          )}
        </div>
        <div className="text-pad-composer">
          <input
            type="text"
            id="text-pad-new-title"
            className="modern-input"
            placeholder="Title (optional)..."
            maxLength={80}
            value={newPadTitle}
            onChange={(e) => setNewPadTitle(e.target.value)}
          />
          <textarea
            id="text-pad-new-content"
            className="text-pad-textarea"
            placeholder="Paste or type your text here..."
            rows={6}
            value={newPadContent}
            onChange={(e) => setNewPadContent(e.target.value)}
          />
          <div className="text-pad-composer-row">
            <span className="text-pad-char-count" id="text-pad-char-count">
              {newPadContent.length.toLocaleString()} chars
            </span>
            <button type="button" className="save-btn" id="text-pad-add-btn" onClick={handleAddTextPad}>
              <i className="fas fa-plus" /> Save Pad
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export const CalendarSection: React.FC = () => {
  const { data } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [calMode, setCalMode] = useState<'grid' | 'list'>('grid');

  if (!data) return null;
  const gcal = data.google_calendar;
  if (!gcal?.enabled) return null;

  return (
    <section
      className={`rewards-section collapsible-section${collapsed ? ' collapsed' : ''}`}
      style={{ marginTop: '1rem' }}
      id="events-section"
    >
      <h2
        className="section-title section-toggle"
        onClick={() => setCollapsed((p) => !p)}
      >
        <i className="fas fa-calendar-alt" style={{ color: '#60a5fa' }} />{' '}
        <span>Upcoming Family Events</span>
        <div
          className="gcal-view-switch"
          onClick={(e) => e.stopPropagation()}
          title="Switch calendar view"
        >
          <button
            type="button"
            className={`gcal-view-switch-btn${calMode === 'grid' ? ' active' : ''}`}
            onClick={() => setCalMode('grid')}
            title="Time grid view"
          >
            <i className="fas fa-stream" />
          </button>
          <button
            type="button"
            className={`gcal-view-switch-btn${calMode === 'list' ? ' active' : ''}`}
            onClick={() => setCalMode('list')}
            title="List view"
          >
            <i className="fas fa-list" />
          </button>
        </div>
        <i className="fas fa-chevron-down section-chevron" />
      </h2>

      {gcal.error ? (
        <div className="empty-state" style={{ padding: '1rem' }}>
          <i
            className="fas fa-exclamation-triangle"
            style={{ fontSize: '2em', color: '#f59e0b', marginBottom: '0.75rem' }}
          />
          <p style={{ margin: '0 0 6px' }}>Calendar unavailable</p>
          <p className="subtitle" style={{ margin: 0 }}>
            {gcal.error}
          </p>
        </div>
      ) : (gcal.events || []).length === 0 ? (
        <div className="empty-state" style={{ padding: '1rem' }}>
          <i
            className="fas fa-calendar-check"
            style={{ fontSize: '2em', color: '#64748b', marginBottom: '0.75rem' }}
          />
          <p style={{ margin: '0 0 6px' }}>No upcoming events found</p>
          <p className="subtitle" style={{ margin: 0 }}>
            Try increasing "Days ahead" in Settings.
          </p>
        </div>
      ) : (
        <div className="google-week-calendar">
          <div className="gcal-week-grid">
            {(gcal.week_columns || []).map((day: any) => {
              const allEvents = [...(day.all_day_events || []), ...(day.timed_events || [])];
              return (
                <div key={day.date_iso} className="gcal-day-column">
                  <div className="gcal-day-header">
                    <div className="gcal-day-name">{day.day_name}</div>
                    <div className="gcal-day-date">{day.date_label}</div>
                  </div>
                  <div className="gcal-day-events">
                    {allEvents.length === 0 ? (
                      <div className="gcal-no-events">No events</div>
                    ) : (
                      allEvents.map((ev: any, idx: number) => (
                        <div
                          key={idx}
                          className="gcal-event-card"
                          style={
                            {
                              '--gcal-event-color': ev.color || '#3b82f6',
                              '--gcal-event-color-tint': 'rgba(59,130,246,0.18)',
                            } as React.CSSProperties
                          }
                        >
                          {ev.time_label && <div className="gcal-event-time">{ev.time_label}</div>}
                          <div className="gcal-event-title">{ev.summary || ev.title}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

export const CalendarAndNotesSection: React.FC = () => {
  return (
    <>
      <NotesSection />
      <CalendarSection />
    </>
  );
};
