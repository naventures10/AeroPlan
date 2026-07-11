import { motion } from 'framer-motion';
import type { WeatherData } from '../../../../types';

interface MobileTafWidgetProps {
  weather: WeatherData | null;
}

export function MobileTafWidget({ weather }: MobileTafWidgetProps) {
  return (
    <motion.div
      key="mobile-taf"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-3"
    >
      <h3 className="text-[10px] font-black tracking-[0.2em] text-on-surface-variant uppercase mb-2">
        Latest TAF
      </h3>
      <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant max-h-[45vh] overflow-y-auto aip-scrollbar">
        {weather?.taf && weather.taf.length > 0 ? (
          weather.taf.map((tGroup: string[], i: number) => (
            <div
              key={i}
              className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-0 border-outline-variant"
            >
              {tGroup.map((line: string, j: number) => (
                <p
                  key={j}
                  className={`text-xs font-mono break-words ${j === 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-on-surface-variant ml-2'} mb-0.5`}
                >
                  {line}
                </p>
              ))}
            </div>
          ))
        ) : (
          <p className="text-on-surface-variant italic text-xs">No TAF data available.</p>
        )}
      </div>
    </motion.div>
  );
}
