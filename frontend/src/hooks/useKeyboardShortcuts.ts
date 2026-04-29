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
  cancelPendingSelection,
}: {
  sectionModalOpen: boolean;
  onCloseSectionModal: () => void;
  cancelPendingSelection: () => void;
}) {
  const { returnToEnroute, setSelectedRouteIds, setSelectedFeature, setIsWindMode } = useMapStore();

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      if (e.key === 'Escape') {
        const {
          viewMode,
          activeAirport,
          selectedRouteIds,
          selectedFeature,
          isWindMode,
          activeLayers,
        } = useMapStore.getState();

        if (sectionModalOpen) {
          onCloseSectionModal();
        } else if (isWindMode || activeLayers.windlayer) {
          setIsWindMode(false);
        } else if (viewMode === 'TERMINAL' || activeAirport) {
          returnToEnroute();
        } else if (selectedRouteIds?.length > 0 || selectedFeature) {
          cancelPendingSelection();
          setSelectedRouteIds([]);
          setSelectedFeature(null);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [
    returnToEnroute,
    sectionModalOpen,
    onCloseSectionModal,
    setSelectedRouteIds,
    setSelectedFeature,
    cancelPendingSelection,
    setIsWindMode,
  ]);
}
