import { useEffect } from 'react';

let lockCount = 0;

/**
 * Hook to lock body scroll when a modal or overlay is open.
 * Uses reference counting so nested or multiple modals don't prematurely unlock the body.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    lockCount++;
    if (lockCount === 1) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('cr-modal-open');
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = '';
        document.body.classList.remove('cr-modal-open');
      }
    };
  }, [isLocked]);

  // Safety cleanup: if unmounted or navigation occurs, ensure scroll lock doesn't leak if no modals are open
  useEffect(() => {
    return () => {
      setTimeout(() => {
        const hasOpenModal = typeof document !== 'undefined' && document.querySelector('.cr-modal-overlay');
        if (!hasOpenModal) {
          lockCount = 0;
          document.body.style.overflow = '';
          document.body.classList.remove('cr-modal-open');
        }
      }, 50);
    };
  }, []);
}
