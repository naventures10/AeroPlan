import { useEffect } from 'react';

/**
 * Custom hook to execute a callback when the Escape key is pressed.
 * Useful for closing modals, dialogs, or sidebars.
 *
 * @param isOpen Whether the component is currently open/active
 * @param onClose Callback to close the component
 */
export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);
}
