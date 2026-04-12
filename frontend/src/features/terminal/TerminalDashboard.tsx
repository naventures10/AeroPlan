import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudRain, Wind, Thermometer, CloudFog, AlertTriangle, Cloud, Eye, Compass, Sunrise, Sunset, Moon, Sun, ChevronLeft } from 'lucide-react';

// --- TYPES ---
interface WeatherData {
  icao: string;
  metar: string | null;
  taf: string[][];
  source: string;
  fetched_at: string;
}

interface NotamData {
  notam_id: string;
  source_file: string;
  series: string;
  scope: string;
  fir: string;
  combined_fir: string | null;
  airport_icao: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_permanent: boolean;
  is_estimated: boolean;
  duration_category: string;
  description: string;
}

interface DaylightRecord {
  date: string;
  twilight_from: string; // MCT
  sunrise: string;
  sunset: string;
  twilight_to: string;   // ECT
}

interface ParsedMetar {
  windDir: string | null;
  windSpeed: string | null;
  windUnit: string | null;
  visibility: string | null;
  clouds: string[];
  temp: number | null;
  dew: number | null;
  qnh: number | null;
}

// --- METAR PARSER ---
function parseMetar(metar: string | null): ParsedMetar {
  const result: ParsedMetar = {
    windDir: null, windSpeed: null, windUnit: null,
    visibility: null, clouds: [], temp: null, dew: null, qnh: null
  };
  
  if (!metar) return result;
  
  const parts = metar.split(/\s+/);
  
  for (const part of parts) {
    // Wind: 32010KT, VRB05KT, 27015G25KT
    const windMatch = part.match(/^(\d{3}|VRB)(\d{2,3})(?:G\d{2,3})?(KT|MPS|KMH)$/i);
    if (windMatch) {
      result.windDir = windMatch[1] ?? '';
      result.windSpeed = windMatch[2] ?? '';
      result.windUnit = windMatch[3] ?? '';
      continue;
    }
    
    // Temp/Dew: 29/18, M05/M08
    const tempMatch = part.match(/^(M?\d{2})\/(M?\d{2})?$/);
    if (tempMatch) {
      const parseTemp = (t: string) => t.startsWith('M') ? -parseInt(t.substring(1)) : parseInt(t);
      if (tempMatch[1]) result.temp = parseTemp(tempMatch[1]);
      if (tempMatch[2]) result.dew = parseTemp(tempMatch[2]);
      continue;
    }
    
    // QNH: Q1009, A2992
    if (part.startsWith('Q') && part.length === 5) {
      result.qnh = parseInt(part.substring(1));
      continue;
    }
    if (part.startsWith('A') && part.length === 5) {
      // Convert inHg to hPa approx (1 inHg = 33.86 hPa)
      result.qnh = Math.round(parseInt(part.substring(1)) / 100 * 33.8639);
      continue;
    }
    
    // Visibility: 5000, 9999, CAVOK
    if (part === 'CAVOK') {
      result.visibility = 'CAVOK (> 10 km)';
      result.clouds.push('Clear details (CAVOK)');
      continue;
    }
    if (part.match(/^\d{4}$/)) {
      if (part === '9999') result.visibility = '> 10 km';
      else result.visibility = `${parseInt(part)} m`;
      continue;
    }
    
    // Clouds: FEW010, SCT020, BKN030, OVC040, NSC, NCD
    const cloudMatch = part.match(/^(FEW|SCT|BKN|OVC|NSC|NCD|VV)(\d{3})?(CB|TCU)?$/);
    if (cloudMatch) {
      let desc = cloudMatch[1] ?? '';
      const map: Record<string, string> = { FEW: 'Few', SCT: 'Scattered', BKN: 'Broken', OVC: 'Overcast', NSC: 'No Sig Clouds', NCD: 'No Clouds', VV: 'Vertical Vis' };
      desc = map[desc] || desc;
      if (cloudMatch[2]) desc += ` at ${parseInt(cloudMatch[2]) * 100} ft`;
      if (cloudMatch[3]) desc += ` (${cloudMatch[3]})`;
      result.clouds.push(desc);
      continue;
    }
  }
  
  if (result.clouds.length === 0) result.clouds.push("No cloud detected");
  
  return result;
}

