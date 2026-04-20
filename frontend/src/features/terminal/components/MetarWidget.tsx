import { motion } from 'framer-motion';
import { CloudRain } from 'lucide-react';
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
      <h3 className="text-xl font-black text-white tracking-widest mb-4 flex items-center gap-2">
        <CloudRain className="text-cyan-400" /> LATEST METAR
      </h3>
      <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/50 grow">
        {weather?.metar ? (
          <p className="text-lg text-emerald-400 font-mono leading-relaxed">{weather.metar}</p>
        ) : (
          <p className="text-zinc-500 italic">No METAR data available.</p>
        )}
        {weather?.fetched_at && (
          <p className="text-xs text-zinc-600 font-mono mt-6">
            Fetched (UTC): {new Date(weather.fetched_at).toISOString()}
          </p>
        )}
      </div>
    </motion.div>
  );
}
