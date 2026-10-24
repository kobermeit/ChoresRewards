export interface NoteColumn {
  id: string;
  title: string;
  color: string;
}

export interface KanbanNote {
  id: string;
  column_id: string;
  text: string;
  checked?: boolean;
  order?: number;
  deleted?: boolean;
  deleted_at?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  color?: string;
  created_at?: string;
}

export interface DashboardStickyNote {
  id: string;
  title?: string;
  text: string;
  color: string;
  width?: number;
  height?: number;
  text_size?: 'sm' | 'md' | 'lg';
  pinned?: boolean;
}
