import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

import {
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isFeatureLocked } from '../../config/featureFlags';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './AerodromeChartViewer.css';
import '../aip/AerodromeInfoDropdown.css';

import { useMapStore } from '../../store/useMapStore';
import { normalizeChartKey } from '../../utils/chartKey';
import { fetchCharts, fetchRnpProcedures, getProxyPdfUrl } from '../../api/client';
import type { ChartItem, RnpProcedureApi } from '../../types';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface AerodromeChartViewerProps {
  icaoCode: string | null;
}

function candidateChartKeys(chart: ChartItem): string[] {
  const raw = [chart.chart_url, chart.chart_title, chart.chart_index];
  const keys = raw.map((s) => normalizeChartKey(s ?? '')).filter(Boolean);
  const derived: string[] = [];
  for (const k of keys) {
    derived.push(k);
    const stripped = k.replace(/-RNP-[A-Z]-RWY-/gi, '-RNP-RWY-');
    if (stripped !== k) {
      derived.push(stripped);
    }
  }
  return [...new Set(derived)];
}

function isSecondaryChart(chart: ChartItem): boolean {
  const fields = [chart.chart_url, chart.chart_title, chart.chart_index].map((s) =>
    (s ?? '').toLowerCase(),
  );

  const keywords = ['coding', 'table', 'tabel', 'fas', 'profile'];

  return fields.some((field) => keywords.some((keyword) => field.includes(keyword)));
}

function findRnpForChart(
  chart: ChartItem,
  byChartKey: Map<string, RnpProcedureApi>,
): RnpProcedureApi | null {
  if (isSecondaryChart(chart)) return null;
  for (const k of candidateChartKeys(chart)) {
    const hit = byChartKey.get(k);
    if (hit) return hit;
  }
  return null;
}

