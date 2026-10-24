import React, { memo, useState } from 'react';
import { Button, IconButton, Input, RichEditor } from '../../../components/ui';
import { Modal } from '../../../components/common/Modal';
import { DashboardStickyNote } from '../../../types';

export const STICKY_COLORS = ['#fef08a', '#fed7aa', '#bbf7d0', '#bae6fd', '#e9d5ff', '#fbcfe8'];

export interface StickyNotesWidgetProps {
  stickyNotes: DashboardStickyNote[];
  onAddNote: (title: string, text: string, color: string) => Promise<void>;
  onUpdateNote: (note: DashboardStickyNote) => Promise<void>;
  onDeleteNote: (id: number) => Promise<void>;
}

export const StickyNotesWidget: React.FC<StickyNotesWidgetProps> = memo(({
  stickyNotes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}) => {
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteColor, setNewNoteColor] = useState(STICKY_COLORS[0]);

  const [editingModal, setEditingModal] = useState<DashboardStickyNote | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingText, setEditingText] = useState('');
  const [editingColor, setEditingColor] = useState(STICKY_COLORS[0]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    await onAddNote(newNoteTitle.trim(), newNoteText.trim(), newNoteColor);
    setNewNoteTitle('');
    setNewNoteText('');
    setAddingNote(false);
  };

  const handleEditSubmit = async () => {
    if (!editingModal || !editingText.trim()) return;
    await onUpdateNote({
      ...editingModal,
      title: editingTitle.trim(),
      text: editingText.trim(),
      color: editingColor,
    });
    setEditingModal(null);
  };

  return (
    <div
      className="dashboard-card dashboard-card-notes"
      id="dashboard-notes-panel"
      style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-note-sticky" style={{ color: '#fbbf24' }} />
          <span>Sticky Notes</span>
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddingNote((v) => !v)}
        >
          <i className="fas fa-plus" /> Add Note
        </Button>
      </div>

      {addingNote && (
        <form
          onSubmit={handleCreateSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 14,
            borderRadius: 12,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Input
                inputSize="sm"
                type="text"
                placeholder="Title (optional)"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {STICKY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewNoteColor(c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c,
                    border: newNoteColor === c ? '2.5px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    transition: 'transform 0.12s ease',
                    transform: newNoteColor === c ? 'scale(1.15)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <textarea
              className="modern-input"
              placeholder="Write a sticky note... (supports multiple lines)"
              rows={3}
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAddingNote(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" icon="fas fa-check">
              Post Note
            </Button>
          </div>
        </form>
      )}

      <div
        className="dash-notes-grid"
        id="dash-notes-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}
      >
        {stickyNotes.length === 0 ? (
          <p className="dash-empty-hint">No notes yet — tap &lsquo;Add Note&rsquo; to pin one here.</p>
        ) : (
          stickyNotes.map((n) => (
            <div
              key={n.id}
              style={{
                background: n.color || '#fef08a',
                color: '#1e293b',
                padding: '12px 14px',
                borderRadius: 12,
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 110,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                  {n.title || ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon="fas fa-pencil-alt"
                    style={{ color: '#475569', width: 24, height: 24 }}
                    onClick={() => {
                      setEditingModal(n);
                      setEditingTitle(n.title || '');
                      setEditingText(n.text || '');
                      setEditingColor(n.color || STICKY_COLORS[0]);
                    }}
                    aria-label="Edit note with rich text"
                    title="Edit note with rich text"
                  />
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon="fas fa-times"
                    style={{ color: '#475569', width: 24, height: 24 }}
                    onClick={() => onDeleteNote(n.id)}
                    aria-label="Delete note"
                    title="Delete note"
                  />
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  color: '#1e293b',
                  cursor: 'pointer',
                  flex: 1,
                }}
                onClick={() => {
                  setEditingModal(n);
                  setEditingTitle(n.title || '');
                  setEditingText(n.text || '');
                  setEditingColor(n.color || STICKY_COLORS[0]);
                }}
              >
                {n.text?.includes('<') && n.text?.includes('>') ? (
                  <div dangerouslySetInnerHTML={{ __html: n.text }} />
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{n.text}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {editingModal && (
        <Modal
          open={Boolean(editingModal)}
          onClose={() => setEditingModal(null)}
          title="Edit Sticky Note"
          icon="fas fa-note-sticky"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Title (optional)"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  placeholder="Note title..."
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                  Color
                </label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {STICKY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingColor(c)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: c,
                        border: editingColor === c ? '2.5px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        transform: editingColor === c ? 'scale(1.15)' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                Content (Rich Text)
              </label>
              <RichEditor
                value={editingText}
                onChange={(html) => setEditingText(html)}
                placeholder="Type your sticky note content..."
                minHeight="180px"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button
                variant="secondary"
                onClick={() => setEditingModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon="fas fa-check"
                onClick={handleEditSubmit}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
});

StickyNotesWidget.displayName = 'StickyNotesWidget';
