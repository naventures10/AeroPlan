import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, ChevronDown, X, Lock } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import { isFeatureLocked } from '../../../config/featureFlags';
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

export default function MobileAerodromeChartViewer({ icaoCode }: MobileAerodromeChartViewerProps) {
  const isLocked = isFeatureLocked('aerodrome-charts');

  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [rnpProcedures, setRnpProcedures] = useState<RnpProcedureApi[]>([]);
  const [selectedChart, setSelectedChart] = useState<ChartItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Zoom & Pan state for edge-to-edge pinch-zoom viewer
  const [pdfScale, setPdfScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(
    null,
  );

  // Touch gesture refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const isPinchingRef = useRef(false);
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1.0);
  const pinchStartPanOffsetRef = useRef({ x: 0, y: 0 });
  const pinchStartCenterRef = useRef({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef(0);

  const dragControls = useDragControls();

  const setViewMode = useMapStore((s) => s.setViewMode);
  const setSelectedRnpProcedure = useMapStore((s) => s.setSelectedRnpProcedure);
  const fitBounds = useMapStore((s) => s.fitBounds);
  const setIsPdfViewerOpen = useMapStore((s) => s.setIsPdfViewerOpen);

  // Signal global store when modal is open to pause background 3D WebGL map
  useEffect(() => {
    setIsPdfViewerOpen(isModalOpen);
    return () => {
      setIsPdfViewerOpen(false);
    };
  }, [isModalOpen, setIsPdfViewerOpen]);

  const clampOffset = useCallback(
    (x: number, y: number, scale: number) => {
      const Wc = window.innerWidth;
      const Hc = window.innerHeight;

      const Wp = Wc;
      const Hp = pageDimensions ? Wp * (pageDimensions.height / pageDimensions.width) : Hc;

      const Wscaled = Wp * scale;
      const Hscaled = Hp * scale;

      let clampedX = x;
      let clampedY = y;

      if (Wscaled <= Wc) {
        clampedX = 0;
      } else {
        const maxDragX = (Wscaled - Wc) / 2;
        clampedX = Math.min(maxDragX, Math.max(-maxDragX, x));
      }

      if (Hscaled <= Hc) {
        clampedY = 0;
      } else {
        const maxDragY = (Hscaled - Hc) / 2;
        clampedY = Math.min(maxDragY, Math.max(-maxDragY, y));
      }

      return { x: clampedX, y: clampedY };
    },
    [pageDimensions],
  );

  const handleDoubleTap = useCallback(
    (clientX: number, clientY: number) => {
      if (pdfScale > 1.2) {
        setPdfScale(1.0);
        setPanOffset({ x: 0, y: 0 });
      } else {
        const scale = 2.2;
        const r = scale / pdfScale;
        const Vcx = window.innerWidth / 2;
        const Vcy = window.innerHeight / 2;
        const dx = clientX - Vcx;
        const dy = clientY - Vcy;
        const targetX = panOffset.x - dx * (r - 1);
        const targetY = panOffset.y - dy * (r - 1);

        setPdfScale(scale);
        setPanOffset(clampOffset(targetX, targetY, scale));
      }
    },
    [pdfScale, panOffset, clampOffset],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const now = Date.now();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (!touch) return;
        if (now - lastTouchTimeRef.current < 300) {
          e.preventDefault();
          handleDoubleTap(touch.clientX, touch.clientY);
          lastTouchTimeRef.current = 0;
          return;
        }
        lastTouchTimeRef.current = now;

        isDraggingRef.current = true;
        isPinchingRef.current = false;
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        panStartRef.current = { ...panOffset };
      } else if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        if (!touch1 || !touch2) return;
        isPinchingRef.current = true;
        isDraggingRef.current = false;
        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        pinchStartDistRef.current = dist;
        pinchStartScaleRef.current = pdfScale;
        pinchStartPanOffsetRef.current = { ...panOffset };
        pinchStartCenterRef.current = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };
      }
    },
    [panOffset, pdfScale, handleDoubleTap],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isPinchingRef.current && e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        if (!touch1 || !touch2) return;
        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        if (pinchStartDistRef.current > 0) {
          const factor = dist / pinchStartDistRef.current;
          const scale = Math.min(3.5, Math.max(0.8, pinchStartScaleRef.current * factor));

          const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
          const currentCenterY = (touch1.clientY + touch2.clientY) / 2;

          const r = scale / pinchStartScaleRef.current;
          const Vcx = window.innerWidth / 2;
          const Vcy = window.innerHeight / 2;

          const dx = pinchStartCenterRef.current.x - Vcx;
          const dy = pinchStartCenterRef.current.y - Vcy;

          const targetX =
            pinchStartPanOffsetRef.current.x -
            dx * (r - 1) +
            (currentCenterX - pinchStartCenterRef.current.x);
          const targetY =
            pinchStartPanOffsetRef.current.y -
            dy * (r - 1) +
            (currentCenterY - pinchStartCenterRef.current.y);

          setPdfScale(scale);
          setPanOffset(clampOffset(targetX, targetY, scale));
        }
      } else if (isDraggingRef.current && e.touches.length === 1) {
        const touch = e.touches[0];
        if (!touch) return;
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;
        const newX = panStartRef.current.x + dx;
        const newY = panStartRef.current.y + dy;
        setPanOffset(clampOffset(newX, newY, pdfScale));
      }
    },
    [pdfScale, clampOffset],
  );

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    isPinchingRef.current = false;
    pinchStartDistRef.current = 0;
  }, []);

  const rnpByChartKey = useMemo(() => {
    const m = new Map<string, RnpProcedureApi>();
    for (const p of rnpProcedures) {
      if (!m.has(p.chart_key)) m.set(p.chart_key, p);
    }
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
    setPdfScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setPageDimensions(null);
    setIsDrawerOpen(false);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedChart(null);
    setPdfScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setPageDimensions(null);
    setIsPdfViewerOpen(false);
  }, [setIsPdfViewerOpen]);

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
        onClick={() => {
          if (isLocked) return;
          setIsDrawerOpen(true);
        }}
        disabled={isLocked}
        className={`aip-mobile-trigger flex items-center gap-2 px-3.5 py-1.5 focus:outline-none${isLocked ? ' locked' : ''}`}
      >
        <FileText size={14} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
        <span className="text-[11px] font-black tracking-[0.12em] uppercase whitespace-nowrap">
          AERO CHARTS
        </span>
        {isLocked ? (
          <Lock size={12} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
        ) : isLoading ? (
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

      {/* 100% Fullscreen Edge-to-Edge PDF Viewer Modal */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[500] w-screen h-screen bg-zinc-950 flex flex-col overflow-hidden select-none"
            >
              {/* Floating Edge-to-Edge Header Bar */}
              <div className="absolute top-0 left-0 right-0 z-[220] flex items-center justify-between px-4 py-3 bg-zinc-950/85 backdrop-blur-md border-b border-white/10 shadow-lg">
                <div className="flex items-center gap-2 overflow-hidden pr-2">
                  <FileText size={16} className="text-cyan-400 shrink-0" />
                  <span className="text-xs font-bold text-zinc-100 tracking-wide truncate">
                    {selectedChart?.chart_title || selectedChart?.chart_index || 'Aerodrome Chart'}
                  </span>
                </div>
                <button
                  onClick={handleModalClose}
                  aria-label="Close chart"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* View in 3D Action Overlay */}
              {matchedRnpForModal ? (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[220]">
                  <button
                    type="button"
                    onClick={handleViewIn3D}
                    className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-black tracking-wider uppercase rounded-full shadow-2xl transition-all active:scale-95"
                  >
                    View in 3D
                  </button>
                </div>
              ) : null}

              {/* Edge-to-Edge Touch Pinch & Pan Canvas Render Area */}
              <div
                className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-950"
                style={{ touchAction: 'none' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {pdfUrl && (
                  <motion.div
                    animate={{ scale: pdfScale, x: panOffset.x, y: panOffset.y }}
                    transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                    className="relative w-full flex items-center justify-center"
                  >
                    <Document
                      file={pdfUrl}
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
                        pageNumber={1}
                        width={window.innerWidth}
                        devicePixelRatio={Math.min(window.devicePixelRatio || 2, 2.5)}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={(page) => {
                          setPageDimensions({ width: page.width, height: page.height });
                        }}
                        className="shadow-2xl"
                      />
                    </Document>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