// fallow-ignore-next-line complexity
export default function AerodromeChartViewer({ icaoCode }: AerodromeChartViewerProps) {
  const isLocked = isFeatureLocked('aerodrome-charts');

  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [rnpProcedures, setRnpProcedures] = useState<RnpProcedureApi[]>([]);
  const [selectedChart, setSelectedChart] = useState<ChartItem | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const onModalOpen = useCallback(() => setIsModalOpen(true), []);
  const onModalClose = useCallback(() => setIsModalOpen(false), []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close the chart modal on Escape — stop propagation so the global
  // handler does not also exit the 3D terminal view.
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onModalClose();
        setSelectedChart(null);
        setNumPages(0);
        setCurrentPage(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isModalOpen, onModalClose]);

  const setViewMode = useMapStore((s) => s.setViewMode);
  const setSelectedRnpProcedure = useMapStore((s) => s.setSelectedRnpProcedure);
  const fitBounds = useMapStore((s) => s.fitBounds);

  const rnpByChartKey = useMemo(() => {
    const m = new Map<string, RnpProcedureApi>();
    // First pass: exact matches
    for (const p of rnpProcedures) {
      if (!m.has(p.chart_key)) m.set(p.chart_key, p);
    }
    // Second pass: fallback matches (strip Y/Z suffixes)
    for (const p of rnpProcedures) {
      const stripped = p.chart_key.replace(/-RNP-[A-Z]-RWY-/gi, '-RNP-RWY-');
      if (stripped !== p.chart_key && !m.has(stripped)) {
        m.set(stripped, p);
      }
    }
    return m;
  }, [rnpProcedures]);

  const matchedRnpForModal = useMemo(() => {
    if (!selectedChart) return null;
    return findRnpForChart(selectedChart, rnpByChartKey);
  }, [selectedChart, rnpByChartKey]);

  // Fetch charts when icaoCode changes
  useEffect(() => {
    if (!icaoCode) {
      setCharts([]);
      setRnpProcedures([]);
      return;
    }

    setIsLoading(true);
    fetchCharts(icaoCode)
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const indexA = a.chart_index ?? '';
          const indexB = b.chart_index ?? '';
          const indexCompare = indexA.localeCompare(indexB, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
          if (indexCompare !== 0) return indexCompare;

          const isSecondaryA = isSecondaryChart(a);
          const isSecondaryB = isSecondaryChart(b);
          if (isSecondaryA !== isSecondaryB) {
            return isSecondaryA ? 1 : -1;
          }

          const titleA = a.chart_title ?? '';
          const titleB = b.chart_title ?? '';
          return titleA.localeCompare(titleB, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        });
        setCharts(sorted);
      })
      .catch((err) => {
        console.error('Failed to fetch aerodrome charts:', err);
        setCharts([]);
      })
      .finally(() => {
        setIsLoading(false);
      });

    fetchRnpProcedures(icaoCode)
      .then((data) => {
        setRnpProcedures(data);
      })
      .catch((err) => {
        console.error('Failed to fetch RNP procedures:', err);
        setRnpProcedures([]);
      });
  }, [icaoCode]);

  const handleChartClick = useCallback(
    (chart: ChartItem) => {
      setSelectedChart(chart);
      setCurrentPage(1);
      setNumPages(0);
      setPdfScale(1.2);
      setIsDropdownOpen(false);
      onModalOpen();
    },
    [onModalOpen],
  );

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
  }, []);

  const handleModalClose = useCallback(() => {
    onModalClose();
    setSelectedChart(null);
    setNumPages(0);
    setCurrentPage(1);
  }, [onModalClose]);

  // fallow-ignore-next-line complexity
  const handleViewIn3D = useCallback(() => {
    if (!selectedChart || !matchedRnpForModal) return;
    const p = matchedRnpForModal;
    const hasBbox =
      p.min_lng != null &&
      p.min_lat != null &&
      p.max_lng != null &&
      p.max_lat != null &&
      Number.isFinite(p.min_lng) &&
      Number.isFinite(p.min_lat) &&
      Number.isFinite(p.max_lng) &&
      Number.isFinite(p.max_lat);
    const bounds: [number, number, number, number] | null = hasBbox
      ? [p.min_lng!, p.min_lat!, p.max_lng!, p.max_lat!]
      : null;

    setSelectedRnpProcedure({
      procedureId: p.procedure_id,
      chartKey: p.chart_key,
      bounds,
    });
    setViewMode('TERMINAL');
    {
      const { setViewState, viewState } = useMapStore.getState();
      setViewState({
        ...viewState,
        pitch: 45,
        maxPitch: 60,
        transitionDuration: 1200,
        transitionType: 'LINEAR',
      });
    }
    if (bounds) fitBounds(bounds);
    handleModalClose();
  }, [
    selectedChart,
    matchedRnpForModal,
    setSelectedRnpProcedure,
    setViewMode,
    fitBounds,
    handleModalClose,
  ]);

  // Use proxy URL directly for on-demand fetching via react-pdf
  const pdfUrl = selectedChart ? getProxyPdfUrl(selectedChart.chart_url!) : '';

  if (!icaoCode) return null;

  return (
    <>
      {/* ── Dropdown Container ────────────────────────────── */}
      <div ref={dropdownRef} className="relative z-50" data-testid="chart-dropdown">
        {/* Trigger Button */}
        <button
          onClick={() => {
            if (isLocked) return;
            setIsDropdownOpen(!isDropdownOpen);
          }}
          disabled={isLocked}
          className={`aip-dropdown-trigger flex items-center w-full gap-2.5 px-3 py-1.5 focus:outline-none ${
            isDropdownOpen ? 'active' : ''
          }${isLocked ? ' locked' : ''}`}
        >
          <FileText
            size={16}
            strokeWidth={2}
            className={
              isDropdownOpen ? 'text-teal-700 dark:text-cyan-400' : 'text-on-surface-variant'
            }
          />
          <span className="text-[11px] font-bold tracking-[0.15em] uppercase">
            AERODROME CHARTS
          </span>
          {isLocked ? (
            <Lock size={14} strokeWidth={2} className="ml-auto text-on-surface-variant shrink-0" />
          ) : isLoading ? (
            <div className="ml-auto w-3.5 h-3.5 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
          ) : (
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className={`ml-auto transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-teal-700 dark:text-cyan-400' : 'text-on-surface-variant'}`}
            />
          )}
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="aip-dropdown-menu mt-2 w-80 max-h-[35vh] aip-scrollbar"
            >
              <div className="py-1.5">
                {charts.length === 0 ? (
                  <div className="text-on-surface-variant text-[11px] font-medium tracking-wide py-4 px-4 text-center">
                    No charts available
                  </div>
                ) : (
                  charts.map((chart, idx) => (
                    <button
                      key={chart.chart_id}
                      onClick={() => {
                        handleChartClick(chart);
                      }}
                      className={`aip-dropdown-item ${
                        idx !== charts.length - 1 ? 'border-b border-outline-variant' : ''
                      }`}
                    >
                      <span className="aip-dropdown-item-title">
                        {chart.chart_title || chart.chart_index}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── PDF Modal ────────────────────────────────────── */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-zinc-950/98 backdrop-blur-md flex flex-col items-center justify-center"
            >
              <div className="relative w-full h-full overflow-hidden bg-zinc-950 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing">
                {/* 1. FLOATING CLOSE BUTTON (Top-Right) */}
                <button
                  onClick={handleModalClose}
                  aria-label="Close chart"
                  className="absolute top-6 right-6 z-[60] w-11 h-11 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors backdrop-blur-xl shadow-2xl"
                >
                  <span className="text-xl font-light">✕</span>
                </button>

                {/* 2. FLOATING ZOOM CONTROLS (Top-Left) */}
                <div className="absolute top-6 left-6 z-50 flex flex-col gap-2">
                  <div className="flex flex-col bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl">
                    <button
                      onClick={() => {
                        setPdfScale((s) => Math.min(4, s + 0.2));
                      }}
                      aria-label="Zoom in"
                      className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border-b border-zinc-800/50"
                    >
                      <ZoomIn size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setPdfScale((s) => Math.max(0.5, s - 0.2));
                      }}
                      aria-label="Zoom out"
                      className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      <ZoomOut size={18} />
                    </button>
                  </div>
                  <div className="px-3 py-1.5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-2xl text-center">
                    <span className="text-[10px] font-bold text-zinc-400 tracking-widest tabular-nums">
                      {Math.round(pdfScale * 100)}%
                    </span>
                  </div>
                </div>

                {/* 3a. View in 3D (procedure-linked charts only) */}
                {matchedRnpForModal ? (
                  <div className="aip-view-3d-container">
                    <button type="button" onClick={handleViewIn3D} className="aip-view-3d-button">
                      View in 3D space
                    </button>
                  </div>
                ) : null}

                {/* 3. FLOATING PAGINATION (Bottom-Center) */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
                  <div className="flex items-center gap-1 p-1 bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl">
                    <button
                      onClick={() => {
                        setCurrentPage((p) => Math.max(1, p - 1));
                      }}
                      disabled={currentPage <= 1}
                      aria-label="Previous page"
                      className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="px-4 min-w-[80px] text-center">
                      <span className="text-xs font-bold text-zinc-200 tracking-[0.2em] tabular-nums">
                        {numPages > 0 ? `${currentPage} / ${numPages}` : '--'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setCurrentPage((p) => Math.min(numPages, p + 1));
                      }}
                      disabled={currentPage >= numPages}
                      aria-label="Next page"
                      className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                {/* PDF RENDER AREA with WHEEL ZOOM and DRAG PAN */}
                <div
                  className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-950"
                  onWheel={(e) => {
                    const delta = e.deltaY;
                    setPdfScale((s) => {
                      const newScale = delta > 0 ? s - 0.1 : s + 0.1;
                      return Math.min(4, Math.max(0.5, newScale));
                    });
                  }}
                >
                  {pdfUrl && (
                    <motion.div
                      drag
                      dragMomentum={false}
                      animate={{ scale: pdfScale }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="relative cursor-inherit"
                    >
                      <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        className="shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
                        loading={
                          <div className="flex flex-col items-center justify-center gap-3 py-20">
                            <div className="w-8 h-8 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
                            <span className="text-zinc-500 text-xs font-medium tracking-widest uppercase">
                              Loading Document...
                            </span>
                          </div>
                        }
                      >
                        <Page
                          pageNumber={currentPage}
                          scale={1} // We use motion's scale instead for better perf
                          className="rounded-sm overflow-hidden"
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          loading={
                            <div className="flex items-center justify-center py-20">
                              <div className="w-6 h-6 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
                            </div>
                          }
                        />
                      </Document>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
