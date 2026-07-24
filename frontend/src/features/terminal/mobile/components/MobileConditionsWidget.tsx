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
import type { ParsedMetar, DaylightRecord, WeatherData } from '../../../../types';

interface MobileConditionsWidgetProps {
  icaoCode: string;
  weather?: WeatherData | null;
  parsedMetar: ParsedMetar;
  daylight: DaylightRecord | null;
  todayStr: string;
}

const sectionLabel =
  'text-[10px] font-black tracking-[0.2em] text-on-surface-variant uppercase block mb-2';

const cardBase = 'bg-surface-container rounded-2xl p-4 border border-outline-variant';

function UnavailableCard({ icaoCode }: { icaoCode: string }) {
  return (
    <div className="col-span-12 bg-gradient-to-br from-surface-container/60 to-surface-container-high/60 rounded-2xl p-6 border border-outline-variant/50 flex flex-col items-center justify-center text-center min-h-[180px] backdrop-blur-md relative overflow-hidden group">
      <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-teal-500/10 dark:bg-cyan-500/10 blur-2xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 w-24 h-24 rounded-full bg-amber-500/5 dark:bg-amber-500/5 blur-2xl pointer-events-none" />

      <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100/50 dark:border-teal-900/30 mb-3 shadow-inner">
        <CloudFog className="text-teal-700 dark:text-cyan-400 animate-pulse" size={24} />
      </div>

      <h3 className="text-xs font-black tracking-widest text-on-surface uppercase mb-1">
        Weather Unavailable
      </h3>

      <p className="text-[11px] text-on-surface-variant max-w-[280px] leading-relaxed font-medium">
        No live weather or observations reported for{' '}
        <span className="text-teal-700 dark:text-cyan-400 font-bold">{icaoCode}</span>.
      </p>
    </div>
  );
}

