import React, { useEffect, useRef } from 'react';
import { Button } from '@heroui/react';
import { Search, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SearchResult } from '../../../types';

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

/**
 * The global search bar with autocomplete dropdown.
 * Redesigned according to Obsidian Slate system.
 */
export default function SearchBar({
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
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExpanded = isSearchFocused || searchInput.length > 0;

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  return (
    <div className="aip-search-container">
      <motion.div
        layout
        initial={false}
        animate={{
          width: isExpanded ? '28rem' : '8.5rem',
        }}
        transition={{ type: 'spring', stiffness: 700, damping: 40, mass: 0.4 }}
        className="aip-search-bar"
        onClick={() => {
          if (!isExpanded) {
            searchInputRef.current?.focus();
            setIsSearchFocused(true);
          }
        }}
      >
        <div className="flex-1 overflow-hidden px-5 flex items-center">
          <input
            ref={searchInputRef}
            className="aip-search-input !px-0"
            placeholder="Search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = setTimeout(() => {
                setIsSearchFocused(false);
              }, 300);
            }}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        <div className="flex items-center gap-1 pr-4 shrink-0">
          <AnimatePresence mode="wait">
            {searchInput && isExpanded ? (
              <motion.div
                key="clear"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.1 }}
              >
                <Button
                  data-testid="search-clear-button"
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  onPress={() => {
                    setSearchInput('');
                  }}
                  className="text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white/80"
                >
                  <X size={16} />
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="aip-search-icon-wrapper !w-auto">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                >
                  <Loader2 size={18} className="animate-spin text-slate-700 dark:text-white/80" />
                </motion.div>
              ) : (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Search size={18} className="text-slate-800 dark:text-white/90" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Autocomplete Dropdown */}
      <AnimatePresence>
        {isSearchFocused && searchInput.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="aip-search-results-wrapper"
          >
            {isLoading ? (
              <div className="px-4 py-8 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 border-slate-300 dark:bg-white/5 flex items-center justify-center border dark:border-white/10">
                  <Loader2 size={24} className="text-slate-900 dark:text-white animate-spin" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-slate-900 dark:text-white text-sm font-bold tracking-widest uppercase">
                    Searching Database
                  </span>
                  <span className="text-slate-500 dark:text-white/40 text-[10px] uppercase tracking-[0.2em] font-medium">
                    Faster than a turboprop
                  </span>
                </div>
              </div>
            ) : suggestions.length > 0 ? (
              <div className="py-2">
                {suggestions.map((item: SearchResult, index: number) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    data-testid="search-result-item"
                    className={`aip-search-result-item w-full text-left flex items-center justify-between ${
                      index === searchSelectedIndex ? 'selected' : ''
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleGlobalSearchSelect(item);
                    }}
                    onMouseEnter={() => setSearchSelectedIndex(index)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border-slate-200 dark:bg-white/5 flex items-center justify-center shrink-0 border dark:border-white/5">
                        <Search size={14} className="text-slate-500 dark:text-white/60" />
                      </div>
                      <div className="flex flex-col">
                        <span className="aip-search-result-id">{item.id}</span>
                        <span className="aip-search-result-name">
                          {item.name || 'Unknown Location'}
                        </span>
                      </div>
                    </div>
                    <div className="aip-search-result-type">{item.type.replace('_', ' ')}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-8 py-12 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-white/5 flex items-center justify-center opacity-50 dark:opacity-30">
                  <Search size={24} className="text-slate-800 dark:text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-600 dark:text-white/50 text-sm font-bold tracking-wider uppercase">
                    No matching locations
                  </span>
                  <span className="text-slate-400 dark:text-white/20 text-[10px] uppercase tracking-widest font-medium">
                    Try searching for ICAO codes or Airport names
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
