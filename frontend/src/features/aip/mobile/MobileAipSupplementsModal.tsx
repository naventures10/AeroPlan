import { useState, useEffect, useCallback, memo } from 'react';
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
  }, [setOpen]);

  const handleBackToList = () => {
    setSelectedPdfUrl(null);
    setNumPages(0);
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
                  <div className="aip-mobile-pdf-render-area aip-scrollbar">
                    <motion.div
                      animate={{ scale: pdfScale }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="relative origin-top"
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
                    </motion.div>
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