function WindsockIcon({ className = 'w-[19px] h-[30px]' }: { className?: string }) {
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

function WindCard({ parsedMetar }: { parsedMetar: ParsedMetar }) {
  return (
    <div className={`col-span-12 ${cardBase} flex flex-col items-center justify-between`}>
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-1">
        <span className={sectionLabel + ' mb-0'}>Wind</span>
        <div className="flex items-center gap-1 text-xs text-on-surface-variant font-semibold">
          <Wind className="text-teal-700 dark:text-cyan-400 shrink-0" size={13} />
          <span>
            {parsedMetar.windDir === 'VRB'
              ? 'VRB'
              : parsedMetar.windDir
                ? `${parsedMetar.windDir}° True`
                : 'No Dir'}
          </span>
        </div>
      </div>

      {/* Centered Compass Ring (Above) */}
      <div className="relative w-24 h-24 rounded-full border border-outline-variant flex items-center justify-center shrink-0 bg-surface/40 shadow-inner my-1">
        {/* Dashed Inner Track */}
        <div className="absolute inset-2 border border-dashed border-outline-variant/60 rounded-full" />

        {/* Rotated Windsock */}
        {parsedMetar.windDir && parsedMetar.windDir !== 'VRB' && (
          <div
            className="absolute inset-0 origin-center flex flex-col items-center justify-start py-0 pointer-events-none z-0"
            style={{ transform: `rotate(${parsedMetar.windDir}deg)` }}
          >
            <WindsockIcon className="w-[19px] h-[30px]" />
          </div>
        )}

        {/* Center Readout */}
        <div className="flex flex-col items-center justify-center z-10 text-center bg-surface-container/90 backdrop-blur-xs rounded-full w-9 h-9 border border-outline-variant/60 shadow-xs">
          <span className="text-[10px] font-black text-on-surface leading-tight">
            {parsedMetar.windDir === 'VRB'
              ? 'VRB'
              : parsedMetar.windDir
                ? `${parsedMetar.windDir}°`
                : '–'}
          </span>
          <span className="text-[7.5px] font-medium text-on-surface-variant leading-tight">
            {parsedMetar.windSpeed
              ? `${parsedMetar.windSpeed}${parsedMetar.windUnit || 'kt'}`
              : '–'}
          </span>
        </div>
      </div>

      {/* Stats Readout (Below) */}
      <div className="w-full grid grid-cols-2 gap-1.5 mt-1">
        <div className="bg-surface/60 rounded-xl p-1 border border-outline-variant/50 flex flex-col items-center justify-center">
          <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-wider">
            Speed
          </span>
          <span className="text-xs font-black text-on-surface">
            {parsedMetar.windSpeed ?? '–'}{' '}
            <span className="text-[9px] font-medium text-on-surface-variant">
              {parsedMetar.windUnit || 'kt'}
            </span>
          </span>
        </div>

        <div className="bg-surface/60 rounded-xl p-1 border border-outline-variant/50 flex flex-col items-center justify-center">
          <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-wider">
            Direction
          </span>
          <span className="text-xs font-black text-on-surface">
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

function VisibilityCard({ visibility }: { visibility: string | null }) {
  return (
    <div className={`col-span-6 ${cardBase}`}>
      <span className={sectionLabel}>Visibility</span>
      <div className="flex items-center gap-1.5 mb-2">
        <Eye className="text-teal-700 dark:text-cyan-400 shrink-0" size={16} />
        <span className="text-lg font-bold text-on-surface">{visibility || '–'}</span>
      </div>
      <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
        {visibility && (
          <div
            className="bg-teal-1000 dark:bg-cyan-400 h-full shadow-[0_0_8px_var(--accent-cyan-glow)]"
            style={{
              width: getVisibilityPercentage(visibility),
            }}
          />
        )}
      </div>
    </div>
  );
}

function CloudCard({ clouds }: { clouds: string[] }) {
  return (
    <div className={`col-span-6 ${cardBase}`}>
      <span className={sectionLabel}>Clouds</span>
      <div className="flex items-start gap-2">
        <Cloud className="text-teal-700 dark:text-cyan-400 mt-0.5 shrink-0" size={16} />
        <div className="flex flex-col gap-0.5 max-h-[3.5rem] overflow-y-auto w-full">
          {clouds.length > 0 ? (
            clouds.map((c, i) => (
              <span key={i} className="text-xs font-semibold text-on-surface leading-tight">
                {c}
              </span>
            ))
          ) : (
            <span className="text-xs text-on-surface-variant italic">Clear</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TempCard({ temp }: { temp: number | null }) {
  return (
    <div className={`col-span-4 ${cardBase} flex flex-col items-center justify-center p-3`}>
      <span className={sectionLabel + ' text-center mb-1'}>Temp</span>
      <Thermometer className="text-teal-700 dark:text-cyan-400 mb-1" size={16} />
      <div className="text-lg font-black text-on-surface">{temp !== null ? `${temp}°C` : '–'}</div>
    </div>
  );
}

function DewCard({ dew }: { dew: number | null }) {
  return (
    <div className={`col-span-4 ${cardBase} flex flex-col items-center justify-center p-3`}>
      <span className={sectionLabel + ' text-center mb-1'}>Dew Pt</span>
      <CloudFog className="text-teal-700 dark:text-cyan-400 mb-1" size={16} />
      <div className="text-lg font-black text-on-surface">{dew !== null ? `${dew}°C` : '–'}</div>
    </div>
  );
}

function QnhCard({ qnh }: { qnh: number | null }) {
  return (
    <div className={`col-span-4 ${cardBase} flex flex-col items-center justify-center p-3`}>
      <span className={sectionLabel + ' text-center mb-1'}>QNH</span>
      <Compass className="text-teal-700 dark:text-cyan-400 mb-1" size={16} />
      <div className="text-lg font-black text-on-surface">{qnh !== null ? `${qnh}` : '–'}</div>
      {qnh !== null && (
        <span className="text-[8px] text-on-surface-variant font-bold tracking-wider mt-0.5">
          hPa
        </span>
      )}
    </div>
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
      <div className="flex justify-between items-center mb-3">
        <span className={sectionLabel + ' mb-0'}>Daylight</span>
        <span className="text-[10px] text-on-surface-variant font-mono tracking-wider">
          {todayStr}
        </span>
      </div>
      {daylight ? (
        <div className="grid grid-cols-4 gap-1.5">
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
              className="flex flex-col items-center gap-1 bg-surface rounded-xl p-1.5 border border-outline-variant"
            >
              <Icon size={16} className={color} />
              <span className="text-[8px] text-on-surface-variant font-black uppercase tracking-wider">
                {label}
              </span>
              <span className="text-xs font-bold text-on-surface tabular-nums">{value || '–'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <Sun className="text-amber-500/50 animate-pulse mb-1" size={20} />
          <h4 className="text-[10px] font-black tracking-widest text-on-surface uppercase mb-0.5">
            Daylight Unavailable
          </h4>
        </div>
      )}
    </div>
  );
}

export function MobileConditionsWidget({
  icaoCode,
  weather,
  parsedMetar,
  daylight,
  todayStr,
}: MobileConditionsWidgetProps) {
  const hasWeather = weather
    ? !!weather.metar
    : parsedMetar.temp !== null ||
      parsedMetar.qnh !== null ||
      parsedMetar.windSpeed !== null ||
      parsedMetar.visibility !== null;

  return (
    <motion.div
      key="mobile-conditions"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-12 gap-2.5">
        {!hasWeather ? (
          <UnavailableCard icaoCode={icaoCode} />
        ) : (
          <>
            <WindCard parsedMetar={parsedMetar} />
            <VisibilityCard visibility={parsedMetar.visibility} />
            <CloudCard clouds={parsedMetar.clouds} />
            <TempCard temp={parsedMetar.temp} />
            <DewCard dew={parsedMetar.dew} />
            <QnhCard qnh={parsedMetar.qnh} />
          </>
        )}
        <DaylightCard todayStr={todayStr} daylight={daylight} />
      </div>
    </motion.div>
  );
}
