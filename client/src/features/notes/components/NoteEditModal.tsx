import React from 'react';
import { Button, Input, RichEditor } from '../../../components/ui';
import { Modal } from '../../../components/common/Modal';
import { POSTIT_COLORS } from '../noteUtils';

interface NoteEditModalProps {
  open: boolean;
  isNew: boolean;
  title: string;
  content: string;
  color: string;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onChangeColor: (color: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const NoteEditModal: React.FC<NoteEditModalProps> = ({
  open,
  isNew,
  title,
  content,
  color,
  onChangeTitle,
  onChangeContent,
  onChangeColor,
  onSave,
  onClose,
}) => {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'New Note' : `Edit Note: ${title || 'Untitled'}`}
      icon="fas fa-align-left"
      maxWidth={760}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="fas fa-check"
            onClick={onSave}
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
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          autoFocus
        />

        {/* Color Swatch Picker */}
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
            Note Color
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {POSTIT_COLORS.map((col) => {
              const isSelected = color === col;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => onChangeColor(col)}
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

        {/* Spacious Rich Text Area */}
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
            Note Content
          </label>
          <RichEditor
            value={content}
            onChange={(html) => onChangeContent(html)}
            placeholder="Write your note here... Use formatting, bullets, checklists, or paste text."
            minHeight="320px"
          />
        </div>
      </div>
    </Modal>
  );
};
