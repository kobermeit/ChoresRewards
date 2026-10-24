export type ActiveView =
  | 'dashboard'
  | 'chores'
  | 'rewards'
  | 'redeemed'
  | 'meals'
  | 'shopping'
  | 'library'
  | 'notes'
  | 'organise'
  | 'calendar'
  | 'settings'
  | 'activity_log'
  | 'chore_history'
  | 'help';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  undoAction?: () => void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
