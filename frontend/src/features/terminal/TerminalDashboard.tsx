import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudFog, CloudRain, AlertTriangle, ChevronLeft } from 'lucide-react';
import { fetchWeather, fetchNotams, fetchDaylight } from '../../api/client';
import { parseMetar } from '../../utils/metarParser';
import type { WeatherData, NotamData, DaylightRecord } from '../../types';

import { ConditionsWidget } from './components/ConditionsWidget';
import { MetarWidget } from './components/MetarWidget';
import { TafWidget } from './components/TafWidget';
import { NotamWidget } from './components/NotamWidget';

export default function TerminalDashboard({ icaoCode }: { icaoCode: string }) {
  const [activeTab, setActiveTab] = useState<'CONDITIONS' | 'METAR' | 'TAF' | 'NOTAM'>(
    'CONDITIONS',
  );
  const [isCollapsed, setIsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [notams, setNotams] = useState<NotamData[]>([]);
  const [daylight, setDaylight] = useState<DaylightRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0] as string, []);

  useEffect(() => {
    if (!icaoCode) return;
    setWeather(null);
    setNotams([]);
    setDaylight(null);
    setLoading(true);

    let isMounted = true;
    let pending = 3;
    const maybeFinish = () => {
      if (--pending === 0 && isMounted) setLoading(false);
    };

    fetchWeather(icaoCode)
      .then((w) => {
        if (isMounted && w) setWeather(w);
      })
      .finally(maybeFinish);

    fetchNotams(icaoCode)
      .then((n) => {
        if (isMounted) setNotams(n);
      })
      .finally(maybeFinish);

    fetchDaylight(icaoCode, todayStr)
      .then((d) => {
        if (isMounted && d) setDaylight(d);
      })
      .finally(maybeFinish);

    return () => {
      isMounted = false;
    };
  }, [icaoCode, todayStr]);

  const parsedMetar = useMemo(() => parseMetar(weather?.metar || null), [weather]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCollapsed) {
        setIsCollapsed(true);
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isCollapsed]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        !isCollapsed &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsCollapsed(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCollapsed]);

  if (!icaoCode) return null;

  const tabs: Array<{
    id: 'CONDITIONS' | 'METAR' | 'TAF' | 'NOTAM';
    icon: any;
    label: string;
    badge?: number;
  }> = [
    { id: 'CONDITIONS', icon: CloudFog, label: 'CONDITIONS' },
    { id: 'METAR', icon: CloudRain, label: 'METAR' },
    { id: 'TAF', icon: CloudRain, label: 'TAF' },
    { id: 'NOTAM', icon: AlertTriangle, label: 'NOTAM', badge: notams.length },
  ];

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      exit={{ opacity: 0 }}
      className="h-fit max-h-[calc(100vh-22rem)] flex pointer-events-none"
    >
      <motion.div
        animate={{ width: isCollapsed ? 44 : 72, backdropFilter: 'blur(20px)' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-zinc-950/80 border border-white/[0.06] rounded-3xl flex flex-col items-center relative shrink-0 z-20 pointer-events-auto overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]"
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute top-0 bottom-0 left-0 w-full group/handle flex flex-col items-center justify-center transition-colors ${
            isCollapsed ? 'hover:bg-cyan-500/5 cursor-pointer' : 'pointer-events-none'
          }`}
          title={isCollapsed ? 'Expand Dashboard' : ''}
        >
          {isCollapsed && (
            <div className="flex flex-col items-center gap-4 py-8 h-full">
              <ChevronLeft
                size={16}
                className="text-cyan-400 group-hover/handle:scale-125 transition-transform"
              />
              <div className="text-[10px] font-black text-white/40 tracking-[0.4em] uppercase [writing-mode:vertical-lr] rotate-180 flex-1 flex items-center justify-center">
                DASHBOARD
              </div>
              <ChevronLeft
                size={16}
                className="text-cyan-400 group-hover/handle:scale-125 transition-transform"
              />
            </div>
          )}
        </button>

        {!isCollapsed &&
          tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center w-full py-3.5 mx-1.5 my-0.5 rounded-xl cursor-pointer transition duration-300 ${
                  isActive
                    ? 'text-cyan-400 bg-cyan-500/15'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                }`}
              >
                <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[9px] font-bold tracking-[0.1em] mt-2 text-center px-1">
                  {tab.label}
                </span>
                {tab.badge !== undefined && tab.badge > 0 && typeof tab.badge === 'number' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center shadow-lg shadow-amber-500/20">
                    {tab.badge}
                  </div>
                )}
              </div>
            );
          })}
      </motion.div>

      <motion.div
        animate={{
          width: isCollapsed ? 0 : 480,
          opacity: isCollapsed ? 0 : 1,
          paddingLeft: isCollapsed ? 0 : 12,
          borderWidth: isCollapsed ? 0 : 1,
          backdropFilter: isCollapsed ? 'blur(0px)' : 'blur(20px)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`bg-zinc-950/80 relative flex flex-col shrink-0 overflow-hidden border-l-0 border-white/[0.06] rounded-r-3xl z-10 -ml-4 ${
          isCollapsed
            ? 'pointer-events-none shadow-none'
            : 'pointer-events-auto shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]'
        }`}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-7 h-7 border-t-2 border-cyan-400 border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="p-6 h-full overflow-y-auto aip-scrollbar w-[480px]">
            <AnimatePresence>
              {activeTab === 'CONDITIONS' && (
                <ConditionsWidget
                  icaoCode={icaoCode}
                  parsedMetar={parsedMetar}
                  daylight={daylight}
                  todayStr={todayStr}
                />
              )}
              {activeTab === 'METAR' && <MetarWidget weather={weather} />}
              {activeTab === 'TAF' && <TafWidget weather={weather} />}
              {activeTab === 'NOTAM' && <NotamWidget notams={notams} />}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
