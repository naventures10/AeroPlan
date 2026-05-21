import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

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
  return [...new Set(keys)];
}

function findRnpForChart(
  chart: ChartItem,
  byChartKey: Map<string, RnpProcedureApi>,
): RnpProcedureApi | null {
  for (const k of candidateChartKeys(chart)) {
    const hit = byChartKey.get(k);
    if (hit) return hit;
  }
  return null;
}

export default function AerodromeChartViewer({ icaoCode }: AerodromeChartViewerProps) {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [rnpProcedures, setRnpProcedures] = useState<RnpProcedureApi[]>([]);
  const [selectedChart, setSelectedChart] = useState<ChartItem | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setViewMode = useMapStore((s) => s.setViewMode);
  const setSelectedRnpProcedure = useMapStore((s) => s.setSelectedRnpProcedure);
  const fitBounds = useMapStore((s) => s.fitBounds);

  const rnpByChartKey = useMemo(() => {
    const m = new Map<string, RnpProcedureApi>();
    for (const p of rnpProcedures) {
      if (!m.has(p.chart_key)) m.set(p.chart_key, p);
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
        setCharts(data);
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
      onOpen();
    },
    [onOpen],
  );

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
  }, []);

  const handleModalClose = useCallback(() => {
    onClose();
    setSelectedChart(null);
    setNumPages(0);
    setCurrentPage(1);
  }, [onClose]);

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

  // Scroll left/right in the carousel
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  // Use proxy URL directly for on-demand fetching via react-pdf
  const pdfUrl = selectedChart ? getProxyPdfUrl(selectedChart.chart_url!) : '';

  if (!icaoCode) return null;

  return (
    <>
      {/* ── Carousel Container ────────────────────────────── */}
      <AnimatePresence>
        {icaoCode && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            data-testid="chart-carousel"
            className="relative flex items-center gap-2"
          >
            {/* Scroll Left */}
            {charts.length > 3 && (
              <button
                onClick={() => {
                  scroll('left');
                }}
                className="shrink-0 w-8 h-8 rounded-full bg-surface-container-high/60 hover:bg-slate-300/60 dark:hover:bg-zinc-700/60 border border-outline/40 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors backdrop-blur-xl"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            {/* Cards Container */}
            <div className="relative rounded-2xl overflow-hidden border border-outline/40 shadow-2xl glass-morphism">
              {/* Title bar */}
              <div className="px-4 pt-2 pb-0.5">
                <span className="text-[9px] font-bold tracking-[0.25em] text-on-surface-variant uppercase">
                  Aerodrome Charts
                </span>
              </div>

              <div
                ref={scrollRef}
                className="flex gap-2.5 px-4 pb-2.5 pt-0.5 overflow-x-auto chart-scroll max-w-[820px]"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center w-full py-6 px-8">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                ) : charts.length === 0 ? (
                  <div className="text-zinc-500 text-[11px] font-medium tracking-wide py-4 px-6 whitespace-nowrap">
                    No charts available
                  </div>
                ) : (
                  charts.map((chart, idx) => (
                    <motion.button
                      key={chart.chart_id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05, duration: 0.2 }}
                      onClick={() => {
                        handleChartClick(chart);
                      }}
                      className="group shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl border border-outline/40 ] hover:border-teal-500/40 dark:hover:border-cyan-500/40 bg-surface-container/50 ] hover:bg-teal-500/10 dark:hover:bg-cyan-500/10 transition-colors duration-200 cursor-pointer w-[82px]"
                      title={chart.chart_title || undefined}
                    >
                      {/* Chart Icon */}
                      <div className="w-10 h-11 rounded-lg bg-surface-container-high/50 ] border border-outline/50 ] group-hover:border-teal-500/40 dark:group-hover:border-cyan-500/40 flex items-center justify-center transition-colors">
                        <FileText
                          size={18}
                          className="text-teal-600 dark:text-cyan-400 group-hover:text-teal-500 dark:group-hover:text-cyan-300 transition-colors"
                        />
                      </div>
                      {/* Title */}
                      <span className="text-[8px] font-bold text-on-surface-variant group-hover:text-on-surface dark:group-hover:text-zinc-200 text-center leading-tight tracking-wider uppercase line-clamp-1 transition-colors w-full">
                        {chart.chart_title || chart.chart_index}
                      </span>
                    </motion.button>
                  ))
                )}
              </div>
            </div>

            {/* Scroll Right */}
            {charts.length > 3 && (
              <button
                onClick={() => {
                  scroll('right');
                }}
                className="shrink-0 w-8 h-8 rounded-full bg-surface-container-high/60 hover:bg-slate-300/60 dark:hover:bg-zinc-700/60 border border-outline/40 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors backdrop-blur-xl"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PDF Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
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
                    className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border-b border-zinc-800/50"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setPdfScale((s) => Math.max(0.5, s - 0.2));
                    }}
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
      </AnimatePresence>
    </>
  );
}
