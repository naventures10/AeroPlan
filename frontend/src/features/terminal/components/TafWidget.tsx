import { motion } from 'framer-motion';
import type { WeatherData } from '../../../types';

interface TafWidgetProps {
  weather: WeatherData | null;
}

export function TafWidget({ weather }: TafWidgetProps) {
  return (
    <motion.div
      key="taf"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full gap-4"
    >
      <h3 className="text-[9px] font-black tracking-[0.25em] text-on-surface-variant uppercase mb-4">
        Latest TAF
      </h3>
      <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant grow overflow-y-auto">
        {weather?.taf && weather.taf.length > 0 ? (
          weather.taf.map((tGroup: string[], i: number) => (
            <div
              key={i}
              className="mb-5 last:mb-0 pb-5 last:pb-0 border-b last:border-0 border-outline-variant"
            >
              {tGroup.map((line: string, j: number) => (
                <p
                  key={j}
                  className={`text-sm font-mono ${j === 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-on-surface-variant  ml-3'} mb-1`}
                >
                  {line}
                </p>
              ))}
            </div>
          ))
        ) : (
          <p className="text-on-surface-variant italic text-sm">No TAF data available.</p>
        )}
      </div>
    </motion.div>
  );
}
