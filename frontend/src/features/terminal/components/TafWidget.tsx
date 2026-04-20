import { motion } from 'framer-motion';
import { CloudRain } from 'lucide-react';
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
      <h3 className="text-xl font-black text-white tracking-widest mb-4 flex items-center gap-2">
        <CloudRain className="text-cyan-400" /> LATEST TAF
      </h3>
      <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/50 grow overflow-y-auto">
        {weather?.taf && weather.taf.length > 0 ? (
          weather.taf.map((tGroup: string[], i: number) => (
            <div
              key={i}
              className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-0 border-zinc-800/50"
            >
              {tGroup.map((line: string, j: number) => (
                <p
                  key={j}
                  className={`text-md font-mono ${j === 0 ? 'text-amber-400 font-bold' : 'text-zinc-300 ml-4'} mb-1`}
                >
                  {line}
                </p>
              ))}
            </div>
          ))
        ) : (
          <p className="text-zinc-500 italic">No TAF data available.</p>
        )}
      </div>
    </motion.div>
  );
}
