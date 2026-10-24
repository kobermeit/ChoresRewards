import React, { useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { apiPost } from '../../api';
import { PageContainer, Button } from '../../components/ui';
import { NoteItem } from '../../types';
import { POSTIT_COLORS } from './noteUtils';
import { NoteRowCard } from './components/NoteRowCard';
import { NoteViewModal } from './components/NoteViewModal';
import { NoteEditModal } from './components/NoteEditModal';

export interface NotesSectionProps {
  isStandalonePage?: boolean;
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

  const toggleExpandNote = useCallback((noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNoteIds((prev) => ({
      ...prev,
      [noteId]: !prev[noteId],
    }));
  }, []);

  if (!data) return null;

  const notes: NoteItem[] = data.text_pads || [];

  const handleOpenNewNoteModal = () => {
    setIsNewNote(true);
    setModalTitle('');
    setModalContent('');
    setModalColor(POSTIT_COLORS[notes.length % POSTIT_COLORS.length]);
    setActiveModalNote({ id: '', title: '', content: '' });
  };

  const handleOpenEditNoteModal = useCallback((note: NoteItem) => {
    setIsNewNote(false);
    setModalTitle(note.title || '');
    setModalContent(note.content || '');
    setModalColor(note.color || POSTIT_COLORS[0]);
    setActiveModalNote(note);
  }, []);

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

  const handleDeleteNote = useCallback(async (noteId: string) => {
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
  }, [confirm, refresh, showToast]);

  const handleCopyNote = useCallback((text: string) => {
    navigator.clipboard?.writeText(text);
    showToast('Note copied to clipboard');
  }, [showToast]);

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
          {notes.map((note, idx) => (
            <NoteRowCard
              key={note.id}
              note={note}
              index={idx}
              isExpanded={Boolean(expandedNoteIds[note.id])}
              onToggleExpand={toggleExpandNote}
              onView={setViewNoteItem}
              onEdit={handleOpenEditNoteModal}
              onCopy={handleCopyNote}
              onDelete={handleDeleteNote}
            />
          ))}
        </div>
      )}

      {/* Full-Page View Note Modal */}
      <NoteViewModal
        note={viewNoteItem}
        onClose={() => setViewNoteItem(null)}
        onEdit={handleOpenEditNoteModal}
        onDelete={handleDeleteNote}
        onCopy={handleCopyNote}
      />

      {/* Spacious Edit / Add Note Modal */}
      <NoteEditModal
        open={Boolean(activeModalNote)}
        isNew={isNewNote}
        title={modalTitle}
        content={modalContent}
        color={modalColor}
        onChangeTitle={setModalTitle}
        onChangeContent={setModalContent}
        onChangeColor={setModalColor}
        onSave={handleSaveModalNote}
        onClose={() => setActiveModalNote(null)}
      />
    </PageContainer>
  );
};
