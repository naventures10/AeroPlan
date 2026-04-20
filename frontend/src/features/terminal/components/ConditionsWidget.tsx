import { motion } from 'framer-motion';
import {
  Wind,
  Eye,
  Cloud,
  Thermometer,
  CloudFog,
  Compass,
  Sunrise,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import type { ParsedMetar, DaylightRecord } from '../../../types';

interface ConditionsWidgetProps {
  icaoCode: string;
  parsedMetar: ParsedMetar;
  daylight: DaylightRecord | null;
  todayStr: string;
}

export function ConditionsWidget({
  icaoCode,
  parsedMetar,
  daylight,
  todayStr,
}: ConditionsWidgetProps) {
  return (
    <motion.div
      key="conditions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-5"
    >
      <div className="flex justify-between items-end mb-1">
        <div>
          <h2 className="text-2xl font-black text-white tracking-widest">{icaoCode}</h2>
          <p className="text-zinc-500 text-[10px] tracking-[0.2em] uppercase mt-1">
            Current Conditions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* WIDGET: WIND */}
        <div className="col-span-12 md:col-span-6 bg-zinc-950/60 rounded-2xl p-5 border border-zinc-800/50 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <Wind className="text-cyan-400" size={20} />
            <span className="text-lg font-bold text-white">
              {parsedMetar.windDir ? `${parsedMetar.windDir}°T` : 'VRB'}{' '}
              {parsedMetar.windSpeed
                ? `${parsedMetar.windSpeed} ${parsedMetar.windUnit || 'kt'}`
                : '- kt'}
            </span>
          </div>

          <div className="flex justify-around items-center mt-4">
            <div className="relative w-20 h-20 rounded-full border border-zinc-700/50 flex items-center justify-center">
              <div className="absolute inset-1 border-2 border-dashed border-zinc-600 rounded-full"></div>
              {parsedMetar.windDir && parsedMetar.windDir !== 'VRB' && (
                <div
                  className="absolute origin-center w-1 h-full flex flex-col items-center justify-start py-1"
                  style={{ transform: `rotate(${parsedMetar.windDir}deg)` }}
                >
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                </div>
              )}
              <span className="font-bold text-base text-white">
                {parsedMetar.windDir === 'VRB'
                  ? 'VRB'
                  : parsedMetar.windDir
                    ? `${parsedMetar.windDir}°`
                    : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* WIDGET: VISIBILITY & CLOUDS */}
        <div className="col-span-12 md:col-span-6 flex flex-col gap-5">
          <div className="bg-zinc-950/60 rounded-2xl p-5 border border-zinc-800/50">
            <div className="flex items-center gap-3 mb-3">
              <Eye className="text-cyan-400" size={20} />
              <span className="text-lg font-bold text-white">{parsedMetar.visibility || '-'}</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              {parsedMetar.visibility && (
                <div
                  className="bg-cyan-400 h-full shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                  style={{
                    width: parsedMetar.visibility.includes('>')
                      ? '100%'
                      : `${Math.min((parseInt(parsedMetar.visibility) / 10000) * 100, 100)}%`,
                  }}
                />
              )}
            </div>
          </div>

          <div className="bg-zinc-950/60 rounded-2xl p-5 border border-zinc-800/50 flex items-center gap-4">
            <Cloud className="text-cyan-400" size={24} />
            <div className="flex flex-col">
              {parsedMetar.clouds.map((c: string, i: number) => (
                <span key={i} className="text-sm font-semibold text-white">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* WIDGET: TEMP & DEWPOINT */}
        <div className="col-span-6 md:col-span-3 bg-zinc-950/60 rounded-2xl p-4 border border-zinc-800/50 flex flex-col items-center">
          <Thermometer className="text-cyan-400 mb-1" size={18} />
          <div className="text-xl font-bold text-white">
            {parsedMetar.temp !== null ? `${parsedMetar.temp}°C` : '-'}
          </div>
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
            Temp
          </span>
        </div>

        <div className="col-span-6 md:col-span-3 bg-zinc-950/60 rounded-2xl p-4 border border-zinc-800/50 flex flex-col items-center">
          <CloudFog className="text-cyan-400 mb-1" size={18} />
          <div className="text-xl font-bold text-white">
            {parsedMetar.dew !== null ? `${parsedMetar.dew}°C` : '-'}
          </div>
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
            Dew
          </span>
        </div>

        {/* WIDGET: QNH */}
        <div className="col-span-12 md:col-span-6 bg-zinc-950/60 rounded-2xl p-4 border border-zinc-800/50 flex flex-col items-center justify-center">
          <Compass className="text-cyan-400 mb-1" size={20} />
          <div className="text-2xl font-black text-white">
            {parsedMetar.qnh !== null ? `${parsedMetar.qnh} hPa` : '-'}
          </div>
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
            QNH Pressure
          </span>
        </div>

        {/* WIDGET: DAYLIGHT TABLES */}
        <div className="col-span-12 bg-zinc-950/60 rounded-2xl p-5 border border-zinc-800/50">
          <div className="flex justify-between mb-4">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              Daylight Information
            </span>
            <span className="text-[10px] text-zinc-500 font-bold tracking-widest tabular-nums">
              {todayStr}
            </span>
          </div>

          <div className="flex justify-between items-center px-2">
            <div className="flex flex-col items-center gap-1.5">
              <Sunrise size={22} className="text-amber-400" />
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                MCT
              </span>
              <span className="text-base font-bold text-white tabular-nums">
                {daylight?.twilight_from || '-'}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Sun size={22} className="text-amber-500" />
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                Sunrise
              </span>
              <span className="text-base font-bold text-white tabular-nums">
                {daylight?.sunrise || '-'}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Sunset size={22} className="text-orange-500" />
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                Sunset
              </span>
              <span className="text-base font-bold text-white tabular-nums">
                {daylight?.sunset || '-'}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Moon size={22} className="text-indigo-400" />
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                ECT
              </span>
              <span className="text-base font-bold text-white tabular-nums">
                {daylight?.twilight_to || '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
