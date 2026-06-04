import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { useMapStore } from '../../store/useMapStore';
import { fetchAipSupplements, getProxyPdfUrl } from '../../api/client';
import type { AipSupplement } from '../../types';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import './AipSupplementsModal.css';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function AipSupplementsModal() {
  const isOpen = useMapStore((s) => s.isAipSupplementsModalOpen);
  const setOpen = useMapStore((s) => s.setAipSupplementsModalOpen);

  const [supplements, setSupplements] = useState<AipSupplement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // PDF Viewer State
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfScale, setPdfScale] = useState(1.2);
  const [loadError, setLoadError] = useState(false);

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

  // Handle ESC
  useEscapeKey(isOpen, onClose);

  const handlePdfClick = (pdfLink: string) => {
    setSelectedPdfUrl(getProxyPdfUrl(pdfLink));
    setNumPages(0);
    setPdfScale(1.2);
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
        <motion.div
          key="aip-supplements-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center ${selectedPdfUrl ? 'p-0' : 'p-4'}`}
          onClick={onClose}
        >
          <motion.div
            key="aip-supplements-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={`aip-supplements-modal-container ${selectedPdfUrl ? 'is-pdf' : 'is-list'}`}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {!selectedPdfUrl && (
              <div className="aip-supplements-modal-header">
                <div className="aip-supplements-header-group">
                  <div className="aip-supplements-header-icon">
                    <FileText size={16} />
                  </div>
                  <h2 className="aip-supplements-header-title">AIP Supplements</h2>
                </div>
                <button onClick={onClose} className="aip-supplements-action-btn">
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="aip-supplements-body">
              {selectedPdfUrl ? (
                // PDF Viewer
                <div className="aip-supplements-pdf-view">
                  {/* Floating Zoom Controls */}
                  <div className="aip-supplements-pdf-controls">
                    <button
                      onClick={() => setPdfScale((s) => Math.min(4, s + 0.2))}
                      className="aip-supplements-pdf-control-btn border-b"
                    >
                      <ZoomIn size={18} />
                    </button>
                    <button
                      onClick={() => setPdfScale((s) => Math.max(0.5, s - 0.2))}
                      className="aip-supplements-pdf-control-btn"
                    >
                      <ZoomOut size={18} />
                    </button>
                  </div>

                  {numPages === 0 && !loadError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-50 pointer-events-none">
                      <div className="aip-supplements-spinner" />
                      <span className="aip-supplements-status-text">Loading PDF...</span>
                    </div>
                  )}

                  {loadError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-50 pointer-events-none text-red-400">
                      <span className="aip-supplements-status-text">Failed to load PDF</span>
                    </div>
                  )}

                  {/* PDF Render Area */}
                  <div
                    className="aip-supplements-pdf-render-area aip-scrollbar"
                    onWheel={(e) => {
                      if (e.ctrlKey) {
                        e.preventDefault();
                        const delta = e.deltaY;
                        setPdfScale((s) => {
                          const newScale = delta > 0 ? s - 0.1 : s + 0.1;
                          return Math.min(4, Math.max(0.5, newScale));
                        });
                      }
                    }}
                  >
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
                        <div className="flex flex-col items-center gap-8">
                          {Array.from(new Array(numPages), (_, index) => (
                            <Page
                              key={`page_${index + 1}`}
                              pageNumber={index + 1}
                              scale={1}
                              className="aip-supplements-pdf-page shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                            />
                          ))}
                        </div>
                      </Document>
                    </motion.div>
                  </div>
                </div>
              ) : (
                // Table View
                <div className="aip-supplements-list-view aip-scrollbar">
                  {isLoading ? (
                    <div className="aip-supplements-status">
                      <div className="aip-supplements-spinner" />
                      <span className="aip-supplements-status-text">Fetching Supplements...</span>
                    </div>
                  ) : supplements.length === 0 ? (
                    <div className="aip-supplements-status">
                      <span className="aip-supplements-status-text">No AIP supplements found.</span>
                    </div>
                  ) : (
                    <div className="aip-supplements-table-wrapper aip-scrollbar">
                      <table className="aip-supplements-table">
                        <thead>
                          <tr>
                            <th>S. No.</th>
                            <th>Title</th>
                            <th>Effective Date</th>
                            <th>Remarks</th>
                            <th className="col-actions">Document</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplements.map((item, idx) => (
                            <tr key={`${item.supplement_number}-${idx}`}>
                              <td>{item.supplement_number}</td>
                              <td className="col-title">{item.title}</td>
                              <td>{item.effective_date}</td>
                              <td>{item.remarks || '-'}</td>
                              <td className="col-actions">
                                {item.pdf_link && (
                                  <button
                                    onClick={() => handlePdfClick(item.pdf_link)}
                                    className="aip-supplements-pdf-btn"
                                  >
                                    <FileText size={14} />
                                    View PDF
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
