import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FileText, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './MobileAerodromeChartViewer.css';

import { useMapStore } from '../../../store/useMapStore';
import { normalizeChartKey } from '../../../utils/chartKey';
import { fetchCharts, fetchRnpProcedures, getProxyPdfUrl } from '../../../api/client';
import type { ChartItem, RnpProcedureApi } from '../../../types';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface MobileAerodromeChartViewerProps {
  icaoCode: string | null;
}

function candidateChartKeys(chart: ChartItem): string[] {
  const raw = [chart.chart_url, chart.chart_title, chart.chart_index];
  const keys = raw.map((s) => normalizeChartKey(s ?? '')).filter(Boolean);
  return [...new Set(keys)];
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

export default function MobileAerodromeChartViewer({ icaoCode }: MobileAerodromeChartViewerProps) {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [rnpProcedures, setRnpProcedures] = useState<RnpProcedureApi[]>([]);
  const [selectedChart, setSelectedChart] = useState<ChartItem | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(0.9);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const dragControls = useDragControls();

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

  const handleChartClick = useCallback((chart: ChartItem) => {
    setSelectedChart(chart);
    setCurrentPage(1);
    setNumPages(0);
    setPdfScale(0.9);
    setIsDrawerOpen(false);
    setIsModalOpen(true);
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedChart(null);
    setNumPages(0);
    setCurrentPage(1);
  }, []);

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

  const pdfUrl = selectedChart ? getProxyPdfUrl(selectedChart.chart_url!) : '';

  if (!icaoCode) return null;

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        className="aip-mobile-trigger flex items-center gap-2 px-3.5 py-1.5 focus:outline-none"
      >
        <FileText size={14} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
        <span className="text-[11px] font-black tracking-[0.12em] uppercase whitespace-nowrap">
          AERO CHARTS
        </span>
        {isLoading ? (
          <div className="w-3.5 h-3.5 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin shrink-0" />
        ) : (
          <ChevronDown size={12} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
        )}
      </button>

      {/* Chart List Drawer */}
      {createPortal(
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="mobile-charts-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="aip-mobile-charts-backdrop"
              />

              {/* Drawer */}
              <motion.div
                key="mobile-charts-drawer"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.95 }}
                onDragEnd={(_e, info) => {
                  if (info.offset.y > 100 || info.velocity.y > 300) {
                    setIsDrawerOpen(false);
                  }
                }}
                className="aip-mobile-charts-drawer"
              >
                {/* Drag handle */}
                <div
                  className="aip-mobile-charts-drag-zone"
                  onPointerDown={(e) => dragControls.start(e)}
                  style={{ touchAction: 'none' }}
                >
                  <div className="aip-mobile-charts-drag-handle" />
                </div>

                {/* Header */}
                <div className="aip-mobile-charts-header">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-accent-cyan" />
                    <h2 className="text-lg font-bold text-on-surface">Aerodrome Charts</h2>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="aip-mobile-charts-close-btn"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* List */}
                <div className="aip-mobile-charts-content aip-scrollbar">
                  <div className="aip-mobile-charts-grid">
                    {charts.length === 0 ? (
                      <div className="text-on-surface-variant text-[13px] font-medium tracking-wide py-8 text-center">
                        No charts available
                      </div>
                    ) : (
                      charts.map((chart) => (
                        <button
                          key={chart.chart_id}
                          onClick={() => handleChartClick(chart)}
                          className="aip-mobile-charts-item"
                        >
                          <span className="aip-mobile-charts-item-title">
                            {chart.chart_title || chart.chart_index}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Fullscreen PDF Modal */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[200] bg-zinc-950/98 backdrop-blur-md flex flex-col items-center justify-center"
            >
              <div className="relative w-full h-full overflow-hidden bg-zinc-950 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing">
                {/* Close Button */}
                <button
                  onClick={handleModalClose}
                  aria-label="Close chart"
                  className="absolute top-4 right-4 z-[210] w-12 h-12 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors backdrop-blur-xl shadow-2xl"
                >
                  <span className="text-2xl font-light">✕</span>
                </button>

                {/* Zoom Controls */}
                <div className="absolute top-4 left-4 z-[210] flex flex-col gap-2">
                  <div className="flex flex-col bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl">
                    <button
                      onClick={() => setPdfScale((s) => Math.min(4, s + 0.2))}
                      aria-label="Zoom in"
                      className="p-3.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border-b border-zinc-800/50"
                    >
                      <ZoomIn size={20} />
                    </button>
                    <button
                      onClick={() => setPdfScale((s) => Math.max(0.5, s - 0.2))}
                      aria-label="Zoom out"
                      className="p-3.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      <ZoomOut size={20} />
                    </button>
                  </div>
                  <div className="px-3 py-1 bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-2xl text-center">
                    <span className="text-[10px] font-bold text-zinc-400 tracking-widest tabular-nums">
                      {Math.round(pdfScale * 100)}%
                    </span>
                  </div>
                </div>

                {/* View in 3D */}
                {matchedRnpForModal ? (
                  <div className="aip-mobile-view-3d-container">
                    <button
                      type="button"
                      onClick={handleViewIn3D}
                      className="aip-mobile-view-3d-button"
                    >
                      View in 3D
                    </button>
                  </div>
                ) : null}

                {/* Pagination (Bottom-Center) */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[210]">
                  <div className="flex items-center gap-2 p-1.5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      aria-label="Previous page"
                      className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <div className="px-4 min-w-[70px] text-center">
                      <span className="text-xs font-bold text-zinc-200 tracking-[0.2em] tabular-nums">
                        {numPages > 0 ? `${currentPage}/${numPages}` : '--'}
                      </span>
                    </div>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                      disabled={currentPage >= numPages}
                      aria-label="Next page"
                      className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={22} />
                    </button>
                  </div>
                </div>

                {/* PDF rendering with drag & wheel zoom */}
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
                        className="shadow-2xl"
                        loading={
                          <div className="flex flex-col items-center justify-center gap-3 py-20">
                            <div className="w-8 h-8 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
                            <span className="text-zinc-500 text-xs font-medium tracking-widest uppercase">
                              Loading Chart...
                            </span>
                          </div>
                        }
                      >
                        <Page
                          pageNumber={currentPage}
                          scale={1}
                          className="rounded-sm overflow-hidden"
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          width={window.innerWidth * 0.95}
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
