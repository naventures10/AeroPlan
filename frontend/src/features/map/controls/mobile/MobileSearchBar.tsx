import React, { useEffect } from 'react';
import './MobileSearchBar.css';
import { Search, X, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SearchResult } from '../../../../types';

interface SearchBarProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  suggestions: SearchResult[];
  isLoading: boolean;
  isSearchFocused: boolean;
  setIsSearchFocused: (value: boolean) => void;
  searchSelectedIndex: number;
  setSearchSelectedIndex: (index: number) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  handleGlobalSearchSelect: (item: SearchResult) => void;
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function MobileSearchBar({
  searchInput,
  setSearchInput,
  suggestions,
  isLoading,
  isSearchFocused,
  setIsSearchFocused,
  searchSelectedIndex,
  setSearchSelectedIndex,
  searchInputRef,
  handleGlobalSearchSelect,
  handleSearchKeyDown,
}: SearchBarProps) {
  // Focus the input when the overlay opens
  useEffect(() => {
    if (isSearchFocused) {
      // Small timeout to ensure input is mounted and animated
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isSearchFocused, searchInputRef]);

  const handleClose = () => {
    setIsSearchFocused(false);
  };

  const handleItemSelect = (item: SearchResult) => {
    handleGlobalSearchSelect(item);
    setIsSearchFocused(false);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isSearchFocused && (
        <button
          type="button"
          data-testid="mobile-search-trigger"
          className="aip-mobile-search-trigger"
          onClick={() => setIsSearchFocused(true)}
        >
          <Search size={18} />
        </button>
      )}

      {/* Fullscreen Search Overlay */}
      <AnimatePresence>
        {isSearchFocused && (
          <motion.div
            initial={{ opacity: 0, y: '30px' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '30px' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="aip-mobile-search-overlay"
          >
            {/* Header */}
            <div className="aip-mobile-search-header">
              <button
                type="button"
                data-testid="mobile-search-back"
                className="aip-mobile-search-back-btn"
                onClick={handleClose}
              >
                <ArrowLeft size={24} />
              </button>

              <div className="aip-mobile-search-input-wrapper">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="aip-mobile-search-input"
                  placeholder="Search locations..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />

                <div className="flex items-center gap-2">
                  {isLoading && (
                    <Loader2 size={18} className="animate-spin text-on-surface-variant" />
                  )}
                  {searchInput && (
                    <button
                      type="button"
                      data-testid="mobile-search-clear"
                      className="aip-mobile-search-clear-btn"
                      onClick={() => setSearchInput('')}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Results Area */}
            <div className="aip-mobile-search-results">
              {isLoading && suggestions.length === 0 ? (
                <div className="px-4 py-8 flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 rounded-full border-outline flex items-center justify-center border">
                    <Loader2 size={24} className="text-on-surface animate-spin" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-on-surface text-sm font-bold tracking-widest uppercase">
                      Searching Database
                    </span>
                  </div>
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map((item: SearchResult, index: number) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    data-testid="mobile-search-result-item"
                    className={`aip-mobile-search-item ${
                      index === searchSelectedIndex ? 'selected' : ''
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleItemSelect(item);
                    }}
                    onMouseEnter={() => setSearchSelectedIndex(index)}
                  >
                    <div className="aip-mobile-search-item-icon">
                      <Search size={16} />
                    </div>
                    <div className="aip-mobile-search-item-info">
                      <span className="aip-mobile-search-item-id">{item.id}</span>
                      <span className="aip-mobile-search-item-name">
                        {item.name || 'Unknown Location'}
                      </span>
                    </div>
                    <div className="aip-mobile-search-item-type">{item.type.replace('_', ' ')}</div>
                  </button>
                ))
              ) : (
                searchInput.trim().length > 0 && (
                  <div className="px-8 py-12 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center opacity-50">
                      <Search size={24} className="text-on-surface" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-on-surface-variant text-sm font-bold tracking-wider uppercase">
                        No matching locations
                      </span>
                      <span className="text-slate-500 text-xs">
                        Try searching for ICAO codes or Airport names
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
