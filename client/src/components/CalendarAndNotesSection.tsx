import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost } from '../api';
import { PageContainer, Button, IconButton, Input, RichEditor } from './ui';
import { Modal } from './common/Modal';

const POSTIT_COLORS = [
  '#fef08a', // classic yellow
  '#86efac', // mint green
  '#93c5fd', // soft blue
  '#f9a8d4', // soft pink
  '#fdba74', // warm orange
  '#c4b5fd', // lavender
  '#6ee7b7', // seafoam
  '#fca5a5', // coral
];

export interface NotesSectionProps {
  isStandalonePage?: boolean;
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  color?: string;
  created_at?: string;
}

export const NotesSection: React.FC<NotesSectionProps> = ({ isStandalonePage = false }) => {
  const { data, refresh, showToast, confirm } = useApp();

  const [activeModalNote, setActiveModalNote] = useState<NoteItem | null>(null);
  const [viewNoteItem, setViewNoteItem] = useState<NoteItem | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [modalColor, setModalColor] = useState('#fef08a');
  const [isNewNote, setIsNewNote] = useState(false);

  const toggleExpandNote = (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNoteIds((prev) => ({
      ...prev,
      [noteId]: !prev[noteId],
    }));
  };

  if (!data) return null;

  const notes: NoteItem[] = data.text_pads || [];

  const handleOpenNewNoteModal = () => {
    setIsNewNote(true);
    setModalTitle('');
    setModalContent('');
    setModalColor(POSTIT_COLORS[notes.length % POSTIT_COLORS.length]);
    setActiveModalNote({ id: '', title: '', content: '' });
  };

  const handleOpenEditNoteModal = (note: NoteItem) => {
    setIsNewNote(false);
    setModalTitle(note.title || '');
    setModalContent(note.content || '');
    setModalColor(note.color || POSTIT_COLORS[0]);
    setActiveModalNote(note);
  };

  const handleSaveModalNote = async () => {
    if (!modalContent.trim() && !modalTitle.trim()) {
      showToast('Note cannot be empty', { type: 'error' });
      return;
    }

    try {
      if (isNewNote) {
        await apiPost('add_text_pad', {
          title: modalTitle.trim() || 'Untitled Note',
          content: modalContent,
          color: modalColor,
        });
        showToast('Created new note!');
      } else if (activeModalNote) {
        await apiPost('update_text_pad', {
          id: activeModalNote.id,
          title: modalTitle.trim() || 'Untitled Note',
          content: modalContent,
          color: modalColor,
        });
        showToast('Note saved!');
      }
      setActiveModalNote(null);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save note', { type: 'error' });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const ok = await confirm({
      title: 'Delete Note?',
      message: 'Are you sure you want to delete this note? This action cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await apiPost('delete_text_pad', { id: noteId });
      showToast('Note deleted');
      await refresh();
    } catch {
      // ignore
    }
  };

  const renderFormattedContent = (content: string) => {
    if (!content) return <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Empty note</span>;

    let textToParse = content;

    // Check if the content is wrapped in a single <p> containing markdown or escaped newlines
    const isSinglePWrapper =
      content.trim().startsWith('<p>') &&
      content.trim().endsWith('</p>') &&
      !content.slice(3, -4).includes('<p>');

    if (isSinglePWrapper) {
      const inner = content.trim().slice(3, -4);
      // If inner has markdown headings or bullet points, extract and treat as markdown
      if (inner.includes('#') || inner.includes(' - ') || inner.includes('##') || inner.includes('*')) {
        textToParse = inner
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\\n/g, '\n')
          .replace(/\s+##\s+/g, '\n\n## ')
          .replace(/\s+#\s+/g, '\n\n# ')
          .replace(/\s+-\s+\*\*/g, '\n- **');
      }
    }

    // Check if the content is rich HTML from the WYSIWYG editor (and not unwrapped markdown)
    if (textToParse.trim().startsWith('<') && (textToParse.includes('</') || textToParse.includes('/>'))) {
      return (
        <div
          className="text-pad-rendered-view cr-rendered-rich-content"
          dangerouslySetInnerHTML={{ __html: textToParse }}
        />
      );
    }

    const lines = textToParse.split('\n');
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const flushList = (keyPrefix: string) => {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={`${keyPrefix}-ul`} style={{ margin: '4px 0 8px 22px', padding: 0 }}>
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
        elements.push(<div key={`br-${idx}`} style={{ height: 6 }} />);
        return;
      }

      if (trimmed.startsWith('# ')) {
        flushList(`h1-${idx}`);
        elements.push(
          <h2 key={`h1-${idx}`} style={{ margin: '8px 0 4px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800 }}>
            {formatInline(trimmed.slice(2))}
          </h2>
        );
        return;
      }

      if (trimmed.startsWith('## ')) {
        flushList(`h2-${idx}`);
        elements.push(
          <h3 key={`h2-${idx}`} style={{ margin: '8px 0 4px', fontSize: '1.02rem', color: '#60a5fa', fontWeight: 700 }}>
            {formatInline(trimmed.slice(3))}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith('### ')) {
        flushList(`h3-${idx}`);
        elements.push(
          <h4 key={`h3-${idx}`} style={{ margin: '6px 0 3px', fontSize: '0.94rem', color: '#93c5fd', fontWeight: 600 }}>
            {formatInline(trimmed.slice(4))}
          </h4>
        );
        return;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
        inList = true;
        const bulletText = trimmed.slice(2);
        listItems.push(
          <li key={`li-${idx}`} style={{ margin: '3px 0', lineHeight: 1.5, color: '#e2e8f0' }}>
            {formatInline(bulletText)}
          </li>
        );
        return;
      }

      flushList(`p-${idx}`);
      elements.push(
        <p key={`p-${idx}`} style={{ margin: '4px 0 6px', lineHeight: 1.55, color: '#e2e8f0' }}>
          {formatInline(line)}
        </p>
      );
    });

    flushList('final');
    return <div className="text-pad-rendered-view cr-rendered-rich-content">{elements}</div>;
  };

  return (
    <PageContainer
      title="Notes"
      icon="fas fa-newspaper"
      iconClass="section-icon-notes"
      badge={notes.length}
      boxed={!isStandalonePage}
      actions={
        <Button
          variant="primary"
          size="sm"
          icon="fas fa-plus"
          onClick={handleOpenNewNoteModal}
          title="Create a new note"
        >
          Add Note
        </Button>
      }
    >
      {notes.length === 0 ? (
        <div
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 'var(--card-radius, 14px)',
            border: '1.5px dashed rgba(255, 255, 255, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: '2.5rem' }}>📝</span>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', fontWeight: 700 }}>No notes yet</h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', maxWidth: 360 }}>
            Keep track of recipes, Wi-Fi details, household reminders, and important notes here.
          </p>
          <Button
            variant="primary"
            size="md"
            icon="fas fa-plus"
            onClick={handleOpenNewNoteModal}
            style={{ marginTop: 8 }}
          >
            Create Your First Note
          </Button>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: '100%',
          }}
        >
          {notes.map((note, idx) => {
            const cardColor = note.color || POSTIT_COLORS[idx % POSTIT_COLORS.length];
            const plainText = (note.content || '').replace(/<[^>]*>/g, '');
            const charCount = plainText.length;
            const isExpanded = Boolean(expandedNoteIds[note.id]);

            return (
              <div
                key={note.id}
                className="note-reddit-row"
                style={{
                  border: `1px solid ${cardColor}33`,
                  borderLeft: `5px solid ${cardColor}`,
                }}
              >
                {/* Note Row Header (Reddit post style) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px 8px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    gap: 12,
                    cursor: 'pointer',
                  }}
                  onClick={() => setViewNoteItem(note)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: cardColor,
                        boxShadow: `0 0 8px ${cardColor}`,
                        flexShrink: 0,
                      }}
                    />
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        letterSpacing: '-0.01em',
                      }}
                      title={note.title}
                    >
                      {note.title || 'Untitled Note'}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        color: '#94a3b8',
                        background: 'rgba(255, 255, 255, 0.06)',
                        padding: '1px 8px',
                        borderRadius: '10px',
                        flexShrink: 0,
                        marginLeft: 4,
                      }}
                    >
                      {charCount.toLocaleString()} chars
                    </span>
                  </div>

                  {/* Actions */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon={isExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'}
                      aria-label={isExpanded ? 'Collapse note' : 'Expand note'}
                      title={isExpanded ? 'Collapse note' : 'Expand note'}
                      onClick={(e) => toggleExpandNote(note.id, e)}
                    />
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon="fas fa-expand"
                      aria-label="View full note"
                      title="View full note"
                      onClick={() => setViewNoteItem(note)}
                    />
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon="fas fa-pencil-alt"
                      aria-label="Edit note"
                      title="Edit note"
                      onClick={() => handleOpenEditNoteModal(note)}
                    />
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon="fas fa-copy"
                      aria-label="Copy note text"
                      title="Copy note text"
                      onClick={() => {
                        navigator.clipboard?.writeText(plainText);
                        showToast('Note copied to clipboard');
                      }}
                    />
                    <IconButton
                      size="sm"
                      variant="danger"
                      icon="fas fa-trash-alt"
                      aria-label="Delete note"
                      title="Delete note"
                      onClick={() => handleDeleteNote(note.id)}
                    />
                  </div>
                </div>

                {/* Note Row Body (Max height or expanded, clicking opens full-page modal) */}
                <div
                  className="note-reddit-body-scroll"
                  style={{
                    padding: '12px 18px 14px',
                    maxHeight: isExpanded ? 'none' : 150,
                    overflowY: isExpanded ? 'visible' : 'auto',
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                    color: '#e2e8f0',
                    cursor: 'pointer',
                  }}
                  onClick={() => setViewNoteItem(note)}
                  title="Click to view full note"
                >
                  {renderFormattedContent(note.content)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Page View Note Modal */}
      {viewNoteItem && (
        <Modal
          open={Boolean(viewNoteItem)}
          onClose={() => setViewNoteItem(null)}
          title={viewNoteItem.title || 'Untitled Note'}
          icon="fas fa-newspaper"
          maxWidth={840}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="fas fa-copy"
                  onClick={() => {
                    const plain = (viewNoteItem.content || '').replace(/<[^>]*>/g, '');
                    navigator.clipboard?.writeText(plain);
                    showToast('Note copied to clipboard');
                  }}
                >
                  Copy
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon="fas fa-trash-alt"
                  onClick={async () => {
                    const id = viewNoteItem.id;
                    setViewNoteItem(null);
                    await handleDeleteNote(id);
                  }}
                >
                  Delete
                </Button>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="fas fa-pencil-alt"
                  onClick={() => {
                    const current = viewNoteItem;
                    setViewNoteItem(null);
                    handleOpenEditNoteModal(current);
                  }}
                >
                  Edit Note
                </Button>
                <Button variant="primary" size="sm" onClick={() => setViewNoteItem(null)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div
            className="note-reddit-body-scroll"
            style={{
              maxHeight: '65vh',
              overflowY: 'auto',
              padding: '8px 12px',
              fontSize: '1rem',
              lineHeight: 1.65,
            }}
          >
            {renderFormattedContent(viewNoteItem.content)}
          </div>
        </Modal>
      )}

      {/* Spacious Edit / Add Note Modal (At least 10 lines of height!) */}
      {activeModalNote && (
        <Modal
          open={Boolean(activeModalNote)}
          onClose={() => setActiveModalNote(null)}
          title={isNewNote ? 'New Note' : `Edit Note: ${modalTitle || 'Untitled'}`}
          icon="fas fa-align-left"
          maxWidth={760}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
              <Button variant="ghost" size="sm" onClick={() => setActiveModalNote(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="fas fa-check"
                onClick={handleSaveModalNote}
              >
                Save Note
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label="Note Title"
              placeholder="e.g. Wi-Fi Password, Shopping Checklist, Babysitter Instructions..."
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              autoFocus
            />

            {/* Color Swatch Picker */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
                Note Color
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {POSTIT_COLORS.map((col) => {
                  const isSelected = modalColor === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setModalColor(col)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: col,
                        border: isSelected ? '3px solid #ffffff' : '2px solid rgba(0,0,0,0.3)',
                        boxShadow: isSelected ? `0 0 10px ${col}` : 'none',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.15s ease',
                      }}
                      title={col}
                      aria-label={`Select color ${col}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Spacious Rich Text Area - At least 10 lines (320px min-height) */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
                Note Content
              </label>
              <RichEditor
                value={modalContent}
                onChange={(html) => setModalContent(html)}
                placeholder="Write your note here... Use formatting, bullets, checklists, or paste text."
                minHeight="320px"
              />
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
