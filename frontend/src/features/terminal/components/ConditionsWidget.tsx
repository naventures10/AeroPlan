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

// Shared card label style
const sectionLabel = 'text-[9px] font-black tracking-[0.25em] text-zinc-500 uppercase block mb-3';

// Shared card surface class
const cardBase = 'bg-white/[0.03] rounded-2xl p-4 border border-white/[0.05]';

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
      {/* Header */}
      <div className="flex justify-between items-end mb-1">
        <div>
          <h2 className="text-2xl font-black text-white tracking-widest">{icaoCode}</h2>
          <p className="text-zinc-500 text-[10px] tracking-[0.2em] uppercase mt-1">
            Current Conditions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* ── WIND ─────────────────────────────────────── */}
        <div className={`col-span-12 md:col-span-6 ${cardBase}`}>
          <span className={sectionLabel}>Wind</span>
          <div className="flex items-center justify-between gap-4">
            {/* Values */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Wind className="text-cyan-400 shrink-0" size={16} />
                <span className="text-xl font-black text-white">
                  {parsedMetar.windDir ? `${parsedMetar.windDir}°T` : 'VRB'}
                </span>
              </div>
              <span className="text-3xl font-black text-white leading-none">
                {parsedMetar.windSpeed ?? '–'}
                <span className="text-sm font-medium text-zinc-400 ml-1.5">
                  {parsedMetar.windUnit || 'kt'}
                </span>
              </span>
            </div>

            {/* Compact compass */}
            <div className="relative w-[72px] h-[72px] rounded-full border border-zinc-700/50 flex items-center justify-center shrink-0">
              <div className="absolute inset-1.5 border border-dashed border-zinc-700/60 rounded-full" />
              {parsedMetar.windDir && parsedMetar.windDir !== 'VRB' && (
                <div
                  className="absolute origin-center w-1 h-full flex flex-col items-center justify-start py-1.5"
                  style={{ transform: `rotate(${parsedMetar.windDir}deg)` }}
                >
                  <div className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                </div>
              )}
              <span className="text-[11px] font-bold text-white z-10">
                {parsedMetar.windDir === 'VRB'
                  ? 'VRB'
                  : parsedMetar.windDir
                    ? `${parsedMetar.windDir}°`
                    : '–'}
              </span>
            </div>
          </div>
        </div>

        {/* ── VISIBILITY + CLOUDS (right column) ───────── */}
        <div className="col-span-12 md:col-span-6 flex flex-col gap-3">
          {/* Visibility */}
          <div className={cardBase}>
            <span className={sectionLabel}>Visibility</span>
            <div className="flex items-center gap-2 mb-2.5">
              <Eye className="text-cyan-400 shrink-0" size={16} />
              <span className="text-xl font-bold text-white">{parsedMetar.visibility || '–'}</span>
            </div>
            <div className="w-full bg-white/[0.06] h-1 rounded-full overflow-hidden">
              {parsedMetar.visibility && (
                <div
                  className="bg-cyan-400 h-full shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                  style={{
                    width: parsedMetar.visibility.includes('>')
                      ? '100%'
                      : `${Math.min((parseInt(parsedMetar.visibility) / 10000) * 100, 100)}%`,
                  }}
                />
              )}
            </div>
          </div>

          {/* Cloud Cover */}
          <div className={cardBase}>
            <span className={sectionLabel}>Cloud Cover</span>
            <div className="flex items-start gap-3">
              <Cloud className="text-cyan-400 mt-0.5 shrink-0" size={16} />
              <div className="flex flex-col gap-0.5">
                {parsedMetar.clouds.length > 0 ? (
                  parsedMetar.clouds.map((c: string, i: number) => (
                    <span key={i} className="text-sm font-semibold text-white leading-snug">
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-zinc-500 italic">No cloud data</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW: equal thirds ──────────────────── */}

        {/* Temperature */}
        <div className={`col-span-4 ${cardBase} flex flex-col items-center`}>
          <span className={sectionLabel + ' text-center'}>Temp</span>
          <Thermometer className="text-cyan-400 mb-1.5" size={18} />
          <div className="text-2xl font-black text-white">
            {parsedMetar.temp !== null ? `${parsedMetar.temp}°C` : '–'}
          </div>
        </div>

        {/* Dew Point */}
        <div className={`col-span-4 ${cardBase} flex flex-col items-center`}>
          <span className={sectionLabel + ' text-center'}>Dew Pt</span>
          <CloudFog className="text-cyan-400 mb-1.5" size={18} />
          <div className="text-2xl font-black text-white">
            {parsedMetar.dew !== null ? `${parsedMetar.dew}°C` : '–'}
          </div>
        </div>

        {/* QNH */}
        <div className={`col-span-4 ${cardBase} flex flex-col items-center`}>
          <span className={sectionLabel + ' text-center'}>QNH</span>
          <Compass className="text-cyan-400 mb-1.5" size={18} />
          <div className="text-2xl font-black text-white">
            {parsedMetar.qnh !== null ? `${parsedMetar.qnh}` : '–'}
          </div>
          <span className="text-[9px] text-zinc-500 font-bold tracking-widest mt-0.5">hPa</span>
        </div>

        {/* ── DAYLIGHT ──────────────────────────────────── */}
        <div className={`col-span-12 ${cardBase}`}>
          <div className="flex justify-between items-center mb-4">
            <span className={sectionLabel + ' mb-0'}>Daylight</span>
            <span className="text-[10px] text-zinc-500 font-mono tracking-widest tabular-nums">
              {todayStr}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              {
                icon: Sunrise,
                color: 'text-amber-400',
                label: 'MCT',
                value: daylight?.twilight_from,
              },
              { icon: Sun, color: 'text-amber-500', label: 'Sunrise', value: daylight?.sunrise },
              { icon: Sunset, color: 'text-orange-500', label: 'Sunset', value: daylight?.sunset },
              { icon: Moon, color: 'text-indigo-400', label: 'ECT', value: daylight?.twilight_to },
            ].map(({ icon: Icon, color, label, value }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]"
              >
                <Icon size={18} className={color} />
                <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">
                  {label}
                </span>
                <span className="text-sm font-bold text-white tabular-nums">{value || '–'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
