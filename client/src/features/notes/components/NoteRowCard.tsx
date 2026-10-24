import React, { memo } from 'react';
import { NoteItem } from '../../../types';
import { IconButton } from '../../../components/ui';
import { POSTIT_COLORS, renderFormattedContent } from '../noteUtils';

interface NoteRowCardProps {
  note: NoteItem;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (noteId: string, e?: React.MouseEvent) => void;
  onView: (note: NoteItem) => void;
  onEdit: (note: NoteItem) => void;
  onCopy: (text: string) => void;
  onDelete: (noteId: string) => void;
}

export const NoteRowCard: React.FC<NoteRowCardProps> = memo(({
  note,
  index,
  isExpanded,
  onToggleExpand,
  onView,
  onEdit,
  onCopy,
  onDelete,
}) => {
  const cardColor = note.color || POSTIT_COLORS[index % POSTIT_COLORS.length];
  const plainText = (note.content || '').replace(/<[^>]*>/g, '');
  const charCount = plainText.length;

  return (
    <div
      className="note-reddit-row"
      style={{
        border: `1px solid ${cardColor}33`,
        borderLeft: `5px solid ${cardColor}`,
      }}
    >
      {/* Note Row Header */}
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
        onClick={() => onView(note)}
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
            onClick={(e) => onToggleExpand(note.id, e)}
          />
          <IconButton
            size="sm"
            variant="ghost"
            icon="fas fa-expand"
            aria-label="View full note"
            title="View full note"
            onClick={() => onView(note)}
          />
          <IconButton
            size="sm"
            variant="ghost"
            icon="fas fa-pencil-alt"
            aria-label="Edit note"
            title="Edit note"
            onClick={() => onEdit(note)}
          />
          <IconButton
            size="sm"
            variant="ghost"
            icon="fas fa-copy"
            aria-label="Copy note text"
            title="Copy note text"
            onClick={() => onCopy(plainText)}
          />
          <IconButton
            size="sm"
            variant="danger"
            icon="fas fa-trash-alt"
            aria-label="Delete note"
            title="Delete note"
            onClick={() => onDelete(note.id)}
          />
        </div>
      </div>

      {/* Note Row Body */}
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
        onClick={() => onView(note)}
        title="Click to view full note"
      >
        {renderFormattedContent(note.content)}
      </div>
    </div>
  );
});
