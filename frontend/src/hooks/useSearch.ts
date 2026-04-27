import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import type { SearchResult } from '../types';
import { searchAll } from '../api/client';
import { useMapStore } from '../store/useMapStore';
import { fetchAerodromeMetadata } from '../api/client';

const MAX_SEARCH_CACHE = 100;
const searchCache = new Map<string, SearchResult[]>();

/** Evict oldest entries when cache exceeds limit */
function cacheSet(key: string, value: SearchResult[]) {
  if (searchCache.size >= MAX_SEARCH_CACHE) {
    // Map iterates in insertion order — delete the oldest half
    const keysToDelete = [...searchCache.keys()].slice(0, Math.floor(MAX_SEARCH_CACHE / 2));
    for (const k of keysToDelete) searchCache.delete(k);
  }
  searchCache.set(key, value);
}

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
    setSelectedFeature,
    setHighlightedAirspaceId,
  } = useMapStore();

  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Ref to track the deferred post-animation selection timer
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useLayoutEffect(
    () => () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    },
    [],
  );

  // Debounced fetch
  useEffect(() => {
    const query = searchInput.trim();
    if (query.length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    // Check cache first for instant results
    const cachedQuery = query.toLowerCase();
    if (searchCache.has(cachedQuery)) {
      setSuggestions(searchCache.get(cachedQuery) || []);
      setIsLoading(false);
      return;
    }

    // Clear stale suggestions and indicate loading if not in cache
    setSuggestions([]);
    setIsLoading(true);
    const controller = new AbortController();

    const timer = setTimeout(() => {
      searchAll(query, controller.signal)
        .then((data) => {
          cacheSet(cachedQuery, data);
          setSuggestions(data);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchInput]);

  // Reset keyboard index when input changes
  useEffect(() => {
    setSearchSelectedIndex(-1);
  }, [searchInput]);

  const resetSearchState = useCallback(() => {
    setIsSearchFocused(false);
    setSearchInput('');
    searchInputRef.current?.blur();
  }, []);

  const handleGlobalSearchSelect = useCallback(
    (item: SearchResult) => {
      // Clear any pending deferred selection
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);

      // 1. Kick off the camera animation immediately
      if (item.type === 'ATS_ROUTE' && item.bounds && item.bounds.length === 4) {
        fitBounds(item.bounds as [number, number, number, number]);
      } else if (
        item.center &&
        item.center.length >= 2 &&
        item.center[0] !== undefined &&
        item.center[1] !== undefined
      ) {
        const isAero = item.type === 'AERODROME';
        const targetPitch = isAero ? 60 : 0;
        flyToLocation(
          item.center[0],
          item.center[1],
          15,
          targetPitch,
          isAero ? 'TERMINAL' : 'ENROUTE',
        );
      }

      // Aerodrome layer activations happen immediately (different view mode)
      if (item.type === 'AERODROME') {
        if (!activeLayers.aerodromes) toggleLayer('aerodromes');
        setActiveAirport(item.id);
        fetchAerodromeMetadata(item.id).then((data) => {
          setActiveAerodromeMetadata(data);
        });
      }

      resetSearchState();

      // 2. Defer the visual highlight injection until after the flyTo animation (1200ms)
      selectionTimerRef.current = setTimeout(() => {
        // Activate layer if needed (do it just before showing highlight)
        switch (item.type) {
          case 'NAVAID':
            if (!activeLayers.navaids) toggleLayer('navaids');
            break;
          case 'WAYPOINT':
            if (!activeLayers.waypoints) toggleLayer('waypoints');
            break;
          case 'ATS_ROUTE':
            setSelectedRouteIds([item.id], item.route_type);
            break;
          case 'AIRSPACE':
            if (!activeLayers.airspaces) toggleLayer('airspaces');
            setHighlightedAirspaceId(item.id);
            break;
        }

        if (
          ['ATS_ROUTE', 'NAVAID', 'WAYPOINT', 'AIRSPACE'].includes(item.type) &&
          item.properties
        ) {
          setSelectedFeature({ type: item.type as any, data: item.properties });
        }
      }, 1200);
    },
    [
      activeLayers,
      toggleLayer,
      setActiveAirport,
      flyToLocation,
      fitBounds,
      setSelectedRouteIds,
      setActiveAerodromeMetadata,
      setSelectedFeature,
      setHighlightedAirspaceId,
      resetSearchState,
    ],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSearchSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSearchSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchSelectedIndex >= 0 && searchSelectedIndex < suggestions.length) {
          const selectedItem = suggestions[searchSelectedIndex];
          if (selectedItem) handleGlobalSearchSelect(selectedItem);
        } else if (suggestions.length > 0) {
          const firstItem = suggestions[0];
          if (firstItem) handleGlobalSearchSelect(firstItem);
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
    isLoading,
    handleGlobalSearchSelect,
    handleSearchKeyDown,
    cancelPendingSelection: () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    },
  };
}
