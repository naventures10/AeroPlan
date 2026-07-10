import { useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';

/**
 * Registers global keyboard shortcuts.
 *
 * Currently handles:
 *  - ESC: close section modal → exit weather mode → exit terminal view → return to enroute
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
  const returnToEnroute = useMapStore((s) => s.returnToEnroute);
  const setSelectedRouteIds = useMapStore((s) => s.setSelectedRouteIds);
  const setSelectedFeature = useMapStore((s) => s.setSelectedFeature);
  const setIsWeatherMode = useMapStore((s) => s.setIsWeatherMode);

  useEffect(() => {
    // fallow-ignore-next-line complexity
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
          isWeatherMode,
          activeLayers,
        } = useMapStore.getState();

        if (sectionModalOpen) {
          onCloseSectionModal();
        } else if (isWeatherMode || activeLayers.weather) {
          setIsWeatherMode(false);
        } else if (viewMode === 'TERMINAL' || activeAirport) {
          returnToEnroute(true);
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
    setIsWeatherMode,
  ]);
}
