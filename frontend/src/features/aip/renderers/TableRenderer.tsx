import { useState, useEffect, useRef } from 'react';
import type { ArrayColumnDef } from '../sectionConfig';
import { extractDisplayValue } from '../sectionConfig';
import { sanitizeHtml } from '../../../utils/sanitize';

interface TableRendererProps {
  data: any;
  columnConfig?: ArrayColumnDef[];
}

/**
 * Column width map based on data keys to ensure wide tables stay readable.
 */
const MIN_WIDTHS: Record<string, string> = {
  designation: '80px',
  designator: '80px',
  true_bearing: '140px',
  dimensions: '140px',
  coordinates: '280px',
  thr_elevation: '200px',
  remarks: '350px',
  Remarks: '350px',
  obstacle_type: '180px',
  marking_lgt: '160px',
  area_affected: '180px',
};

/**
 * Renders AIP data_type:"array"sections as styled HTML tables.
 *
 * Includes Horizontal Scroll optimization:
 * - Sticky Top Headers: Always visible while scrolling long tables.
 * - Sticky Left Identifier: The first column (Runway ID) stays fixed while scrolling horizontally.
 * - Min-Width Strategy: Prevents wide tables (AD 2.12) from squashing text.
 */
export default function TableRenderer({ data, columnConfig }: TableRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showRightIndicator, setShowRightIndicator] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const checkScroll = () => {
      // If the content is wider than the container, and we haven't scrolled all the way to the right
      const canScrollRight = el.scrollWidth > el.clientWidth + el.scrollLeft + 10;
      setShowRightIndicator(canScrollRight);
    };

    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [data]);

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-on-surface-variant text-sm font-medium tracking-wide py-8 text-center">
        NO DATA AVAILABLE
      </div>
    );
  }

  // Determine columns: use config if provided, else auto-generate from first row keys
  const columns: { key: string; header: string }[] = columnConfig
    ? columnConfig.map((c) => ({ key: c.key, header: c.header }))
    : Object.keys(data[0]).map((key) => ({
        key,
        header: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      }));

  return (
    <div className="relative w-full">
      <div ref={containerRef} className="relative overflow-auto aip-scrollbar max-h-[70vh]">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-30">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-on-surface-variant border-b border-outline-variant whitespace-nowrap bg-[var(--surface-container-high)] ${
                    idx === 0
                      ? 'sticky left-0 z-40 shadow-[2px_0_5px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.3)]'
                      : ''
                  }`}
                  style={{ minWidth: MIN_WIDTHS[col.key] || '140px' }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, rowIdx: number) => (
              <tr
                key={rowIdx}
                className={`transition-colors hover:bg-[var(--surface-container)] ${
                  rowIdx % 2 === 0 ? 'bg-[var(--surface-container-lowest)]' : 'bg-transparent'
                }`}
              >
                {columns.map((col, idx) => {
                  const cellValue = extractDisplayValue(row[col.key]);
                  const isSticky = idx === 0;

                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-on-surface text-[13px] leading-relaxed align-top border-b border-outline-variant ${
                        isSticky
                          ? 'sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.3)]'
                          : ''
                      } ${
                        isSticky && rowIdx % 2 === 0
                          ? 'bg-[var(--surface-container-lowest)]'
                          : isSticky
                            ? 'bg-[var(--surface)]'
                            : ''
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(
                          cellValue
                            .replace(/\\n/g, '<br/>')
                            .replace(/\n/g, '<br/>')
                            .replace(/\s*\|\s*/g, '<br/>'),
                        ),
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showRightIndicator && (
        <div
          className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-20"
          style={{
            background:
              'linear-gradient(270deg, var(--surface-container-high) 0%, transparent 100%)',
            opacity: 0.8,
          }}
        />
      )}
    </div>
  );
}
