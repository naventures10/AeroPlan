import type { ObjectColumnDef } from '../sectionConfig';
import { extractDisplayValue } from '../sectionConfig';
import { sanitizeHtml } from '../../../utils/sanitize';
import { useIsMobile } from '../../../hooks/useIsMobile';

interface ObjectRendererProps {
  data: any;
  columnConfig?: ObjectColumnDef[];
}

/**
 * Renders AIP data_type:"object" sections as a styled key-value table.
 * Matches the AIP document structure: | Ref | Description | Data |
 *
 * If columnConfig is provided, uses official AIP labels and ordering.
 * Otherwise falls back to auto-generating from object keys.
 */
export default function ObjectRenderer({ data, columnConfig }: ObjectRendererProps) {
  const isMobile = useIsMobile();

  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return (
      <div className="text-on-surface-variant text-sm font-medium tracking-wide py-8 text-center">
        NO DATA AVAILABLE
      </div>
    );
  }

  // Build the row list: use config ordering if provided, else fall back to object keys
  const rows: { ref: number; label: string; value: any }[] = [];

  if (columnConfig) {
    // Use config-defined order and labels
    columnConfig.forEach((col, idx) => {
      const value = data[col.key];
      // Only render if the key exists in the data
      if (value !== undefined) {
        rows.push({ ref: idx + 1, label: col.label, value });
      }
    });

    // Also include any data keys NOT in the config (catch-all for extra data)
    const configKeys = new Set(columnConfig.map((c) => c.key));
    Object.entries(data).forEach(([key, value]) => {
      if (!configKeys.has(key)) {
        rows.push({
          ref: rows.length + 1,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          value,
        });
      }
    });
  } else {
    // Fallback: auto-generate from object keys
    Object.entries(data).forEach(([key, value], idx) => {
      rows.push({
        ref: idx + 1,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value,
      });
    });
  }

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3.5 p-1">
        {rows.map((row) => {
          const displayValue = extractDisplayValue(row.value);
          return (
            <div
              key={row.ref}
              className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest/50 backdrop-blur-sm flex flex-col gap-2"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-[11px] font-mono font-bold text-accent-cyan bg-accent-cyan-opacity-10 px-1.5 py-0.5 rounded border border-accent-cyan-glow/30 flex-shrink-0">
                  {row.ref}
                </span>
                <span className="text-[12px] font-semibold text-on-surface-variant leading-snug">
                  {row.label}
                </span>
              </div>
              <div
                className="text-[13px] text-on-surface leading-relaxed whitespace-pre-wrap break-words border-t border-outline-variant/30 pt-2.5 mt-0.5"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(
                    displayValue
                      .replace(/\\n/g, '<br/>')
                      .replace(/\n/g, '<br/>')
                      .replace(/\s*\|\s*/g, '<br/>'),
                  ),
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-on-surface-variant border-b border-outline-variant w-12">
              Ref
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-on-surface-variant border-b border-outline-variant w-1/3">
              Description
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-on-surface-variant border-b border-outline-variant">
              Data
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const displayValue = extractDisplayValue(row.value);
            return (
              <tr
                key={row.ref}
                className={`border-b border-outline-variant transition-colors hover:bg-surface-container-high/50 dark:hover:bg-zinc-800/30 ${
                  row.ref % 2 === 0 ? 'bg-transparent' : 'bg-surface/50'
                }`}
              >
                <td className="px-4 py-3 text-on-surface-variant text-[13px] font-mono font-bold align-top">
                  {row.ref}
                </td>
                <td className="px-4 py-3 text-on-surface-variant text-[13px] font-medium leading-relaxed align-top">
                  {row.label}
                </td>
                <td
                  className="px-4 py-3 text-on-surface text-[13px] leading-relaxed align-top whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(
                      displayValue
                        .replace(/\\n/g, '<br/>')
                        .replace(/\n/g, '<br/>')
                        .replace(/\s*\|\s*/g, '<br/>'),
                    ),
                  }}
                />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
