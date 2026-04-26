import TableRenderer from './TableRenderer';
import ObjectRenderer from './ObjectRenderer';
import { sanitizeHtml } from '../../../utils/sanitize';

interface HybridRendererProps {
  data: any;
}

/**
 * Checks if data is an array of typed blocks: [{type: "paragraph"|"table", content: ...}, ...]
 */
function isTypedBlockArray(data: any): boolean {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (item: any) => item && typeof item === 'object' && 'type' in item && 'content' in item,
    )
  );
}

/**
 * Renders a 2D array as a proper HTML table.
 * First row is treated as headers.
 */
function RawTableRenderer({ rows }: { rows: any[][] }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <div className="text-zinc-500 text-sm py-4 text-center">NO DATA</div>;
  }

  const headers = rows[0];
  const body = rows.slice(1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers?.map((h: any, i: number) => (
              <th
                key={i}
                className="text-left px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-zinc-400 bg-zinc-900/80 border-b border-zinc-700/50 whitespace-nowrap"
              >
                {String(h ?? '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row: any[], rowIdx: number) => (
            <tr
              key={rowIdx}
              className={`border-b border-zinc-800/40 transition-colors hover:bg-zinc-800/30 ${
                rowIdx % 2 === 0 ? 'bg-zinc-900/20' : 'bg-transparent'
              }`}
            >
              {row.map((cell: any, cellIdx: number) => (
                <td
                  key={cellIdx}
                  className="px-4 py-3 text-zinc-200 text-[13px] leading-relaxed align-top"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(
                      String(cell ?? '—')
                        .replace(/\\n/g, '<br/>')
                        .replace(/\n/g, '<br/>'),
                    ),
                  }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders AIP data_type: "hybrid" sections (local regulations, flight procedures, etc.).
 * Handles multiple data shapes:
 *   1. Array of typed blocks: [{type: "paragraph", content: "..."}, {type: "table", content: [[...]]}]
 *   2. Plain string → text block
 *   3. Plain array of objects → TableRenderer
 *   4. Object with mixed values → sub-renderers per key
 */
export default function HybridRenderer({ data }: HybridRendererProps) {
  // Null / undefined / empty
  if (data === null || data === undefined) {
    return (
      <div className="text-zinc-500 text-sm font-medium tracking-wide py-8 text-center">NIL</div>
    );
  }

  // Plain string → render as formatted text
  if (typeof data === 'string') {
    if (!data.trim() || data.trim().toUpperCase() === 'NIL') {
      return (
        <div className="text-zinc-500 text-sm font-medium tracking-wide py-8 text-center">NIL</div>
      );
    }

    return (
      <div className="px-4 py-4 space-y-3">
        {data.split(/\n+/).map((paragraph: string, idx: number) => (
          <p key={idx} className="text-zinc-200 text-[13px] leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  // Array handling
  if (Array.isArray(data)) {
    // Pattern 1: Array of typed blocks [{type, content}, ...]
    if (isTypedBlockArray(data)) {
      return (
        <div className="space-y-4">
          {data.map((block: any, idx: number) => {
            const blockType = String(block.type).toLowerCase();
            const content = block.content;

            if (blockType === 'table') {
              // content is a 2D array: [[header1, header2, ...], [row1col1, ...], ...]
              if (Array.isArray(content) && content.length > 0 && Array.isArray(content[0])) {
                return <RawTableRenderer key={idx} rows={content} />;
              }
              // content is array of objects → use standard TableRenderer
              if (
                Array.isArray(content) &&
                content.length > 0 &&
                typeof content[0] === 'object' &&
                !Array.isArray(content[0])
              ) {
                return <TableRenderer key={idx} data={content} />;
              }
              // Fallback: render as text
              return (
                <div key={idx} className="px-4 py-3 text-zinc-200 text-[13px] leading-relaxed">
                  {typeof content === 'string' ? content : JSON.stringify(content)}
                </div>
              );
            }

            if (blockType === 'paragraph' || blockType === 'text') {
              const text = typeof content === 'string' ? content : String(content ?? '');
              if (!text.trim() || text.trim().toUpperCase() === 'NIL') return null;
              return (
                <div key={idx} className="px-4 py-3">
                  {text.split(/\n+/).map((p: string, i: number) => (
                    <p key={i} className="text-zinc-200 text-[13px] leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              );
            }

            // Unknown block type → render as text
            return (
              <div key={idx} className="px-4 py-3 text-zinc-300 text-[13px]">
                {typeof content === 'string' ? content : JSON.stringify(content)}
              </div>
            );
          })}
        </div>
      );
    }

    // Pattern 2: Array of objects → standard table
    return <TableRenderer data={data} />;
  }

  // Object with mixed values
  if (typeof data === 'object') {
    const entries = Object.entries(data);

    // Check if all values are scalar → treat as object
    const allScalar = entries.every(([, v]) => typeof v !== 'object' || v === null);
    if (allScalar) {
      return <ObjectRenderer data={data} />;
    }

    // Mixed: render each key-value, using appropriate sub-renderer
    return (
      <div className="space-y-6">
        {entries.map(([key, value]) => {
          const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <div key={key}>
              <h4 className="text-[11px] font-bold tracking-widest uppercase text-zinc-400 px-4 py-2 bg-zinc-900/40 border-b border-zinc-800/40">
                {formattedKey}
              </h4>
              {typeof value === 'string' ? (
                <div className="px-4 py-3">
                  {value.split(/\n+/).map((p: string, i: number) => (
                    <p key={i} className="text-zinc-200 text-[13px] leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              ) : Array.isArray(value) ? (
                // Check if it's a typed block array within a key
                isTypedBlockArray(value) ? (
                  <HybridRenderer data={value} />
                ) : (
                  <TableRenderer data={value} />
                )
              ) : typeof value === 'object' && value !== null ? (
                <ObjectRenderer data={value} />
              ) : (
                <div className="px-4 py-3 text-zinc-200 text-[13px]">{String(value ?? 'NIL')}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback for primitives
  return <div className="px-4 py-4 text-zinc-200 text-[13px]">{String(data)}</div>;
}
