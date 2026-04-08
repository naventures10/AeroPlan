import React, { useEffect, useRef } from 'react';
import { Button } from '@heroui/react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SearchResult } from '../../../types';

interface SearchBarProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  suggestions: SearchResult[];
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
 * Visible only in ENROUTE view mode.
 */
export default function SearchBar({
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
}: SearchBarProps) {
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  return (
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-[28rem] max-w-[90vw] pointer-events-auto z-50">
      <div className="relative rounded-full shadow-2xl">
        <div className="flex items-center w-full glass-morphism h-14 px-4 bg-zinc-950/40 hover:bg-zinc-950/60 focus-within:!bg-zinc-950/40 border-zinc-800/60 rounded-full transition-colors duration-300">
          <Search size={18} strokeWidth={2} className="text-zinc-400 shrink-0" />
          <input
            ref={searchInputRef}
            className="flex-1 bg-transparent border-none outline-none shadow-none text-zinc-100 font-semibold text-sm placeholder-zinc-500 uppercase tracking-[0.1em] px-3 h-full w-full"
            placeholder="SEARCH AIRPORT OR ICAO..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); }}
            onFocus={() => { setIsSearchFocused(true); }}
            onBlur={() => {
              if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = setTimeout(() => { setIsSearchFocused(false); }, 200);
            }}
            onKeyDown={handleSearchKeyDown}
          />
          <AnimatePresence>
            {searchInput && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center"
              >
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  onPress={() => { setSearchInput(''); }}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <X size={16} />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Autocomplete Dropdown */}
        <AnimatePresence>
          {isSearchFocused && searchInput.trim().length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 glass-morphism-heavy rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/60"
            >
              {suggestions.length > 0 ? (
                <div className="py-2">
                  {suggestions.map((item: SearchResult, index: number) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors border-l-2 ${
                        index === searchSelectedIndex
                          ? 'bg-zinc-800/80 border-cyan-400'
                          : 'hover:bg-zinc-800/50 border-transparent'
                      } ${
                        index !== suggestions.length - 1
                          ? 'border-b border-zinc-800/50'
                          : ''
                      }`}
                      onClick={() => { handleGlobalSearchSelect(item); }}
                      onMouseEnter={() => { setSearchSelectedIndex(index); }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center">
                          <Search size={14} className="text-zinc-400" />
                        </div>
                        <div className="flex flex-col">
                          <span
                            className={`font-mono font-semibold tracking-wider text-[15px] ${
                              index === searchSelectedIndex
                                ? 'text-cyan-400'
                                : 'text-zinc-100'
                            }`}
                          >
                            {item.id}
                          </span>
                          <span className="text-[11px] font-medium tracking-wide text-zinc-400 mt-0.5 uppercase">
                            {item.name || 'UNKNOWN LOCATION'}
                          </span>
                        </div>
                      </div>
                      <div className="px-2 py-0.5 rounded-sm bg-zinc-800/50">
                        <span className="text-[10px] font-bold tracking-widest text-zinc-500">
                          {item.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-zinc-500 text-sm font-medium tracking-wide leading-relaxed">
                  NO MATCHING LOCATIONS FOUND
                  <br />
                  <span className="text-xs text-zinc-600 mt-2 block">
                    Search Aerodromes, Waypoints, NavAids, or ATS Routes
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
