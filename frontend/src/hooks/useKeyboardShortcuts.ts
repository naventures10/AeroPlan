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
  const { viewMode, activeAirport, returnToEnroute, selectedRouteIds, setSelectedRouteIds, selectedFeature, setSelectedFeature } = useMapStore();

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
        } else if (selectedRouteIds?.length > 0 || selectedFeature) {
          setSelectedRouteIds([]);
          setSelectedFeature(null);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [viewMode, activeAirport, returnToEnroute, sectionModalOpen, onCloseSectionModal, selectedRouteIds, setSelectedRouteIds, selectedFeature, setSelectedFeature]);
}
