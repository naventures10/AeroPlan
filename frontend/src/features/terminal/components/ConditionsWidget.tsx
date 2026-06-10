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
import type { ParsedMetar, DaylightRecord, WeatherData } from '../../../types';

interface ConditionsWidgetProps {
  icaoCode: string;
  weather?: WeatherData | null;
  parsedMetar: ParsedMetar;
  daylight: DaylightRecord | null;
  todayStr: string;
}

// Shared card label style
const sectionLabel =
  'text-[9px] font-black tracking-[0.25em] text-on-surface-variant  uppercase block mb-3';

// Shared card surface class
const cardBase = 'bg-surface-container rounded-2xl p-4 border border-outline-variant';

function UnavailableCard({ icaoCode }: { icaoCode: string }) {
  return (
    <div className="col-span-12 bg-gradient-to-br from-surface-container/60 to-surface-container-high/60 rounded-2xl p-8 border border-outline-variant/50 flex flex-col items-center justify-center text-center min-h-[220px] backdrop-blur-md relative overflow-hidden group">
      {/* Subtle decorative background glow */}
      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-teal-500/10 dark:bg-cyan-500/10 blur-3xl pointer-events-none group-hover:bg-teal-500/15 dark:group-hover:bg-cyan-500/15 transition-colors duration-500" />
      <div className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full bg-amber-500/5 dark:bg-amber-500/5 blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100/50 dark:border-teal-900/30 mb-4 shadow-inner">
        <CloudFog className="text-teal-700 dark:text-cyan-400 animate-pulse" size={32} />
      </div>

      <h3 className="text-sm font-black tracking-widest text-on-surface uppercase mb-2">
        Weather Data Unavailable
      </h3>

      <p className="text-xs text-on-surface-variant max-w-[320px] leading-relaxed font-medium">
        No live METAR or observations are currently reported for{' '}
        <span className="text-teal-700 dark:text-cyan-400 font-bold">{icaoCode}</span>.
      </p>
    </div>
  );
}

function WindCard({ parsedMetar }: { parsedMetar: ParsedMetar }) {
  return (
    <div className={`col-span-12 md:col-span-6 ${cardBase}`}>
      <span className={sectionLabel}>Wind</span>
      <div className="flex items-center justify-between gap-4">
        {/* Values */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Wind className="text-teal-700 dark:text-cyan-400 shrink-0" size={16} />
            <span className="text-xl font-black text-on-surface">
              {parsedMetar.windDir ? `${parsedMetar.windDir}°T` : 'VRB'}
            </span>
          </div>
          <span className="text-3xl font-black text-on-surface leading-none">
            {parsedMetar.windSpeed ?? '–'}
            <span className="text-sm font-medium text-on-surface-variant ml-1.5">
              {parsedMetar.windUnit || 'kt'}
            </span>
          </span>
        </div>

        {/* Compact compass */}
        <div className="relative w-[72px] h-[72px] rounded-full border border-outline flex items-center justify-center shrink-0">
          <div className="absolute inset-1.5 border border-dashed border-outline rounded-full" />
          {parsedMetar.windDir && parsedMetar.windDir !== 'VRB' && (
            <div
              className="absolute origin-center w-1 h-full flex flex-col items-center justify-start py-1.5"
              style={{ transform: `rotate(${parsedMetar.windDir}deg)` }}
            >
              <div className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_color-mix(in_srgb,var(--status-warning)_80%,transparent)]" />
            </div>
          )}
          <span className="text-[11px] font-bold text-on-surface z-10">
            {parsedMetar.windDir === 'VRB'
              ? 'VRB'
              : parsedMetar.windDir
                ? `${parsedMetar.windDir}°`
                : '–'}
          </span>
        </div>
      </div>
    </div>
  );
}

