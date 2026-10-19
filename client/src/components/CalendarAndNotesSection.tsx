import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost } from '../api';
import { SectionHelpTip } from './HelpTooltipAndView';
import { PageContainer, Button, RichEditor, WipBanner } from './ui';
import { Modal } from './common/Modal';

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
  const [editingNoteModal, setEditingNoteModal] = useState<{ id: string; text: string; colColor: string } | null>(null);
  const [editingNoteHtml, setEditingNoteHtml] = useState('');
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

  const handleSaveNoteEdit = async () => {
    if (!editingNoteModal) return;
    try {
      await apiPost('update_kanban_note', {
        id: editingNoteModal.id,
        text: editingNoteHtml || editingNoteModal.text,
      });
      setEditingNoteModal(null);
      await refresh();
      showToast('Note updated!');
    } catch (err: any) {
      showToast(err.message || 'Failed to update note', { type: 'error' });
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

    // Check if the content is rich HTML from the WYSIWYG editor
    if (content.trim().startsWith('<') && (content.includes('</') || content.includes('/>'))) {
      return (
        <div
          className="text-pad-rendered-view cr-rendered-rich-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

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
          <Button variant="secondary" size="sm" icon="fas fa-broom" onClick={handleClearChecked} title="Clear checked notes">
            Clear Checked
          </Button>
          <Button variant="primary" size="sm" icon="fas fa-plus" onClick={handleAddColumnPrompt} title="Add new sticky list">
            Add List
          </Button>
        </div>
      }
    >
      <WipBanner />

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
                    <div
                      className="notes-sticky-text"
                      style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                      onClick={() => {
                        setEditingNoteModal({ id: note.id, text: note.text, colColor: col.color });
                        setEditingNoteHtml(note.text);
                      }}
                      title="Click to edit with rich text"
                    >
                      {renderFormattedNote(note.text)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="notes-sticky-del"
                        title="Edit note (WYSIWYG)"
                        style={{ fontSize: '0.78rem', opacity: 0.7 }}
                        onClick={() => {
                          setEditingNoteModal({ id: note.id, text: note.text, colColor: col.color });
                          setEditingNoteHtml(note.text);
                        }}
                      >
                        <i className="fas fa-pencil-alt" />
                      </button>
                      <button
                        type="button"
                        className="notes-sticky-del"
                        title="Delete note"
                        onClick={() => handleDeleteNote(note.id, false)}
                      >
                        <i className="fas fa-times" />
                      </button>
                    </div>
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
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon="fas fa-plus"
                    onClick={() => handleAddNote(col.id)}
                  >
                    Add Note
                  </Button>
                </div>
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
          <Button
            variant="danger"
            size="sm"
            icon="fas fa-trash-alt"
            id="notes-empty-trash-btn"
            onClick={handleEmptyDeleted}
          >
            Empty Deleted
          </Button>
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
                  <div className="text-pad-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <input
                        type="text"
                        className="text-pad-title-input modern-input"
                        value={pad.title || ''}
                        readOnly
                        style={{ fontWeight: 800, fontSize: '1rem' }}
                      />
                    </div>
                    <span className="text-pad-meta" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {(val || '').replace(/<[^>]*>/g, '').length.toLocaleString()} chars
                    </span>
                    <div className="text-pad-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Button
                        variant={isView ? 'secondary' : 'primary'}
                        size="sm"
                        icon={isView ? 'fas fa-pencil' : 'fas fa-eye'}
                        onClick={() =>
                          setPadModes((prev) => ({ ...prev, [pad.id]: isView ? 'edit' : 'view' }))
                        }
                      >
                        {isView ? 'Edit' : 'View'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="fas fa-copy"
                        title="Copy to clipboard"
                        onClick={() => {
                          const plain = (val || '').replace(/<[^>]*>/g, '');
                          navigator.clipboard?.writeText(plain);
                          showToast('Copied to clipboard');
                        }}
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        icon="fas fa-trash"
                        title="Delete pad"
                        onClick={() => handleDeleteTextPad(pad.id)}
                      />
                    </div>
                  </div>

                  {isView ? (
                    <div className="text-pad-rendered-view" style={{ padding: '14px 16px', minHeight: 140 }}>
                      {renderFormattedNote(val)}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
                      <RichEditor
                        value={val}
                        onChange={(html) =>
                          setEditingPadContent((prev) => ({ ...prev, [pad.id]: html }))
                        }
                        minHeight="220px"
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button
                          variant="primary"
                          size="md"
                          icon="fas fa-check"
                          onClick={async () => {
                            await handleSaveTextPad(pad.id, pad.title);
                            setPadModes((prev) => ({ ...prev, [pad.id]: 'view' }));
                          }}
                        >
                          Done &amp; View
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="text-pad-composer" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
          <input
            type="text"
            id="text-pad-new-title"
            className="modern-input"
            placeholder="Document Title (optional)..."
            maxLength={80}
            value={newPadTitle}
            onChange={(e) => setNewPadTitle(e.target.value)}
            style={{ fontWeight: 700 }}
          />
          <RichEditor
            value={newPadContent}
            onChange={(html) => setNewPadContent(html)}
            placeholder="Paste or type your document text with rich formatting..."
            minHeight="140px"
          />
          <div className="text-pad-composer-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <span className="text-pad-char-count" id="text-pad-char-count" style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              {newPadContent.replace(/<[^>]*>/g, '').length.toLocaleString()} chars
            </span>
            <Button
              variant="primary"
              size="md"
              icon="fas fa-plus"
              id="text-pad-add-btn"
              onClick={handleAddTextPad}
            >
              Save Pad
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Sticky Note WYSIWYG Modal */}
      {editingNoteModal && (
        <Modal
          open={Boolean(editingNoteModal)}
          onClose={() => setEditingNoteModal(null)}
          title="Edit Sticky Note"
          icon="fas fa-sticky-note"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <RichEditor
              value={editingNoteHtml}
              onChange={(html) => setEditingNoteHtml(html)}
              placeholder="Type your note content..."
              minHeight="180px"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => setEditingNoteModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon="fas fa-check"
                onClick={handleSaveNoteEdit}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};

