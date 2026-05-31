import { LabelVal } from './SharedLabel';

/**
 * Helper to format coordinate strings into readable blocks.
 * eAIP coordinates often look like"123456N 1234567E"
 */
function formatAipText(text: any): React.ReactNode {
  if (typeof text !== 'string') return text;

  // Split by common coordinate separators or long strings
  // We look for patterns like 123456N 0123456E
  const parts = text.split(/(?=\d{6}[NS]\s\d{7}[EW])|(?=Beginning of)|(?=-then)/g);

  return (
    <div className="flex flex-col gap-1">
      {parts.map((p, i) => (
        <span key={i} className="block leading-relaxed">
          {p.trim()}
        </span>
      ))}
    </div>
  );
}

export function AirspaceDetailsPanel({ data }: { data: any }) {
  if (!data) return null;
  const p = data;

  // Derive correct type from identification (overrides DB misclassifications)
  let displayType = (p.airspace_type || 'AIRSPACE').toUpperCase();
  const ident = (p.identification || p.name || '').toUpperCase();
  if (/\bTSA\d*/.test(ident)) displayType = 'TSA';
  else if (/\bTRA\d*/.test(ident)) displayType = 'TRA';

  // Clean name by stripping coordinate junk after pipe separator
  const cleanName = p.name ? p.name.split('|')[0].trim() : 'Unnamed Airspace';

  return (
    <div className="flex flex-col gap-4 px-1 py-1">
      {/* Header */}
      <div className="flex flex-col border-b border-outline-variant pb-2">
        <span className="text-[10px] font-black text-teal-700 dark:text-cyan-400 tracking-[0.2em] uppercase">
          {displayType.replace(/_/g, ' ')}
        </span>
        <span className="text-sm font-bold text-on-surface mt-0.5 leading-tight">{cleanName}</span>
      </div>

      {/* Grid Specs */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <LabelVal label="Identification" val={p.identification} />
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Vertical Limits
          </span>
          <span className="text-xs text-on-surface font-medium">
            {p.lower_limit || 'SFC'} — {p.upper_limit || 'UNL'}
          </span>
        </div>
      </div>

      {/* Complex Text Fields */}
      <div className="flex flex-col gap-4">
        {p.remarks && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              Remarks
            </span>
            <div className="text-xs text-on-surface-variant leading-relaxed italic whitespace-pre-wrap">
              {p.remarks}
            </div>
          </div>
        )}

        {p.lateral_limits && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider border-t border-outline-variant pt-2">
              Lateral Limits
            </span>
            <div className="text-[11px] text-on-surface-variant font-mono border-outline-variant p-2 rounded border overflow-hidden break-words">
              {formatAipText(p.lateral_limits)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
