import { useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';

/**
 * Registers global keyboard shortcuts.
 *
 * Currently handles:
 *  - ESC: close section modal → exit terminal view → return to enroute
 */
export function useKeyboardShortcuts({
  sectionModalOpen,
  onCloseSectionModal,
}: {
  sectionModalOpen: boolean;
  onCloseSectionModal: () => void;
}) {
  const { viewMode, activeAirport, returnToEnroute } = useMapStore();

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === 'Escape') {
        if (sectionModalOpen) {
          onCloseSectionModal();
        } else if (viewMode === 'TERMINAL' || activeAirport) {
          returnToEnroute();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [viewMode, activeAirport, returnToEnroute, sectionModalOpen, onCloseSectionModal]);
}
