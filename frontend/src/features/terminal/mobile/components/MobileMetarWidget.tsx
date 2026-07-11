import { motion } from 'framer-motion';
import type { WeatherData } from '../../../../types';

interface MobileMetarWidgetProps {
  weather: WeatherData | null;
}

export function MobileMetarWidget({ weather }: MobileMetarWidgetProps) {
  return (
    <motion.div
      key="mobile-metar"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-3"
    >
      <h3 className="text-[10px] font-black tracking-[0.2em] text-on-surface-variant uppercase mb-2">
        Latest METAR
      </h3>
      <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant">
        {weather?.metar ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono leading-relaxed tracking-wide select-all break-words">
            {weather.metar}
          </p>
        ) : (
          <p className="text-on-surface-variant italic text-xs">No METAR data available.</p>
        )}
        {weather?.fetched_at && (
          <p className="text-[9px] text-on-surface-variant font-mono mt-3">
            Fetched (UTC): {new Date(weather.fetched_at).toISOString()}
          </p>
        )}
      </div>
    </motion.div>
  );
}
