import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchResult } from '../types';
import { searchAll } from '../api/client';
import { useMapStore } from '../store/useMapStore';
import { fetchAerodromeMetadata } from '../api/client';

/**
 * Encapsulates the entire global search flow:
 *  - Input value, suggestions, focus, keyboard navigation
 *  - Debounced API calls
 *  - "Select" handler (flyTo + layer activation + search reset)
 */
export function useSearch() {
  const {
    flyToLocation,
    fitBounds,
    activeLayers,
    toggleLayer,
    setActiveAirport,
    setActiveAerodromeMetadata,
    setSelectedRouteIds,
  } = useMapStore();

  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced fetch
  useEffect(() => {
    const query = searchInput.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      searchAll(query).then(setSuggestions);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset keyboard index when input changes
  useEffect(() => setSearchSelectedIndex(-1), [searchInput]);

  const resetSearchState = useCallback(() => {
    setIsSearchFocused(false);
    setSearchInput('');
    searchInputRef.current?.blur();
  }, []);

  const handleGlobalSearchSelect = useCallback(
    (item: SearchResult) => {
      // 1. Zoom / Pan
      if (item.type === 'ATS_ROUTE' && item.bounds) {
        fitBounds(item.bounds);
      } else if (item.center) {
        const targetPitch = item.type === 'AERODROME' ? 60 : 0;
        flyToLocation(item.center[0], item.center[1], 15, targetPitch);
      }

      // 2. Map layer & state injection
      switch (item.type) {
        case 'AERODROME':
          if (!activeLayers.aerodromes) toggleLayer('aerodromes');
          setActiveAirport(item.id);
          fetchAerodromeMetadata(item.id).then((data) => {
            setActiveAerodromeMetadata(data);
          });
          break;
        case 'NAVAID':
          if (!activeLayers.navaids) toggleLayer('navaids');
          break;
        case 'WAYPOINT':
          if (!activeLayers.waypoints) toggleLayer('waypoints');
          break;
        case 'ATS_ROUTE':
          if (!activeLayers.atsRoutes) toggleLayer('atsRoutes');
          setSelectedRouteIds([item.id]);
          break;
      }

      resetSearchState();
    },
    [
      activeLayers,
      toggleLayer,
      setActiveAirport,
      flyToLocation,
      fitBounds,
      setSelectedRouteIds,
      setActiveAerodromeMetadata,
      resetSearchState,
    ],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSearchSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSearchSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchSelectedIndex >= 0 && searchSelectedIndex < suggestions.length) {
          handleGlobalSearchSelect(suggestions[searchSelectedIndex]);
        } else if (suggestions.length > 0) {
          handleGlobalSearchSelect(suggestions[0]);
        }
      } else if (e.key === 'Escape') {
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
      }
    },
    [suggestions, searchSelectedIndex, handleGlobalSearchSelect],
  );

  return {
    searchInput,
    setSearchInput,
    suggestions,
    isSearchFocused,
    setIsSearchFocused,
    searchSelectedIndex,
    setSearchSelectedIndex,
    searchInputRef,
    handleGlobalSearchSelect,
    handleSearchKeyDown,
  };
}
