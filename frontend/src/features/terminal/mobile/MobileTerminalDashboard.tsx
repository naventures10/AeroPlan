import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { fetchWeather, fetchNotams, fetchDaylight } from '../../../api/client';
import { parseMetar } from '../../../utils/metarParser';
import type { WeatherData, NotamData, DaylightRecord } from '../../../types';
import './MobileTerminalDashboard.css';

import { MobileConditionsWidget } from './components/MobileConditionsWidget';
import { MobileMetarWidget } from './components/MobileMetarWidget';
import { MobileTafWidget } from './components/MobileTafWidget';
import { MobileNotamWidget } from './components/MobileNotamWidget';

interface MobileTerminalDashboardProps {
  icaoCode: string;
}

export default function MobileTerminalDashboard({ icaoCode }: MobileTerminalDashboardProps) {
  const [activeTab, setActiveTab] = useState<'CONDITIONS' | 'METAR' | 'TAF' | 'NOTAM'>(
    'CONDITIONS',
  );
  const [isCollapsed, setIsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [notams, setNotams] = useState<NotamData[]>([]);
  const [daylight, setDaylight] = useState<DaylightRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0] as string, []);

  // Fetch data on ICAO Code change
  useEffect(() => {
    if (!icaoCode) return;
    setWeather(null);
    setNotams([]);
    setDaylight(null);
    setLoading(true);
    // Auto expand drawer on selection
    setIsCollapsed(false);

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

  if (!icaoCode) return null;

  // Build tabs definition
  const tabs = [
    { id: 'CONDITIONS' as const, label: 'CONDITIONS' },
    { id: 'METAR' as const, label: 'METAR' },
    { id: 'TAF' as const, label: 'TAF' },
    { id: 'NOTAM' as const, label: 'NOTAM', badge: notams.length },
  ];

  // Quick summary string for collapsed dock
  const summaryText = (() => {
    if (loading) return 'Loading weather...';
    const tempStr = parsedMetar.temp !== null ? `${parsedMetar.temp}°C` : '';
    const windStr = parsedMetar.windSpeed
      ? `${parsedMetar.windSpeed}${parsedMetar.windUnit || 'kt'}`
      : '';
    const visStr = parsedMetar.visibility ? `Vis ${parsedMetar.visibility}` : '';
    return [tempStr, windStr, visStr].filter(Boolean).join(' · ') || 'Weather observations loaded';
  })();

  const handleHeaderClick = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Semi-transparent backdrop only when drawer is fully expanded */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            key="mobile-terminal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCollapsed(true)}
            className="mobile-terminal-backdrop"
          />
        )}
      </AnimatePresence>

      {/* Main Bottom Sheet Drawer */}
      <motion.div
        ref={containerRef}
        initial={{ y: '100%' }}
        animate={{ y: isCollapsed ? 'calc(70dvh - 96px)' : 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 400 }}
        dragElastic={0.05}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 60) {
            setIsCollapsed(true);
          } else if (info.offset.y < -40) {
            setIsCollapsed(false);
          }
        }}
        className="mobile-terminal-drawer"
      >
        {/* Combined Draggable Header & Gesture Zone */}
        <div
          onClick={handleHeaderClick}
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: 'none' }}
          className="mobile-terminal-dock-header"
        >
          {/* Centered Drag Handle */}
          <div className="mobile-terminal-drag-handle" />

          {/* Header Text / Stats */}
          <div className="flex flex-col gap-0.5 select-none w-full text-left">
            <span className="text-sm font-black tracking-wider text-on-surface flex items-center gap-1.5">
              {icaoCode}
              {loading && (
                <RefreshCw size={12} className="animate-spin text-teal-700 dark:text-cyan-400" />
              )}
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium">{summaryText}</span>
          </div>
        </div>

        {/* Expanded tabs content */}
        {!isCollapsed && (
          <div className="mobile-terminal-expanded-content flex-1 flex flex-col min-h-0">
            {/* Horizontal Tabs Selection */}
            <div className="mobile-terminal-tab-bar select-none">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`mobile-terminal-tab-btn ${isActive ? 'active' : ''}`}
                  >
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="mobile-terminal-tab-badge">{tab.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected tab widget list container */}
            <div className="mobile-terminal-widget-container flex-1 overflow-y-auto aip-scrollbar p-4">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-t-2 border-teal-600 dark:border-cyan-400 border-solid rounded-full animate-spin"></div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {activeTab === 'CONDITIONS' && (
                    <MobileConditionsWidget
                      key="cond"
                      icaoCode={icaoCode}
                      weather={weather}
                      parsedMetar={parsedMetar}
                      daylight={daylight}
                      todayStr={todayStr}
                    />
                  )}
                  {activeTab === 'METAR' && <MobileMetarWidget key="metar" weather={weather} />}
                  {activeTab === 'TAF' && <MobileTafWidget key="taf" weather={weather} />}
                  {activeTab === 'NOTAM' && <MobileNotamWidget key="notam" notams={notams} />}
                </AnimatePresence>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
