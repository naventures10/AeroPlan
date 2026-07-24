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
  isCompact?: boolean;
}

// Shared card label style
const sectionLabel =
  'text-[9px] font-black tracking-[0.25em] text-on-surface-variant  uppercase block mb-2';

// Shared card surface class
const cardBase = 'bg-surface-container rounded-2xl p-3 border border-outline-variant';

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

function WindsockIcon({ className = 'w-[22px] h-[36px]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} drop-shadow-[0_2px_5px_rgba(0,0,0,0.7)] shrink-0`}
    >
      {/* Pivot Mount Dot on Ring */}
      <circle cx="12" cy="1.2" r="1.2" fill="#ffffff" stroke="#0f172a" strokeWidth="0.6" />

      {/* Wire Harness Lines (V-mount) */}
      <line
        x1="12"
        y1="1.2"
        x2="5.5"
        y2="7.0"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="1.2"
        x2="18.5"
        y2="7.0"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Metal Hoop Mouth Rim */}
      <ellipse
        cx="12"
        cy="7.0"
        rx="6.5"
        ry="1.8"
        fill="#cbd5e1"
        stroke="#0f172a"
        strokeWidth="0.8"
      />
      {/* Dark Inside Opening */}
      <ellipse cx="12" cy="7.0" rx="4.8" ry="1.0" fill="#651a07" />

      {/* Stripe 1 (Mouth Orange) */}
      <path
        d="M 5.5 7.0 C 5.5 8.2 18.5 8.2 18.5 7.0 L 17.7 11.5 C 17.7 12.6 6.3 12.6 6.3 11.5 Z"
        fill="#ff5500"
        stroke="#0f172a"
        strokeWidth="0.6"
      />

      {/* Stripe 2 (White Band 1) */}
      <path
        d="M 6.3 11.5 C 6.3 12.6 17.7 12.6 17.7 11.5 L 16.9 16.0 C 16.9 17.0 7.1 17.0 7.1 16.0 Z"
        fill="#ffffff"
        stroke="#0f172a"
        strokeWidth="0.6"
      />

      {/* Stripe 3 (Middle Orange) */}
      <path
        d="M 7.1 16.0 C 7.1 17.0 16.9 17.0 16.9 16.0 L 16.1 20.5 C 16.1 21.4 7.9 21.4 7.9 20.5 Z"
        fill="#ff5500"
        stroke="#0f172a"
        strokeWidth="0.6"
      />

      {/* Stripe 4 (White Band 2) */}
      <path
        d="M 7.9 20.5 C 7.9 21.4 16.1 21.4 16.1 20.5 L 15.4 25.0 C 15.4 25.8 8.6 25.8 8.6 25.0 Z"
        fill="#ffffff"
        stroke="#0f172a"
        strokeWidth="0.6"
      />

      {/* Stripe 5 (Tail Orange) */}
      <path
        d="M 8.6 25.0 C 8.6 25.8 15.4 25.8 15.4 25.0 L 14.8 28.5 C 14.8 29.3 9.2 29.3 9.2 28.5 Z"
        fill="#ff5500"
        stroke="#0f172a"
        strokeWidth="0.6"
      />

      {/* Tail End Soft Wide Opening */}
      <ellipse
        cx="12"
        cy="28.5"
        rx="2.8"
        ry="0.9"
        fill="#ea580c"
        stroke="#0f172a"
        strokeWidth="0.8"
      />
      <ellipse cx="12" cy="28.5" rx="1.8" ry="0.5" fill="#651a07" />
    </svg>
  );
}

