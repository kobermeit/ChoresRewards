import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost } from '../api';
import { SectionHelpTip } from './HelpTooltipAndView';
import { PageContainer, Button } from './ui';

const POSTIT_COLORS = ['#fef08a', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74', '#c4b5fd', '#6ee7b7', '#fca5a5'];

export interface NotesSectionProps {
  isStandalonePage?: boolean;
}

export const NotesSection: React.FC<NotesSectionProps> = ({ isStandalonePage = false }) => {
  const { data, refresh, showToast, confirm } = useApp();

  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  const [deletedCollapsed, setDeletedCollapsed] = useState(true);
  const [padsCollapsed, setPadsCollapsed] = useState(false);

  const [newNoteText, setNewNoteText] = useState<Record<string, string>>({});
  const [newPadTitle, setNewPadTitle] = useState('');
  const [newPadContent, setNewPadContent] = useState('');
  const [editingPadContent, setEditingPadContent] = useState<Record<string, string>>({});
  const [padModes, setPadModes] = useState<Record<string, 'view' | 'edit'>>({});

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
    const ok = await confirm({
      title: `Delete List "${colTitle}"?`,
      message: `Are you sure you want to delete the list "${colTitle}" and all of its notes?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: 'Move Checked Notes?',
      message: `Move ${checkedList.length} checked note(s) to Deleted Notes?`,
      confirmText: 'Move to Deleted',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedList.map((n) => apiPost('delete_kanban_note', { id: n.id, permanent: false })));
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleEmptyDeleted = async () => {
    if (!deletedNotes.length) return;
    const ok = await confirm({
      title: 'Permanently Delete Notes?',
      message: `Permanently delete all ${deletedNotes.length} note(s)? This cannot be undone.`,
      confirmText: 'Delete Permanently',
      danger: true,
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: 'Delete Text Pad?',
      message: 'Are you sure you want to delete this text pad? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiPost('delete_text_pad', { id: padId });
      await refresh();
    } catch {
      // ignore
    }
  };

  const renderFormattedNote = (content: string) => {
    if (!content) return <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Empty note</span>;
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const flushList = (keyPrefix: string) => {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={`${keyPrefix}-ul`} style={{ margin: '6px 0 12px 22px', padding: 0 }}>
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const formatInline = (text: string): React.ReactNode => {
      const codeParts = text.split(/(`[^`]+`)/g);
      return codeParts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          return (
            <code
              key={i}
              style={{
                background: 'rgba(255,255,255,0.12)',
                padding: '2px 5px',
                borderRadius: '4px',
                fontSize: '0.86em',
                fontFamily: 'monospace',
                color: '#93c5fd',
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((bPart, bi) => {
          if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length >= 4) {
            return <strong key={`${i}-${bi}`} style={{ color: '#f8fafc' }}>{bPart.slice(2, -2)}</strong>;
          }
          return bPart;
        });
      });
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList(`flush-${idx}`);
        return;
      }

      if (trimmed === '---' || trimmed === '***') {
        flushList(`hr-${idx}`);
        elements.push(
          <hr
            key={`hr-${idx}`}
            style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.12)', margin: '14px 0' }}
          />
        );
        return;
      }

      if (trimmed.startsWith('# ')) {
        flushList(`h1-${idx}`);
        elements.push(
          <h2
            key={`h1-${idx}`}
            style={{ fontSize: '1.35rem', margin: '16px 0 8px', color: '#f8fafc', fontWeight: 700 }}
          >
            {formatInline(trimmed.slice(2))}
          </h2>
        );
        return;
      }

      if (trimmed.startsWith('## ')) {
        flushList(`h2-${idx}`);
        elements.push(
          <h3
            key={`h2-${idx}`}
            style={{ fontSize: '1.14rem', margin: '14px 0 6px', color: '#60a5fa', fontWeight: 700 }}
          >
            {formatInline(trimmed.slice(3))}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith('### ')) {
        flushList(`h3-${idx}`);
        elements.push(
          <h4
            key={`h3-${idx}`}
            style={{ fontSize: '0.98rem', margin: '10px 0 4px', color: '#93c5fd', fontWeight: 600 }}
          >
            {formatInline(trimmed.slice(4))}
          </h4>
        );
        return;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
        inList = true;
        const bulletText = trimmed.slice(2);
        listItems.push(
          <li key={`li-${idx}`} style={{ margin: '4px 0', lineHeight: 1.5, color: '#e2e8f0' }}>
            {formatInline(bulletText)}
          </li>
        );
        return;
      }

      flushList(`p-${idx}`);
      elements.push(
        <p key={`p-${idx}`} style={{ margin: '6px 0', lineHeight: 1.55, color: '#e2e8f0' }}>
          {formatInline(line)}
        </p>
      );
    });

    flushList('final');
    return <div className="text-pad-rendered-view">{elements}</div>;
  };

  return (
    <PageContainer
      title="Notes & Text Pads"
      icon="fas fa-sticky-note"
      iconClass="section-icon-notes"
      badge={activeNotes.length}
      boxed={!isStandalonePage}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="secondary" size="sm" onClick={handleClearChecked} title="Clear checked notes">
            <i className="fas fa-broom" /> Clear Checked
          </Button>
          <Button variant="primary" size="sm" onClick={handleAddColumnPrompt} title="Add new sticky list">
            <i className="fas fa-plus" /> Add List
          </Button>
        </div>
      }
    >

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
                  <i className="fas fa-plus" /> Add Note
                </button>
              </div>
            </div>
          );
        })}
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
              const mode = padModes[pad.id] || 'view';
              const isView = mode === 'view';

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
                        className={`edit-btn text-pad-mode-btn${isView ? ' active' : ''}`}
                        title={isView ? 'Switch to Edit mode' : 'Switch to Formatted View'}
                        onClick={() =>
                          setPadModes((prev) => ({ ...prev, [pad.id]: isView ? 'edit' : 'view' }))
                        }
                      >
                        <i className={isView ? 'fas fa-pencil' : 'fas fa-eye'} /> {isView ? 'Edit' : 'View'}
                      </button>
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

                  {isView ? (
                    <div className="text-pad-rendered-view">{renderFormattedNote(val)}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        className="text-pad-textarea"
                        rows={14}
                        value={val}
                        onChange={(e) =>
                          setEditingPadContent((prev) => ({ ...prev, [pad.id]: e.target.value }))
                        }
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          type="button"
                          className="edit-btn"
                          style={{ background: '#3b82f6', borderColor: '#2563eb', color: '#fff' }}
                          onClick={async () => {
                            await handleSaveTextPad(pad.id, pad.title);
                            setPadModes((prev) => ({ ...prev, [pad.id]: 'view' }));
                          }}
                        >
                          <i className="fas fa-check" /> Done & View
                        </button>
                      </div>
                    </div>
                  )}
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
    </PageContainer>
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
      className="rewards-section"
      style={{ marginTop: '1rem' }}
      id="events-section"
    >
      <h2
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 12px' }}
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
