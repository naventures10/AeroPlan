import { LabelVal } from './SharedLabel';
import { sanitizeAndSplitHtml } from '../../../utils/sanitize';

export function parseVerticalLimits(
  lowerLimit: string | null,
  upperLimit: string | null,
): { lower: string; upper: string } {
  const lower = lowerLimit?.trim() || '';
  const upper = upperLimit?.trim() || '';

  if ((!lower || lower === 'SFC') && upper && upper.includes('/')) {
    let cleanStr = upper.replace(/^(SFC|GND)\s*[-—]\s*/i, '').trim();
    cleanStr = cleanStr.replace(/\b\d{6}[NS]\s*\d{7}[EW]\b/g, '').trim();

    const parts = cleanStr.split('/');
    const firstPart = parts[0];
    const secondPart = parts[1];
    if (firstPart !== undefined && secondPart !== undefined) {
      // Strip leading non-alphanumeric characters (like bullets • or asterisks *)
      const uPart = firstPart.replace(/^[^a-zA-Z0-9]+/, '').trim();
      const lPart = secondPart.replace(/^[^a-zA-Z0-9]+/, '').trim();

      const limitRegex = /(UNL|GND|SFC|FL\s*\d+|\d+\s*FT\s*(?:AMSL|AGL|ASML)?)/i;
      const uMatch = uPart.match(limitRegex);
      const lMatch = lPart.match(limitRegex);

      if (uMatch && lMatch) {
        return {
          lower: lMatch[0].trim(),
          upper: uMatch[0].trim(),
        };
      }
    }
  }

  return {
    lower: lower || 'SFC',
    upper: upper || 'UNL',
  };
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

  // Split and sanitize complex fields
  const lateralLimitsParts = sanitizeAndSplitHtml(
    p.lateral_limits,
    /(?=\d{6}[NS]\s\d{7}[EW])|(?=Beginning of)|(?=-then)/g,
  );
  const remarksParts = sanitizeAndSplitHtml(p.remarks, '|');

  const { lower, upper } = parseVerticalLimits(p.lower_limit, p.upper_limit);

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
            {lower} — {upper}
          </span>
        </div>
      </div>

      {/* Complex Text Fields */}
      <div className="flex flex-col gap-4">
        {remarksParts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              Remarks
            </span>
            <div className="text-xs text-on-surface-variant leading-relaxed italic flex flex-col gap-2">
              {remarksParts.map((part, i) => (
                <span key={i} className="block" dangerouslySetInnerHTML={{ __html: part }} />
              ))}
            </div>
          </div>
        )}

        {lateralLimitsParts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider border-t border-outline-variant pt-2">
              Lateral Limits
            </span>
            <div className="text-[11px] text-on-surface-variant font-mono border-outline-variant p-2 rounded border overflow-hidden break-words flex flex-col gap-1">
              {lateralLimitsParts.map((part, i) => (
                <span
                  key={i}
                  className="block leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: part }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
