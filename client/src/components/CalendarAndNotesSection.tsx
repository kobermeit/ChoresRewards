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
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [modalColor, setModalColor] = useState('#fef08a');
  const [isNewNote, setIsNewNote] = useState(false);

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
        elements.push(<div key={`br-${idx}`} style={{ height: 6 }} />);
        return;
      }

      if (trimmed.startsWith('# ')) {
        flushList(`h1-${idx}`);
        elements.push(
          <h2 key={`h1-${idx}`} style={{ margin: '10px 0 6px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800 }}>
            {formatInline(trimmed.slice(2))}
          </h2>
        );
        return;
      }

      if (trimmed.startsWith('## ')) {
        flushList(`h2-${idx}`);
        elements.push(
          <h3 key={`h2-${idx}`} style={{ margin: '8px 0 4px', fontSize: '1.02rem', color: '#f8fafc', fontWeight: 700 }}>
            {formatInline(trimmed.slice(3))}
          </h3>
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
      title="Notes"
      icon="fas fa-note-sticky"
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
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
            width: '100%',
          }}
        >
          {notes.map((note, idx) => {
            const cardColor = note.color || POSTIT_COLORS[idx % POSTIT_COLORS.length];
            const plainText = (note.content || '').replace(/<[^>]*>/g, '');
            const charCount = plainText.length;

            return (
              <div
                key={note.id}
                style={{
                  background: 'linear-gradient(150deg, #1e293b 0%, #0f172a 100%)',
                  borderRadius: 'var(--card-radius, 14px)',
                  border: `1.5px solid ${cardColor}44`,
                  borderTop: `4px solid ${cardColor}`,
                  boxShadow: `0 6px 20px rgba(0, 0, 0, 0.3), 0 0 16px ${cardColor}15`,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  minHeight: 220,
                  position: 'relative',
                }}
              >
                {/* Sticky Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px 10px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: cardColor,
                        boxShadow: `0 0 8px ${cardColor}`,
                        flexShrink: 0,
                      }}
                    />
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={note.title}
                    >
                      {note.title || 'Untitled Note'}
                    </h3>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
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

                {/* Sticky Body */}
                <div
                  style={{
                    padding: '14px 16px',
                    flex: 1,
                    overflowY: 'auto',
                    maxHeight: 280,
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                    color: '#e2e8f0',
                  }}
                  onClick={() => handleOpenEditNoteModal(note)}
                  title="Click to edit note"
                >
                  {renderFormattedContent(note.content)}
                </div>

                {/* Footer Meta */}
                <div
                  style={{
                    padding: '6px 14px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    color: '#94a3b8',
                    background: 'rgba(0, 0, 0, 0.15)',
                  }}
                >
                  <span>{charCount.toLocaleString()} chars</span>
                  <span style={{ color: cardColor, fontWeight: 700 }}>Sticky Note</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Spacious Edit / Add Note Modal (At least 10 lines of height!) */}
      {activeModalNote && (
        <Modal
          open={Boolean(activeModalNote)}
          onClose={() => setActiveModalNote(null)}
          title={isNewNote ? 'New Note' : `Edit Note: ${modalTitle || 'Untitled'}`}
          icon="fas fa-sticky-note"
          maxWidth={720}
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
