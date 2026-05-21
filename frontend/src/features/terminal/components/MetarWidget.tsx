import { motion } from 'framer-motion';
import type { WeatherData } from '../../../types';

interface MetarWidgetProps {
  weather: WeatherData | null;
}

export function MetarWidget({ weather }: MetarWidgetProps) {
  return (
    <motion.div
      key="metar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full gap-4"
    >
      <h3 className="text-[9px] font-black tracking-[0.25em] text-on-surface-variant uppercase mb-4">
        Latest METAR
      </h3>
      <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant ] ] grow">
        {weather?.metar ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-mono leading-relaxed tracking-wide">
            {weather.metar}
          </p>
        ) : (
          <p className="text-on-surface-variant italic text-sm">No METAR data available.</p>
        )}
        {weather?.fetched_at && (
          <p className="text-[10px] text-on-surface-variant font-mono mt-4">
            Fetched (UTC): {new Date(weather.fetched_at).toISOString()}
          </p>
        )}
      </div>
    </motion.div>
  );
}