function VisibilityCloudCard({ parsedMetar }: { parsedMetar: ParsedMetar }) {
  return (
    <div className="col-span-12 md:col-span-6 flex flex-col gap-3">
      {/* Visibility */}
      <div className={cardBase}>
        <span className={sectionLabel}>Visibility</span>
        <div className="flex items-center gap-2 mb-2.5">
          <Eye className="text-teal-700 dark:text-cyan-400 shrink-0" size={16} />
          <span className="text-xl font-bold text-on-surface">{parsedMetar.visibility || '–'}</span>
        </div>
        <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
          {parsedMetar.visibility && (
            <div
              className="bg-teal-1000 dark:bg-cyan-400 h-full shadow-[0_0_8px_var(--accent-cyan-glow)]"
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
          <Cloud className="text-teal-700 dark:text-cyan-400 mt-0.5 shrink-0" size={16} />
          <div className="flex flex-col gap-0.5">
            {parsedMetar.clouds.length > 0 ? (
              parsedMetar.clouds.map((c: string, i: number) => (
                <span key={i} className="text-sm font-semibold text-on-surface leading-snug">
                  {c}
                </span>
              ))
            ) : (
              <span className="text-sm text-on-surface-variant italic">No cloud data</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TempDewQnhCards({ parsedMetar }: { parsedMetar: ParsedMetar }) {
  return (
    <>
      {/* Temperature */}
      <div className={`col-span-4 ${cardBase} flex flex-col items-center`}>
        <span className={sectionLabel + ' text-center'}>Temp</span>
        <Thermometer className="text-teal-700 dark:text-cyan-400 mb-1.5" size={18} />
        <div className="text-2xl font-black text-on-surface">
          {parsedMetar.temp !== null ? `${parsedMetar.temp}°C` : '–'}
        </div>
      </div>

      {/* Dew Point */}
      <div className={`col-span-4 ${cardBase} flex flex-col items-center`}>
        <span className={sectionLabel + ' text-center'}>Dew Pt</span>
        <CloudFog className="text-teal-700 dark:text-cyan-400 mb-1.5" size={18} />
        <div className="text-2xl font-black text-on-surface">
          {parsedMetar.dew !== null ? `${parsedMetar.dew}°C` : '–'}
        </div>
      </div>

      {/* QNH */}
      <div className={`col-span-4 ${cardBase} flex flex-col items-center`}>
        <span className={sectionLabel + ' text-center'}>QNH</span>
        <Compass className="text-teal-700 dark:text-cyan-400 mb-1.5" size={18} />
        <div className="text-2xl font-black text-on-surface">
          {parsedMetar.qnh !== null ? `${parsedMetar.qnh}` : '–'}
        </div>
        <span className="text-[9px] text-on-surface-variant font-bold tracking-widest mt-0.5">
          hPa
        </span>
      </div>
    </>
  );
}

function WeatherDataCards({ parsedMetar }: { parsedMetar: ParsedMetar }) {
  return (
    <>
      <WindCard parsedMetar={parsedMetar} />
      <VisibilityCloudCard parsedMetar={parsedMetar} />
      <TempDewQnhCards parsedMetar={parsedMetar} />
    </>
  );
}

function DaylightCard({
  todayStr,
  daylight,
}: {
  todayStr: string;
  daylight: DaylightRecord | null;
}) {
  return (
    <div className={`col-span-12 ${cardBase}`}>
      <div className="flex justify-between items-center mb-4">
        <span className={sectionLabel + ' mb-0'}>Daylight</span>
        <span className="text-[10px] text-on-surface-variant font-mono tracking-widest tabular-nums">
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
            className="flex flex-col items-center gap-1.5 bg-surface rounded-xl p-3 border border-outline-variant"
          >
            <Icon size={18} className={color} />
            <span className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">
              {label}
            </span>
            <span className="text-sm font-bold text-on-surface tabular-nums">{value || '–'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConditionsWidget({
  icaoCode,
  weather,
  parsedMetar,
  daylight,
  todayStr,
}: ConditionsWidgetProps) {
  const hasWeather = weather
    ? !!weather.metar
    : parsedMetar.temp !== null ||
      parsedMetar.qnh !== null ||
      parsedMetar.windSpeed !== null ||
      parsedMetar.visibility !== null;

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
          <h2 className="text-2xl font-black text-on-surface tracking-widest">{icaoCode}</h2>
          <p className="text-on-surface-variant text-[10px] tracking-[0.2em] uppercase mt-1">
            Current Conditions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {!hasWeather ? (
          <UnavailableCard icaoCode={icaoCode} />
        ) : (
          <WeatherDataCards parsedMetar={parsedMetar} />
        )}
        <DaylightCard todayStr={todayStr} daylight={daylight} />
      </div>
    </motion.div>
  );
}
