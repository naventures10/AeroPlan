import type { ArrayColumnDef } from '../sectionConfig';
import { extractDisplayValue } from '../sectionConfig';

interface TableRendererProps {
  data: any;
  columnConfig?: ArrayColumnDef[];
}

/**
 * Renders AIP data_type: "array" sections as styled HTML tables.
 * 
 * If columnConfig is provided, uses the official AIP headers and
 * renders columns in the specified order.
 * Otherwise falls back to auto-generating headers from object keys.
 */
export default function TableRenderer({ data, columnConfig }: TableRendererProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-zinc-500 text-sm font-medium tracking-wide py-8 text-center">
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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-zinc-400 bg-zinc-900/80 border-b border-zinc-700/50 whitespace-nowrap"
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
              className={`border-b border-zinc-800/40 transition-colors hover:bg-zinc-800/30 ${
                rowIdx % 2 === 0 ? 'bg-zinc-900/20' : 'bg-transparent'
              }`}
            >
              {columns.map((col) => {
                const cellValue = extractDisplayValue(row[col.key]);
                return (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-zinc-200 text-[13px] leading-relaxed align-top"
                    dangerouslySetInnerHTML={{
                      __html: cellValue
                        .replace(/\\n/g, '<br/>')
                        .replace(/\n/g, '<br/>')
                        .replace(/\s*\|\s*/g, '<br/>'),
                    }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
