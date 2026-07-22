import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

import { useMapStore } from '../../../store/useMapStore';
import { fetchAipSupplements, getProxyPdfUrl } from '../../../api/client';
import type { AipSupplement } from '../../../types';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { isFeatureLocked } from '../../../config/featureFlags';
import './MobileAipSupplementsModal.css';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const MobileAipSupplementsModal = memo(function MobileAipSupplementsModal() {
  const isOpen = useMapStore((s) => s.isAipSupplementsModalOpen);
  const setOpen = useMapStore((s) => s.setAipSupplementsModalOpen);
  const setIsPdfViewerOpen = useMapStore((s) => s.setIsPdfViewerOpen);

  const [supplements, setSupplements] = useState<AipSupplement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // PDF Viewer State
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

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

  // Signal global store when PDF viewer is active to pause background 3D WebGL map
  useEffect(() => {
    const isViewing = isOpen && Boolean(selectedPdfUrl);
    setIsPdfViewerOpen(isViewing);
    return () => {
      setIsPdfViewerOpen(false);
    };
  }, [isOpen, selectedPdfUrl, setIsPdfViewerOpen]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchAipSupplements()
        .then((data) => setSupplements(data))
        .catch((err) => console.error('Failed to fetch supplements', err))
        .finally(() => setIsLoading(false));
    } else {
      // Reset state when closed
      setSelectedPdfUrl(null);
      setNumPages(0);
      setPdfScale(1.0);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const onClose = useCallback(() => {
    setOpen(false);
    setSelectedPdfUrl(null);
    setPdfScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setIsPdfViewerOpen(false);
  }, [setOpen, setIsPdfViewerOpen]);

  // Handle ESC
  useEscapeKey(isOpen, onClose);

  const handlePdfClick = (pdfLink: string) => {
    setSelectedPdfUrl(getProxyPdfUrl(pdfLink));
    setNumPages(0);
    setPdfScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleDoubleTap = useCallback(
    (clientX: number, clientY: number) => {
      if (pdfScale > 1.2) {
        setPdfScale(1.0);
        setPanOffset({ x: 0, y: 0 });
      } else {
        const scale = 2.0;
        const r = scale / pdfScale;
        const Vcx = window.innerWidth / 2;
        const Vcy = window.innerHeight / 2;
        const dx = clientX - Vcx;
        const dy = clientY - Vcy;
        const targetX = panOffset.x - dx * (r - 1);
        const targetY = panOffset.y - dy * (r - 1);

        setPdfScale(scale);
        setPanOffset({ x: targetX, y: targetY });
      }
    },
    [pdfScale, panOffset],
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
          setPanOffset({ x: targetX, y: targetY });
        }
      } else if (isDraggingRef.current && e.touches.length === 1) {
        const touch = e.touches[0];
        if (!touch) return;
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;
        setPanOffset({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
      }
    },
    [pdfScale],
  );

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    isPinchingRef.current = false;
    pinchStartDistRef.current = 0;
  }, []);

  if (isFeatureLocked('aip-supplements')) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {selectedPdfUrl ? (
            /* 100% Fullscreen Edge-to-Edge PDF Viewer (z-index 500 covers toolbars, no title box) */
            <motion.div
              key="mobile-supps-pdf-fullscreen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[500] w-screen h-screen bg-zinc-950 flex flex-col overflow-hidden select-none"
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              {/* Minimal Floating Close Button */}
              <button
                onClick={() => setSelectedPdfUrl(null)}
                aria-label="Close modal"
                className="absolute top-4 right-4 z-[510] w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-white backdrop-blur-xl shadow-2xl transition-colors shrink-0"
              >
                <X size={20} />
              </button>

              {/* Edge-to-Edge Touch Pinch & Multi-Page Scroll */}
              <div
                className="w-full h-full flex items-center justify-center overflow-auto bg-zinc-950"
                style={{ touchAction: 'none' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <motion.div
                  animate={{ scale: pdfScale, x: panOffset.x, y: panOffset.y }}
                  transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                  className="relative w-full flex flex-col items-center justify-start py-4"
                >
                  <Document
                    file={selectedPdfUrl}
                    onLoadSuccess={({ numPages: total }) => setNumPages(total)}
                    loading={
                      <div className="flex flex-col items-center justify-center gap-3 py-20">
                        <div className="w-8 h-8 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
                        <span className="text-zinc-500 text-xs font-medium tracking-widest uppercase">
                          Loading Supplement...
                        </span>
                      </div>
                    }
                  >
                    <div className="flex flex-col items-center gap-4">
                      {Array.from(new Array(numPages), (_, index) => (
                        <Page
                          key={`supp_page_${index + 1}`}
                          pageNumber={index + 1}
                          width={window.innerWidth}
                          devicePixelRatio={Math.min(window.devicePixelRatio || 2, 2.5)}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          className="shadow-2xl"
                        />
                      ))}
                    </div>
                  </Document>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            /* Standard Supplements List Drawer */
            <>
              <motion.div
                key="mobile-supps-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="aip-mobile-supps-backdrop"
              />

              <motion.div
                key="mobile-supps-drawer"
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
                  if (info.offset.y > 120 || info.velocity.y > 350) {
                    onClose();
                  }
                }}
                className="aip-mobile-supps-drawer"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                {/* Drag Zone */}
                <div
                  className="aip-mobile-supps-drag-zone"
                  onPointerDown={(e) => dragControls.start(e)}
                  style={{ touchAction: 'none' }}
                >
                  <div className="aip-mobile-supps-drag-handle" />
                </div>

                {/* Drawer Header */}
                <div className="aip-mobile-supps-header flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="aip-mobile-supps-title-group flex items-center gap-2 overflow-hidden">
                    <FileText
                      className="aip-mobile-supps-title-icon text-cyan-400 shrink-0"
                      size={18}
                    />
                    <h2 className="aip-mobile-supps-title text-base font-bold text-zinc-100 truncate">
                      AIP Supplements
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="aip-mobile-supps-close-btn w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white shrink-0"
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content Body */}
                <div className="aip-mobile-supps-content aip-scrollbar w-full h-full overflow-y-auto">
                  {isLoading ? (
                    <div className="aip-mobile-supps-loading">
                      <div className="aip-mobile-supps-spinner" />
                      <span>Fetching Supplements...</span>
                    </div>
                  ) : supplements.length === 0 ? (
                    <div className="aip-mobile-supps-empty">
                      <span>No AIP supplements found.</span>
                    </div>
                  ) : (
                    <div className="aip-mobile-supps-grid">
                      {supplements.map((item, idx) => (
                        <div
                          key={`${item.supplement_number}-${idx}`}
                          className="aip-mobile-supp-card"
                        >
                          <div className="aip-mobile-supp-header">
                            <span className="aip-mobile-supp-number">{item.supplement_number}</span>
                            <span className="aip-mobile-supp-date">{item.effective_date}</span>
                          </div>
                          <h3 className="aip-mobile-supp-title">{item.title}</h3>
                          {item.remarks && (
                            <p className="aip-mobile-supp-remarks">{item.remarks}</p>
                          )}
                          {item.pdf_link && (
                            <div className="aip-mobile-supp-actions">
                              <button
                                onClick={() => handlePdfClick(item.pdf_link)}
                                className="aip-mobile-supp-pdf-btn"
                              >
                                <FileText size={14} />
                                <span>View PDF</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
});
