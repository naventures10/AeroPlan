import type { ObjectColumnDef } from '../sectionConfig';
import { extractDisplayValue } from '../sectionConfig';
import { sanitizeHtml } from '../../../utils/sanitize';

interface ObjectRendererProps {
  data: any;
  columnConfig?: ObjectColumnDef[];
}

/**
 * Renders AIP data_type: "object" sections as a styled key-value table.
 * Matches the AIP document structure: | Ref | Description | Data |
 *
 * If columnConfig is provided, uses official AIP labels and ordering.
 * Otherwise falls back to auto-generating from object keys.
 */
export default function ObjectRenderer({ data, columnConfig }: ObjectRendererProps) {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return (
      <div className="text-zinc-500 text-sm font-medium tracking-wide py-8 text-center">
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-zinc-400 bg-zinc-900/80 border-b border-zinc-700/50 w-12">
              Ref
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-zinc-400 bg-zinc-900/80 border-b border-zinc-700/50 w-1/3">
              Description
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-zinc-400 bg-zinc-900/80 border-b border-zinc-700/50">
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
                className={`border-b border-zinc-800/40 transition-colors hover:bg-zinc-800/30 ${
                  row.ref % 2 === 0 ? 'bg-transparent' : 'bg-zinc-900/20'
                }`}
              >
                <td className="px-4 py-3 text-zinc-500 text-[13px] font-mono font-bold align-top">
                  {row.ref}
                </td>
                <td className="px-4 py-3 text-zinc-300 text-[13px] font-medium leading-relaxed align-top">
                  {row.label}
                </td>
                <td
                  className="px-4 py-3 text-zinc-200 text-[13px] leading-relaxed align-top"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
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
