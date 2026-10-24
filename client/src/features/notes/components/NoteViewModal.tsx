import React from 'react';
import { NoteItem } from '../../../types';
import { Button } from '../../../components/ui';
import { Modal } from '../../../components/common/Modal';
import { renderFormattedContent } from '../noteUtils';

interface NoteViewModalProps {
  note: NoteItem | null;
  onClose: () => void;
  onEdit: (note: NoteItem) => void;
  onDelete: (noteId: string) => void;
  onCopy: (text: string) => void;
}

export const NoteViewModal: React.FC<NoteViewModalProps> = ({
  note,
  onClose,
  onEdit,
  onDelete,
  onCopy,
}) => {
  if (!note) return null;

  const plainText = (note.content || '').replace(/<[^>]*>/g, '');

  return (
    <Modal
      open={Boolean(note)}
      onClose={onClose}
      title={note.title || 'Untitled Note'}
      icon="fas fa-newspaper"
      maxWidth={840}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              variant="ghost"
              size="sm"
              icon="fas fa-copy"
              onClick={() => onCopy(plainText)}
            >
              Copy
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon="fas fa-trash-alt"
              onClick={() => {
                const id = note.id;
                onClose();
                onDelete(id);
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
                const current = note;
                onClose();
                onEdit(current);
              }}
            >
              Edit Note
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
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
        {renderFormattedContent(note.content)}
      </div>
    </Modal>
  );
};
