import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, ModalContent, ModalBody, useDisclosure } from '@heroui/react';
import { FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface ChartItem {
  chart_id: number;
  chart_title: string;
  chart_index: string;
  chart_url: string;
}

interface AerodromeChartViewerProps {
  icaoCode: string | null;
}

export default function AerodromeChartViewer({ icaoCode }: AerodromeChartViewerProps) {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [selectedChart, setSelectedChart] = useState<ChartItem | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch charts when icaoCode changes
  useEffect(() => {
    if (!icaoCode) {
      setCharts([]);
      return;
    }

    setIsLoading(true);
    fetch(`/api/aerodromes/${icaoCode}/charts`)
      .then((res) => res.json())
      .then((data) => {
        const chartList = Array.isArray(data) ? data : [];
        setCharts(chartList);
      })
      .catch((err) => {
        console.error('Failed to fetch aerodrome charts:', err);
        setCharts([]);
      })
      .finally(() => {
        setIsLoading(false);
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
  const pdfUrl = selectedChart
    ? `/api/proxy-pdf?url=${encodeURIComponent(selectedChart.chart_url)}`
    : '';

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
            className="relative flex items-center gap-2"
          >
            {/* Scroll Left */}
            {charts.length > 3 && (
              <button
                onClick={() => {
                  scroll('left');
                }}
                className="shrink-0 w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors backdrop-blur-xl"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            {/* Cards Container */}
            <div
              className="relative rounded-2xl overflow-hidden border border-zinc-700/40 shadow-2xl"
              style={{
                background: 'rgba(9, 9, 11, 0.65)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
            >
              {/* Title bar */}
              <div className="px-4 pt-2 pb-0.5">
                <span className="text-[9px] font-bold tracking-[0.25em] text-zinc-500 uppercase">
                  Aerodrome Charts
                </span>
              </div>

              <div
                ref={scrollRef}
                className="flex gap-2.5 px-4 pb-2.5 pt-0.5 overflow-x-auto chart-scroll"
                style={{ maxWidth: '820px' }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center w-full py-6 px-8">
                    <div className="w-5 h-5 border-2 border-zinc-700 border-t-indigo-400 rounded-full animate-spin" />
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
                      className="group shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl border border-zinc-800/50 hover:border-indigo-500/40 bg-zinc-900/40 hover:bg-indigo-500/10 transition-all duration-200 cursor-pointer w-[82px]"
                      title={chart.chart_title}
                    >
                      {/* Chart Icon */}
                      <div className="w-10 h-11 rounded-lg bg-gradient-to-br from-teal-400/20 to-cyan-500/20 border border-teal-500/30 group-hover:border-teal-400/50 flex items-center justify-center transition-colors">
                        <FileText
                          size={18}
                          className="text-teal-400 group-hover:text-teal-300 transition-colors"
                        />
                      </div>
                      {/* Title */}
                      <span className="text-[8px] font-bold text-zinc-500 group-hover:text-zinc-200 text-center leading-tight tracking-wider uppercase line-clamp-1 transition-colors w-full">
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
                className="shrink-0 w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors backdrop-blur-xl"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PDF Modal ────────────────────────────────────── */}
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        size="full"
        scrollBehavior="inside"
        backdrop="blur"
        classNames={{
          base: 'bg-zinc-950/98 border-none shadow-none m-0 rounded-none',
          body: 'p-0 h-screen w-screen overflow-hidden',
          closeButton: 'hidden', // We'll use our own floating close button
        }}
      >
        <ModalContent>
          <ModalBody className="relative bg-zinc-950 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing">
            {/* 1. FLOATING CLOSE BUTTON (Top-Right) */}
            <button
              onClick={handleModalClose}
              className="absolute top-6 right-6 z-[60] w-11 h-11 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:text-white transition-all backdrop-blur-xl shadow-2xl"
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

            {/* 3. FLOATING PAGINATION (Bottom-Center) */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
              <div className="flex items-center gap-1 p-1 bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl">
                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={currentPage <= 1}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
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
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
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
                  style={{ cursor: 'inherit' }}
                  className="relative"
                >
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
                    loading={
                      <div className="flex flex-col items-center justify-center gap-3 py-20">
                        <div className="w-8 h-8 border-2 border-zinc-700 border-t-teal-400 rounded-full animate-spin" />
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
                          <div className="w-6 h-6 border-2 border-zinc-700 border-t-teal-400 rounded-full animate-spin" />
                        </div>
                      }
                    />
                  </Document>
                </motion.div>
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
