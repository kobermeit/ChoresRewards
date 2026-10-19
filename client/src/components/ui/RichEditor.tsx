import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

export interface RichEditorProps {
  value: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: number | string;
  maxHeight?: number | string;
  readOnly?: boolean;
  className?: string;
  compact?: boolean;
}

export const RichEditor: React.FC<RichEditorProps> = ({
  value,
  onChange,
  placeholder = 'Type something...',
  minHeight = '120px',
  maxHeight = '400px',
  readOnly = false,
  className = '',
  compact = false,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  // Keep editor content in sync when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  // Update editable mode if readOnly changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [readOnly, editor]);

  if (!editor) {
    return null;
  }

  const renderToolbarBtn = (
    icon: string,
    action: () => void,
    isActive: boolean,
    title: string
  ) => (
    <button
      type="button"
      onClick={action}
      className={`cr-editor-tool-btn ${isActive ? 'is-active' : ''}`}
      title={title}
      style={{
        width: compact ? 26 : 30,
        height: compact ? 26 : 30,
        borderRadius: 6,
        border: isActive
          ? '1px solid rgba(59, 130, 246, 0.6)'
          : '1px solid rgba(255, 255, 255, 0.08)',
        background: isActive
          ? 'rgba(59, 130, 246, 0.25)'
          : 'rgba(255, 255, 255, 0.04)',
        color: isActive ? '#60a5fa' : '#cbd5e1',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: compact ? '0.74rem' : '0.82rem',
        transition: 'all 0.12s ease',
      }}
    >
      <i className={icon} />
    </button>
  );

  return (
    <div
      className={`cr-rich-editor ${className}`}
      style={{
        borderRadius: 'var(--input-radius, 10px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: 'rgba(15, 23, 42, 0.65)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!readOnly && (
        <div
          className="cr-editor-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: compact ? '4px 6px' : '6px 8px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            flexWrap: 'wrap',
          }}
        >
          {renderToolbarBtn(
            'fas fa-bold',
            () => editor.chain().focus().toggleBold().run(),
            editor.isActive('bold'),
            'Bold (Ctrl+B)'
          )}
          {renderToolbarBtn(
            'fas fa-italic',
            () => editor.chain().focus().toggleItalic().run(),
            editor.isActive('italic'),
            'Italic (Ctrl+I)'
          )}
          {renderToolbarBtn(
            'fas fa-strikethrough',
            () => editor.chain().focus().toggleStrike().run(),
            editor.isActive('strike'),
            'Strikethrough'
          )}
          {renderToolbarBtn(
            'fas fa-code',
            () => editor.chain().focus().toggleCode().run(),
            editor.isActive('code'),
            'Inline Code'
          )}

          <div
            style={{
              width: 1,
              height: compact ? 16 : 20,
              background: 'rgba(255, 255, 255, 0.12)',
              margin: '0 2px',
            }}
          />

          {!compact && (
            <>
              {renderToolbarBtn(
                'fas fa-heading',
                () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
                editor.isActive('heading', { level: 2 }),
                'Heading 2'
              )}
              {renderToolbarBtn(
                'fas fa-h',
                () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
                editor.isActive('heading', { level: 3 }),
                'Heading 3'
              )}
            </>
          )}

          {renderToolbarBtn(
            'fas fa-list-ul',
            () => editor.chain().focus().toggleBulletList().run(),
            editor.isActive('bulletList'),
            'Bullet List'
          )}
          {renderToolbarBtn(
            'fas fa-list-ol',
            () => editor.chain().focus().toggleOrderedList().run(),
            editor.isActive('orderedList'),
            'Numbered List'
          )}
          {renderToolbarBtn(
            'fas fa-check-square',
            () => editor.chain().focus().toggleTaskList().run(),
            editor.isActive('taskList'),
            'Task Checklist'
          )}

          <div
            style={{
              width: 1,
              height: compact ? 16 : 20,
              background: 'rgba(255, 255, 255, 0.12)',
              margin: '0 2px',
            }}
          />

          {renderToolbarBtn(
            'fas fa-undo',
            () => editor.chain().focus().undo().run(),
            false,
            'Undo'
          )}
          {renderToolbarBtn(
            'fas fa-redo',
            () => editor.chain().focus().redo().run(),
            false,
            'Redo'
          )}
        </div>
      )}

      {/* Editable Area */}
      <div
        style={{
          padding: compact ? '8px 10px' : '12px 14px',
          minHeight,
          maxHeight,
          overflowY: 'auto',
          color: '#f8fafc',
          fontSize: compact ? '0.86rem' : '0.94rem',
          lineHeight: 1.55,
        }}
      >
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .cr-rich-editor .tiptap {
          outline: none;
        }
        .cr-rich-editor .tiptap p {
          margin: 0.35em 0;
        }
        .cr-rich-editor .tiptap h2 {
          font-size: 1.25rem;
          color: #f8fafc;
          font-weight: 800;
          margin: 0.8em 0 0.3em;
        }
        .cr-rich-editor .tiptap h3 {
          font-size: 1.05rem;
          color: #60a5fa;
          font-weight: 700;
          margin: 0.7em 0 0.25em;
        }
        .cr-rich-editor .tiptap ul, .cr-rich-editor .tiptap ol {
          padding-left: 1.4em;
          margin: 0.4em 0;
        }
        .cr-rich-editor .tiptap li {
          margin: 0.2em 0;
        }
        .cr-rich-editor .tiptap ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
          margin: 0.4em 0;
        }
        .cr-rich-editor .tiptap ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 0.25em 0;
        }
        .cr-rich-editor .tiptap ul[data-type="taskList"] li > label {
          margin-top: 3px;
          user-select: none;
        }
        .cr-rich-editor .tiptap ul[data-type="taskList"] li > label input[type="checkbox"] {
          cursor: pointer;
          accent-color: #3b82f6;
        }
        .cr-rich-editor .tiptap code {
          background: rgba(255, 255, 255, 0.12);
          padding: 2px 5px;
          border-radius: 4px;
          font-family: monospace;
          color: #93c5fd;
          font-size: 0.88em;
        }
        .cr-rich-editor .tiptap blockquote {
          border-left: 3px solid #3b82f6;
          padding-left: 10px;
          margin: 0.6em 0;
          color: #94a3b8;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default RichEditor;
