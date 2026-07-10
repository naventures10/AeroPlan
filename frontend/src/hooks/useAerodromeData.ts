import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchAerodromes,
  fetchAerodromeMetadata,
  fetchAerodromeSection,
  fetchAtsRouteLabels,
} from '../api/client';
import { useMapStore } from '../store/useMapStore';

/**
 * Manages:
 *  - Initial aerodromes GeoJSON fetch
 *  - Click handler (fly to + set active airport + fetch metadata)
 *  - AIP section selection state & fetch
 *  - Lazy ATS route labels fetch (deferred until layer is toggled on)
 */
export function useAerodromeData() {
  const flyToLocation = useMapStore((s) => s.flyToLocation);
  const setActiveAirport = useMapStore((s) => s.setActiveAirport);
  const setActiveAerodromeMetadata = useMapStore((s) => s.setActiveAerodromeMetadata);
  const activeAirport = useMapStore((s) => s.activeAirport);
  const setAtsRouteLabels = useMapStore((s) => s.setAtsRouteLabels);
  const setTerminalPivot = useMapStore((s) => s.setTerminalPivot);
  const activeLayers = useMapStore((s) => s.activeLayers);
  const selectedRouteIds = useMapStore((s) => s.selectedRouteIds);

  const [aerodromes, setAerodromes] = useState<any>(null);
  const atsLabelsFetched = useRef(false);

  // Section modal state
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [sectionData, setSectionData] = useState<any>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [sectionDataType, setSectionDataType] = useState('object');
  const [sectionLoading, setSectionLoading] = useState(false);

  // Fetch aerodromes once on mount
  useEffect(() => {
    fetchAerodromes()
      .then(setAerodromes)
      .catch((err) => {
        console.error('Failed to fetch aerodromes', err);
      });
  }, []);

  // Lazy-load ATS route labels only when the layer is first needed
  useEffect(() => {
    if (atsLabelsFetched.current) return;
    if (!activeLayers.atsRoutes && selectedRouteIds.length === 0) return;

    atsLabelsFetched.current = true;
    fetchAtsRouteLabels()
      .then(setAtsRouteLabels)
      .catch((err) => {
        console.error('Failed to fetch ATS labels', err);
      });
  }, [activeLayers.atsRoutes, selectedRouteIds.length, setAtsRouteLabels]);

  // Handle clicking an aerodrome on the map
  const handleAerodromeClick = useCallback(
    (icao: string, coords: [number, number]) => {
      setActiveAirport(icao);
      setTerminalPivot(coords);
      flyToLocation(coords[0], coords[1], 15, 60);

      fetchAerodromeMetadata(icao)
        .then((data) => {
          setActiveAerodromeMetadata(data);
        })
        .catch((err) => {
          console.error('Failed to fetch metadata', err);
        });
    },
    [flyToLocation, setActiveAirport, setActiveAerodromeMetadata, setTerminalPivot],
  );

  // Handle selecting an AIP section from the dropdown
  const handleSectionSelect = useCallback(
    (selectedSectionId: string) => {
      if (!activeAirport) return;
      setSectionLoading(true);
      setSectionModalOpen(true);
      setSectionId(selectedSectionId);
      setSectionData(null);
      setSectionTitle('');
      setSectionDataType('object');

      fetchAerodromeSection(activeAirport, selectedSectionId)
        .then((result) => {
          setSectionTitle(result.title || '');
          setSectionDataType(result.data_type || 'object');
          setSectionData(result.data);
        })
        .catch((err) => {
          console.error('Failed to fetch section:', err);
          setSectionData(null);
          setSectionTitle('Error loading section');
        })
        .finally(() => {
          setSectionLoading(false);
        });
    },
    [activeAirport],
  );

  const closeSectionModal = useCallback(() => {
    setSectionModalOpen(false);
  }, []);

  return {
    aerodromes,
    handleAerodromeClick,

    // Section modal
    sectionModalOpen,
    closeSectionModal,
    sectionData,
    sectionTitle,
    sectionId,
    sectionDataType,
    sectionLoading,
    handleSectionSelect,
  };
}