function WindCard({ parsedMetar, isCompact }: { parsedMetar: ParsedMetar; isCompact?: boolean }) {
  return (
    <div
      className={`col-span-12 ${isCompact ? '' : 'md:col-span-6'} ${cardBase} flex flex-col items-center justify-between`}
    >
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-1">
        <span className={sectionLabel + ' mb-0'}>Wind</span>
        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-semibold">
          <Wind className="text-teal-700 dark:text-cyan-400 shrink-0" size={14} />
          <span>
            {parsedMetar.windDir === 'VRB'
              ? 'Variable Wind'
              : parsedMetar.windDir
                ? `${parsedMetar.windDir}°T`
                : 'No Direction'}
          </span>
        </div>
      </div>

      {/* Centered Compass Ring (Above) */}
      <div className="relative w-28 h-28 rounded-full border border-outline-variant flex items-center justify-center shrink-0 bg-surface/40 shadow-inner my-1">
        {/* Dashed Inner Track */}
        <div className="absolute inset-2.5 border border-dashed border-outline-variant/60 rounded-full" />

        {/* Rotated Windsock */}
        {parsedMetar.windDir && parsedMetar.windDir !== 'VRB' && (
          <div
            className="absolute inset-0 origin-center flex flex-col items-center justify-start py-0 pointer-events-none z-0"
            style={{ transform: `rotate(${parsedMetar.windDir}deg)` }}
          >
            <WindsockIcon className="w-[22px] h-[36px]" />
          </div>
        )}

        {/* Center Readout */}
        <div className="flex flex-col items-center justify-center z-10 text-center bg-surface-container/90 backdrop-blur-xs rounded-full w-11 h-11 border border-outline-variant/60 shadow-xs">
          <span className="text-[11px] font-black text-on-surface leading-tight">
            {parsedMetar.windDir === 'VRB'
              ? 'VRB'
              : parsedMetar.windDir
                ? `${parsedMetar.windDir}°`
                : '–'}
          </span>
          <span className="text-[8px] font-medium text-on-surface-variant leading-tight">
            {parsedMetar.windSpeed
              ? `${parsedMetar.windSpeed}${parsedMetar.windUnit || 'kt'}`
              : '–'}
          </span>
        </div>
      </div>

      {/* Stats Readout (Below) */}
      <div className="w-full grid grid-cols-2 gap-2 mt-1">
        <div className="bg-surface/60 rounded-xl p-1.5 border border-outline-variant/50 flex flex-col items-center justify-center">
          <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
            Speed
          </span>
          <span className="text-sm font-black text-on-surface">
            {parsedMetar.windSpeed ?? '–'}{' '}
            <span className="text-[10px] font-medium text-on-surface-variant">
              {parsedMetar.windUnit || 'kt'}
            </span>
          </span>
        </div>

        <div className="bg-surface/60 rounded-xl p-1.5 border border-outline-variant/50 flex flex-col items-center justify-center">
          <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
            Direction
          </span>
          <span className="text-sm font-black text-on-surface">
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

function getVisibilityPercentage(vis: string | null): string {
  if (!vis) return '0%';
  if (/CAVOK|9999|KM|>/i.test(vis)) return '100%';

  const val = parseInt(vis, 10);
  if (Number.isInteger(val)) {
    const pct = (val / 10000) * 100;
    const clamped = Math.max(0, Math.min(pct, 100));
    return `${clamped}%`;
  }
  return '100%';
}

function VisibilityCloudCard({
  parsedMetar,
  isCompact,
}: {
  parsedMetar: ParsedMetar;
  isCompact?: boolean;
}) {
  return (
    <div className={`col-span-12 ${isCompact ? '' : 'md:col-span-6'} flex flex-col gap-3`}>
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
                width: getVisibilityPercentage(parsedMetar.visibility),
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

function WeatherDataCards({
  parsedMetar,
  isCompact,
}: {
  parsedMetar: ParsedMetar;
  isCompact?: boolean;
}) {
  return (
    <>
      <WindCard parsedMetar={parsedMetar} isCompact={isCompact} />
      <VisibilityCloudCard parsedMetar={parsedMetar} isCompact={isCompact} />
      <TempDewQnhCards parsedMetar={parsedMetar} />
    </>
  );
}

function DaylightCard({
  todayStr,
  daylight,
  isCompact,
}: {
  todayStr: string;
  daylight: DaylightRecord | null;
  isCompact?: boolean;
}) {
  return (
    <div className={`col-span-12 ${cardBase}`}>
      <div className="flex justify-between items-center mb-4">
        <span className={sectionLabel + ' mb-0'}>Daylight</span>
        <span className="text-[10px] text-on-surface-variant font-mono tracking-widest tabular-nums">
          {todayStr}
        </span>
      </div>
      {daylight ? (
        <div className={`grid ${isCompact ? 'grid-cols-2' : 'grid-cols-4'} gap-2`}>
          {[
            {
              icon: Sunrise,
              color: 'text-amber-400',
              label: 'MCT',
              value: daylight.twilight_from,
            },
            { icon: Sun, color: 'text-amber-500', label: 'Sunrise', value: daylight.sunrise },
            { icon: Sunset, color: 'text-orange-500', label: 'Sunset', value: daylight.sunset },
            { icon: Moon, color: 'text-indigo-400', label: 'ECT', value: daylight.twilight_to },
          ].map(({ icon: Icon, color, label, value }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 bg-surface rounded-xl p-2 border border-outline-variant"
            >
              <Icon size={18} className={color} />
              <span className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">
                {label}
              </span>
              <span className="text-sm font-bold text-on-surface tabular-nums">{value || '–'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 mb-3 shadow-inner">
            <Sun className="text-amber-500/70 animate-pulse" size={24} />
          </div>
          <h4 className="text-xs font-black tracking-widest text-on-surface uppercase mb-1">
            Daylight Data Unavailable
          </h4>
          <p className="text-[10px] text-on-surface-variant max-w-[280px] leading-relaxed font-medium">
            No daylight calculations or twilight information found for today.
          </p>
        </div>
      )}
    </div>
  );
}

export function ConditionsWidget({
  icaoCode,
  weather,
  parsedMetar,
  daylight,
  todayStr,
  isCompact,
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
      className="flex flex-col gap-3.5"
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
          <WeatherDataCards parsedMetar={parsedMetar} isCompact={isCompact} />
        )}
        <DaylightCard todayStr={todayStr} daylight={daylight} isCompact={isCompact} />
      </div>
    </motion.div>
  );
}
