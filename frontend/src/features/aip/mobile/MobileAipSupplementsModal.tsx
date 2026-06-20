import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, FileText, ZoomIn, ZoomOut, ArrowLeft } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { useMapStore } from '../../../store/useMapStore';
import { fetchAipSupplements, getProxyPdfUrl } from '../../../api/client';
import type { AipSupplement } from '../../../types';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import './MobileAipSupplementsModal.css';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const MobileAipSupplementsModal = memo(function MobileAipSupplementsModal() {
  const isOpen = useMapStore((s) => s.isAipSupplementsModalOpen);
  const setOpen = useMapStore((s) => s.setAipSupplementsModalOpen);

  const [supplements, setSupplements] = useState<AipSupplement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // PDF Viewer State
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfScale, setPdfScale] = useState(0.8);
  const [loadError, setLoadError] = useState(false);

  const renderAreaRef = useRef<HTMLDivElement | null>(null);
  const isPinchingRef = useRef(false);
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(0.8);
  const pinchStartScrollLeftRef = useRef(0);
  const pinchStartScrollTopRef = useRef(0);
  const pinchStartChildLeftRef = useRef(0);
  const pinchStartChildTopRef = useRef(0);
  const pinchStartCenterRef = useRef({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef(0);

  const handleDoubleTap = useCallback(
    (clientX: number, clientY: number) => {
      const container = renderAreaRef.current;
      if (!container) return;

      if (pdfScale > 1.0) {
        setPdfScale(0.8);
        container.scrollLeft = 0;
        container.scrollTop = 0;
      } else {
        const scale = 1.8;
        const r = scale / pdfScale;
        const rect = container.getBoundingClientRect();
        const clickX = clientX - rect.left;
        const clickY = clientY - rect.top;

        const targetScrollLeft = (container.scrollLeft + clickX) * r - clickX;
        const targetScrollTop = (container.scrollTop + clickY) * r - clickY;

        setPdfScale(scale);
        requestAnimationFrame(() => {
          container.scrollLeft = targetScrollLeft;
          container.scrollTop = targetScrollTop;
        });
      }
    },
    [pdfScale],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const now = Date.now();
      const container = renderAreaRef.current;
      if (!container) return;

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
      } else if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        if (!touch1 || !touch2) return;

        const child = container.firstElementChild as HTMLElement;
        if (!child) return;

        isPinchingRef.current = true;
        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        pinchStartDistRef.current = dist;
        pinchStartScaleRef.current = pdfScale;
        pinchStartScrollLeftRef.current = container.scrollLeft;
        pinchStartScrollTopRef.current = container.scrollTop;

        const rect = container.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();

        pinchStartChildLeftRef.current = container.scrollLeft + (childRect.left - rect.left);
        pinchStartChildTopRef.current = container.scrollTop + (childRect.top - rect.top);

        pinchStartCenterRef.current = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };
      }
    },
    [pdfScale, handleDoubleTap],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const container = renderAreaRef.current;
    if (!container) return;

    if (isPinchingRef.current && e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      if (!touch1 || !touch2) return;

      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      if (pinchStartDistRef.current > 0) {
        const factor = dist / pinchStartDistRef.current;
        const scale = Math.min(3, Math.max(0.4, pinchStartScaleRef.current * factor));

        const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
        const currentCenterY = (touch1.clientY + touch2.clientY) / 2;

        const r = scale / pinchStartScaleRef.current;
        const rect = container.getBoundingClientRect();

        const touchXStart = pinchStartCenterRef.current.x - rect.left;
        const touchYStart = pinchStartCenterRef.current.y - rect.top;

        const touchXCurrent = currentCenterX - rect.left;
        const touchYCurrent = currentCenterY - rect.top;

        const touchXStart_child =
          pinchStartScrollLeftRef.current + touchXStart - pinchStartChildLeftRef.current;
        const touchYStart_child =
          pinchStartScrollTopRef.current + touchYStart - pinchStartChildTopRef.current;

        const child = container.firstElementChild as HTMLElement;
        if (!child) return;

        const baseWidth = child.offsetWidth;
        const childLeftNew = Math.max(0, (rect.width - baseWidth * scale) / 2);

        const targetScrollLeft = childLeftNew + touchXStart_child * r - touchXCurrent;
        const targetScrollTop =
          pinchStartChildTopRef.current + touchYStart_child * r - touchYCurrent;

        setPdfScale(scale);
        container.scrollLeft = targetScrollLeft;
        container.scrollTop = targetScrollTop;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isPinchingRef.current = false;
    pinchStartDistRef.current = 0;
  }, []);

  const dragControls = useDragControls();

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
    }
  }, [isOpen]);

  const onClose = useCallback(() => {
    setOpen(false);
    setPdfScale(0.8);
  }, [setOpen]);

  const handleBackToList = () => {
    setSelectedPdfUrl(null);
    setNumPages(0);
    setPdfScale(0.8);
  };

  // Handle ESC
  useEscapeKey(isOpen, onClose);

  const handlePdfClick = (pdfLink: string) => {
    setSelectedPdfUrl(getProxyPdfUrl(pdfLink));
    setNumPages(0);
    setPdfScale(0.8);
    setLoadError(false);
  };

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setLoadError(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setLoadError(true);
  }, []);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mobile-supps-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="aip-mobile-supps-backdrop"
          />

          {/* Drawer */}
          <motion.div
            key="mobile-supps-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag={selectedPdfUrl ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.95 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 120 || info.velocity.y > 350) {
                onClose();
              }
            }}
            className={`aip-mobile-supps-drawer ${selectedPdfUrl ? 'is-pdf' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Drag Zone (only active when not viewing PDF) */}
            {!selectedPdfUrl && (
              <div
                className="aip-mobile-supps-drag-zone"
                onPointerDown={(e) => dragControls.start(e)}
                style={{ touchAction: 'none' }}
              >
                <div className="aip-mobile-supps-drag-handle" />
              </div>
            )}

            {/* Header */}
            <div className="aip-mobile-supps-header">
              <div className="aip-mobile-supps-title-group">
                {selectedPdfUrl ? (
                  <button
                    onClick={handleBackToList}
                    className="aip-mobile-supps-close-btn mr-1"
                    aria-label="Back to supplements list"
                  >
                    <ArrowLeft size={20} />
                  </button>
                ) : (
                  <FileText className="aip-mobile-supps-title-icon" size={18} />
                )}
                <h2 className="aip-mobile-supps-title">
                  {selectedPdfUrl ? 'Supplement Document' : 'AIP Supplements'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="aip-mobile-supps-close-btn"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="aip-mobile-supps-content aip-scrollbar">
              {selectedPdfUrl ? (
                // PDF Viewer
                <div className="aip-mobile-pdf-view">
                  {/* Floating PDF Controls */}
                  <div className="aip-mobile-pdf-controls">
                    <button
                      onClick={() => setPdfScale((s) => Math.min(3, s + 0.15))}
                      className="aip-mobile-pdf-control-btn border-b"
                      aria-label="Zoom in"
                    >
                      <ZoomIn size={18} />
                    </button>
                    <button
                      onClick={() => setPdfScale((s) => Math.max(0.4, s - 0.15))}
                      className="aip-mobile-pdf-control-btn"
                      aria-label="Zoom out"
                    >
                      <ZoomOut size={18} />
                    </button>
                  </div>

                  {numPages === 0 && !loadError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-50 pointer-events-none">
                      <div className="aip-mobile-supps-spinner" />
                      <span className="aip-mobile-supps-status-text">Loading PDF...</span>
                    </div>
                  )}

                  {loadError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-50 pointer-events-none text-red-400">
                      <span>Failed to load PDF</span>
                    </div>
                  )}

                  {/* PDF Render Area */}
                  <div
                    ref={renderAreaRef}
                    className="aip-mobile-pdf-render-area aip-scrollbar"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onDoubleClick={(e) => handleDoubleTap(e.clientX, e.clientY)}
                  >
                    <div
                      style={{
                        transform: `scale(${pdfScale})`,
                        transformOrigin: 'top center',
                      }}
                      className="relative"
                    >
                      <Document
                        file={selectedPdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={<div />}
                      >
                        <div className="flex flex-col items-center gap-6">
                          {Array.from(new Array(numPages), (_, index) => (
                            <Page
                              key={`page_${index + 1}`}
                              pageNumber={index + 1}
                              scale={1}
                              className="aip-mobile-pdf-page shadow-lg"
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                              width={window.innerWidth * 0.9}
                            />
                          ))}
                        </div>
                      </Document>
                    </div>
                  </div>
                </div>
              ) : isLoading ? (
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
                    <div key={`${item.supplement_number}-${idx}`} className="aip-mobile-supp-card">
                      <div className="aip-mobile-supp-header">
                        <span className="aip-mobile-supp-number">{item.supplement_number}</span>
                        <span className="aip-mobile-supp-date">{item.effective_date}</span>
                      </div>
                      <h3 className="aip-mobile-supp-title">{item.title}</h3>
                      {item.remarks && <p className="aip-mobile-supp-remarks">{item.remarks}</p>}
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
    </AnimatePresence>,
    document.body,
  );
});
