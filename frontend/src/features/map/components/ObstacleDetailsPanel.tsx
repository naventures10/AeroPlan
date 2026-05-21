import { useMapStore } from '../../../store/useMapStore';

export function ObstacleDetailsPanel({ data }: { data: any }) {
  const activeAerodromeMetadata = useMapStore((s) => s.activeAerodromeMetadata);
  const p = data.properties || data;
  const name = p.name || p.feature_name || 'FEATURE';
  const category = p.category || p.feature_category || 'UNKNOWN';

  const elev = p.height ?? p.elevation_m ?? p.elevation ?? null;
  const elevNum = elev != null ? Number(elev) : null;
  const elevFt = elevNum != null && !Number.isNaN(elevNum) ? elevNum * 3.28084 : null;
  const elevStr = elevFt != null ? elevFt.toFixed(1) + ' FT' : 'N/A';

  let extraInfo = null;

  if (activeAerodromeMetadata) {
    const docs = activeAerodromeMetadata.data || activeAerodromeMetadata;
    if (category === 'OBSTACLE' && Array.isArray(docs.obstacles)) {
      let bestObs = null;
      if (elev != null) {
        const targetElevM = parseFloat(elev);
        bestObs = docs.obstacles.find((o: any) => {
          const nameMatch = o.obstacle_type === name || name.includes(o.obstacle_type);
          if (!nameMatch || !o.elevation) return false;

          const docElevMatch = o.elevation.match(/(\d+(?:\.\d+)?)/);
          if (docElevMatch) {
            const docElevRaw = parseFloat(docElevMatch[1]);
            const docElevM = o.elevation.toUpperCase().includes('FT')
              ? docElevRaw / 3.28084
              : docElevRaw;

            return Math.abs(docElevM - targetElevM) < 2.0;
          }
          return false;
        });
      }

      const obs =
        bestObs ||
        docs.obstacles.find((o: any) => o.obstacle_type === name || name.includes(o.obstacle_type));

      if (obs) {
        extraInfo = obs;
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <span className="text-xs text-default-500 font-semibold tracking-wider">ELEVATION</span>
        <span className="text-sm text-on-surface font-mono">{elevStr}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-default-500 font-semibold tracking-wider">CATEGORY</span>
        <span className="text-sm text-on-surface">{category}</span>
      </div>

      {extraInfo && (
        <>
          <div className="flex flex-col">
            <span className="text-xs text-default-500 font-semibold tracking-wider">
              AREA AFFECTED
            </span>
            <span className="text-sm text-on-surface">{extraInfo.area_affected || 'N/A'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-default-500 font-semibold tracking-wider">
              LGT / MARKING
            </span>
            <span className="text-sm text-on-surface">{extraInfo.marking_lgt || 'N/A'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-default-500 font-semibold tracking-wider">REMARKS</span>
            <span className="text-sm text-on-surface">{extraInfo.remarks || 'N/A'}</span>
          </div>
        </>
      )}
    </div>
  );
}
