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

function WindCard({ parsedMetar }: { parsedMetar: ParsedMetar }) {
  return (
    <div className={`col-span-12 ${cardBase}`}>
      <span className={sectionLabel}>Wind</span>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Wind className="text-teal-700 dark:text-cyan-400 shrink-0" size={16} />
            <span className="text-lg font-black text-on-surface">
              {parsedMetar.windDir === 'VRB'
                ? 'VRB'
                : parsedMetar.windDir
                  ? `${parsedMetar.windDir}°T`
                  : '–'}
            </span>
          </div>
          <span className="text-3xl font-black text-on-surface leading-none">
            {parsedMetar.windSpeed ?? '–'}
            <span className="text-xs font-medium text-on-surface-variant ml-1">
              {parsedMetar.windUnit || 'kt'}
            </span>
          </span>
        </div>

        {/* Compact Compass */}
        <div className="relative w-16 h-16 rounded-full border border-outline flex items-center justify-center shrink-0">
          <div className="absolute inset-1 border border-dashed border-outline rounded-full" />
          {parsedMetar.windDir && parsedMetar.windDir !== 'VRB' && (
            <div
              className="absolute origin-center w-1 h-full flex flex-col items-center justify-start py-1"
              style={{ transform: `rotate(${parsedMetar.windDir}deg)` }}
            >
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_6px_color-mix(in_srgb,var(--status-warning)_80%,transparent)]" />
            </div>
          )}
          <span className="text-[10px] font-bold text-on-surface z-10">
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