// --- COMPONENT ---
export default function TerminalDashboard({ icaoCode }: { icaoCode: string }) {
  const [activeTab, setActiveTab] = useState<'CONDITIONS' | 'METAR' | 'TAF' | 'NOTAM'>('CONDITIONS');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [notams, setNotams] = useState<NotamData[]>([]);
  const [daylight, setDaylight] = useState<DaylightRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Focus today for daylight
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!icaoCode) return;
    // Clear previous data for instantaneous snappy feedback
    setWeather(null);
    setNotams([]);
    setDaylight(null);
    setLoading(true);
    
    const controller = new AbortController();
    const signal = controller.signal;
    let pending = 3;
    const maybeFinish = () => { if (--pending === 0) setLoading(false); };

    // Fetch independently so the dashboard populates progressively
    fetch(`/api/weather/${icaoCode}`, { signal })
      .then(r => r.ok ? r.json() : null)
      .then(w => { if (!signal.aborted && w) setWeather(w); })
      .catch(() => {})
      .finally(maybeFinish);

    fetch(`/api/notams/${icaoCode}?active_only=true`, { signal })
      .then(r => r.ok ? r.json() : [])
      .then(n => { if (!signal.aborted) setNotams(n); })
      .catch(() => {})
      .finally(maybeFinish);

    fetch(`/api/daylight/${icaoCode}?date=${todayStr}`, { signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!signal.aborted) setDaylight(d?.records?.[0] || null); })
      .catch(() => {})
      .finally(maybeFinish);

    return () => { controller.abort(); };
  }, [icaoCode, todayStr]);

  const parsedMetar = useMemo(() => parseMetar(weather?.metar || null), [weather]);

  // Handle Escape key to collapse if expanded
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCollapsed) {
        setIsCollapsed(true);
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => { window.removeEventListener('keydown', handleKeyDown, true); };
  }, [isCollapsed]);

  // Handle Outside Click to collapse if expanded
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only collapse if it's currently expanded AND the click is completely outside
      if (!isCollapsed && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsCollapsed(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [isCollapsed]);

  const tabs: Array<{ id: 'CONDITIONS' | 'METAR' | 'TAF' | 'NOTAM', icon: any, label: string, badge?: number }> = [
    { id: 'CONDITIONS', icon: CloudFog, label: 'CONDITIONS' },
    { id: 'METAR', icon: CloudRain, label: 'METAR' },
    { id: 'TAF', icon: CloudRain, label: 'TAF' },
    { id: 'NOTAM', icon: AlertTriangle, label: 'NOTAM', badge: notams.length },
  ];

  return (
    <motion.div 
      ref={containerRef}
      initial={{ x: 500, opacity: 0 }}
      animate={{ 
        opacity: 1,
        x: isCollapsed ? 500 : 0 
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      exit={{ x: 500, opacity: 0 }}
      className="h-fit max-h-[calc(100vh-22rem)] flex pointer-events-none"
    >
      {/* SIDEBAR TABS / TOGGLE HANDLE */}
      <motion.div 
        animate={{ width: isCollapsed ? 38 : 78 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-zinc-950/90 border border-zinc-800/60 rounded-3xl flex flex-col items-center relative shrink-0 z-20 pointer-events-auto overflow-hidden glass-morphism-heavy shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]"
      >
        {/* The Toggle Handle Wrapper */}
        <button 
          onClick={() => { setIsCollapsed(!isCollapsed); }}
          className={`absolute top-0 bottom-0 left-0 w-full group/handle flex flex-col items-center justify-center transition-colors ${isCollapsed ? 'hover:bg-cyan-500/5 cursor-pointer' : 'pointer-events-none'}`}
          title={isCollapsed ? "Expand Dashboard" : ""}
        >
          {isCollapsed && (
            <div className="flex flex-col items-center gap-4 py-8 h-full">
              <ChevronLeft size={16} className="text-cyan-400 group-hover/handle:scale-125 transition-transform" />
              <div className="text-[10px] font-black text-white/40 tracking-[0.4em] uppercase [writing-mode:vertical-lr] rotate-180 flex-1 flex items-center justify-center">
                DASHBOARD
              </div>
              <ChevronLeft size={16} className="text-cyan-400 group-hover/handle:scale-125 transition-transform" />
            </div>
          )}
        </button>


        
        {!isCollapsed && tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <div 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); }}
              className={`relative flex flex-col items-center justify-center w-full py-4 cursor-pointer transition-all duration-300 ${isActive ? 'text-cyan-400 border-l-2 border-cyan-400 bg-cyan-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
            >
              <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] font-bold tracking-[0.1em] mt-2 text-center px-1">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && typeof tab.badge === 'number' && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center shadow-lg shadow-amber-500/20">
                  {tab.badge}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* MAIN CONTENT AREA */}
      <motion.div 
        animate={{ 
          opacity: isCollapsed ? 0 : 1 
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`bg-zinc-900/40 relative flex flex-col shrink-0 w-[500px] border border-l-0 border-zinc-800/60 rounded-r-3xl glass-morphism-heavy shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] z-10 ${isCollapsed ? 'pointer-events-none' : 'pointer-events-auto'}`}
        style={{ marginLeft: -16, paddingLeft: 16 }}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-t-2 border-cyan-400 border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="p-6 h-full overflow-y-auto aip-scrollbar w-[500px]">
            <AnimatePresence mode="wait">
                {activeTab === 'CONDITIONS' && (
                  <motion.div key="conditions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
                    {/* ... nested content ... */}
                    <div className="flex justify-between items-end mb-1">
                      <div>
                        <h2 className="text-2xl font-black text-white tracking-widest">{icaoCode}</h2>
                        <p className="text-zinc-500 text-[10px] tracking-[0.2em] uppercase mt-1">Current Conditions</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-6">
                      {/* WIDGET: WIND */}
                      <div className="col-span-12 md:col-span-6 bg-zinc-950/60 rounded-2xl p-5 border border-zinc-800/50 flex flex-col justify-between">
                        <div className="flex items-center gap-3">
                          <Wind className="text-cyan-400" size={20} />
                          <span className="text-lg font-bold text-white">
                            {parsedMetar.windDir ? `${parsedMetar.windDir}°T` : 'VRB'} {parsedMetar.windSpeed ? `${parsedMetar.windSpeed} ${parsedMetar.windUnit || 'kt'}` : '- kt'}
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
                               <span className="font-bold text-base text-white">{parsedMetar.windDir === 'VRB' ? 'VRB' : (parsedMetar.windDir ? `${parsedMetar.windDir}°` : '-')}</span>
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
                                style={{ width: parsedMetar.visibility.includes('>') ? '100%' : `${Math.min(parseInt(parsedMetar.visibility) / 10000 * 100, 100)}%` }} 
                              />
                            )}
                          </div>
                        </div>

                        <div className="bg-zinc-950/60 rounded-2xl p-5 border border-zinc-800/50 flex items-center gap-4">
                          <Cloud className="text-cyan-400" size={24} />
                          <div className="flex flex-col">
                            {parsedMetar.clouds.map((c, i) => (
                              <span key={i} className="text-sm font-semibold text-white">{c}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* WIDGET: TEMP & DEWPOINT */}
                      <div className="col-span-6 md:col-span-3 bg-zinc-950/60 rounded-2xl p-4 border border-zinc-800/50 flex flex-col items-center">
                         <Thermometer className="text-cyan-400 mb-1" size={18} />
                         <div className="text-xl font-bold text-white">{parsedMetar.temp !== null ? `${parsedMetar.temp}°C` : '-'}</div>
                         <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Temp</span>
                      </div>
                      
                      <div className="col-span-6 md:col-span-3 bg-zinc-950/60 rounded-2xl p-4 border border-zinc-800/50 flex flex-col items-center">
                         <CloudFog className="text-cyan-400 mb-1" size={18} />
                         <div className="text-xl font-bold text-white">{parsedMetar.dew !== null ? `${parsedMetar.dew}°C` : '-'}</div>
                         <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Dew</span>
                      </div>

                      {/* WIDGET: QNH */}
                      <div className="col-span-12 md:col-span-6 bg-zinc-950/60 rounded-2xl p-4 border border-zinc-800/50 flex flex-col items-center justify-center">
                         <Compass className="text-cyan-400 mb-1" size={20} />
                         <div className="text-2xl font-black text-white">{parsedMetar.qnh !== null ? `${parsedMetar.qnh} hPa` : '-'}</div>
                         <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">QNH Pressure</span>
                      </div>

                      {/* WIDGET: DAYLIGHT TABLES */}
                      <div className="col-span-12 bg-zinc-950/60 rounded-2xl p-5 border border-zinc-800/50">
                         <div className="flex justify-between mb-4">
                           <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Daylight Information</span>
                           <span className="text-[10px] text-zinc-500 font-bold tracking-widest tabular-nums">{todayStr}</span>
                         </div>
                         
                         <div className="flex justify-between items-center px-2">
                            <div className="flex flex-col items-center gap-1.5">
                               <Sunrise size={22} className="text-amber-400" />
                               <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">MCT</span>
                               <span className="text-base font-bold text-white tabular-nums">{daylight?.twilight_from || '-'}</span>
                            </div>
                            
                            <div className="flex flex-col items-center gap-1.5">
                               <Sun size={22} className="text-amber-500" />
                               <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Sunrise</span>
                               <span className="text-base font-bold text-white tabular-nums">{daylight?.sunrise || '-'}</span>
                            </div>
                            
                            <div className="flex flex-col items-center gap-1.5">
                               <Sunset size={22} className="text-orange-500" />
                               <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Sunset</span>
                               <span className="text-base font-bold text-white tabular-nums">{daylight?.sunset || '-'}</span>
                            </div>
                            
                            <div className="flex flex-col items-center gap-1.5">
                               <Moon size={22} className="text-indigo-400" />
                               <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">ECT</span>
                               <span className="text-base font-bold text-white tabular-nums">{daylight?.twilight_to || '-'}</span>
                            </div>
                         </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'METAR' && (
                  <motion.div key="metar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full gap-4">
                    <h3 className="text-xl font-black text-white tracking-widest mb-4 flex items-center gap-2"><CloudRain className="text-cyan-400"/> LATEST METAR</h3>
                    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/50 grow">
                      {weather?.metar ? (
                        <p className="text-lg text-emerald-400 font-mono leading-relaxed">{weather.metar}</p>
                      ) : (
                        <p className="text-zinc-500 italic">No METAR data available.</p>
                      )}
                      {weather?.fetched_at && (
                         <p className="text-xs text-zinc-600 font-mono mt-6">Fetched (UTC): {new Date(weather.fetched_at).toISOString()}</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'TAF' && (
                  <motion.div key="taf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full gap-4">
                    <h3 className="text-xl font-black text-white tracking-widest mb-4 flex items-center gap-2"><CloudRain className="text-cyan-400"/> LATEST TAF</h3>
                    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/50 grow overflow-y-auto">
                      {weather?.taf && weather.taf.length > 0 ? (
                        weather.taf.map((tGroup, i) => (
                          <div key={i} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-0 border-zinc-800/50">
                            {tGroup.map((line, j) => (
                              <p key={j} className={`text-md font-mono ${j===0 ? 'text-amber-400 font-bold' : 'text-zinc-300 ml-4'} mb-1`}>{line}</p>
                            ))}
                          </div>
                        ))
                      ) : (
                        <p className="text-zinc-500 italic">No TAF data available.</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'NOTAM' && (
                  <motion.div key="notam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full gap-4">
                    <h3 className="text-xl font-black text-white tracking-widest mb-4 flex items-center gap-2">
                      <AlertTriangle className="text-amber-500"/> ACTIVE NOTAMS
                      <span className="bg-zinc-800 text-xs px-3 py-1 rounded-full ml-auto">{notams.length} Total</span>
                    </h3>
                    <div className="flex flex-col gap-4 overflow-y-auto pb-6">
                      {notams.length > 0 ? (
                        notams.map(n => (
                          <div key={n.notam_id} className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/50 hover:border-zinc-700 transition">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-amber-400 font-bold tracking-widest text-sm flex items-center gap-2">
                                {n.notam_id}
                                {n.scope && <span className="text-[9px] bg-zinc-800 text-amber-500 px-1.5 py-0.5 rounded">{n.scope}</span>}
                              </span>
                              <div className="flex items-center gap-2">
                                {n.is_estimated && <span className="text-[10px] text-zinc-400 font-mono">EST</span>}
                                <span className="text-xs text-zinc-500 font-mono tracking-widest">SERIES {n.series}</span>
                              </div>
                            </div>
                            <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{n.description}</p>
                            <div className="mt-4 pt-3 border-t border-zinc-800/50 flex justify-between text-[10px] text-zinc-500 font-mono tracking-widest">
                              <span>FROM: {n.valid_from ? new Date(n.valid_from).toISOString().replace('.000Z', 'Z') : 'UNKNOWN'}</span>
                              <span>TO: {n.is_permanent ? 'PERM' : (n.valid_to ? new Date(n.valid_to).toISOString().replace('.000Z', 'Z') : 'UNKNOWN')}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/50 text-center">
                          <p className="text-zinc-500 italic">No active NOTAMs found.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
    </motion.div>
  );
}
