import { useEffect, useState, useRef } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import { Activity, Layers, Zap } from 'lucide-react';

declare global {
  interface Window {
    startFPSProfiling?: () => void;
    stopFPSProfiling?: () => {
      averageFps: number;
      minimumFps: number;
      maxFrameTimeMs: number;
      droppedFramesPercent30fps: number;
      totalFrames: number;
      durationMs: number;
      activeLayers: Record<string, boolean>;
    } | null;
  }
}

interface FPSProfile {
  active: boolean;
  startTime: number;
  frameCount: number;
  frameTimes: number[];
  lastFrameTime: number;
}

export default function PerformanceOverlay() {
  const activeLayers = useMapStore((state) => state.activeLayers);
  const viewMode = useMapStore((state) => state.viewMode);

  const [fps, setFps] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  // References for FPS calculation
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Reference for automated profiling
  const profilingRef = useRef<FPSProfile>({
    active: false,
    startTime: 0,
    frameCount: 0,
    frameTimes: [],
    lastFrameTime: 0,
  });

  // 1. Check if ?perf query parameter is present or if we are in development mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasPerfParam = params.has('perf');
    const isDev = import.meta.env.DEV;
    setIsVisible(hasPerfParam || isDev);
  }, []);

  // 2. Setup standard requestAnimationFrame loop and register global profiling hooks
  useEffect(() => {
    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      frameCountRef.current++;

      // Real-time HUD FPS update (every 500ms)
      const delta = now - lastTimeRef.current;
      if (delta >= 500) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      // Automated Profiler updates
      const prof = profilingRef.current;
      if (prof.active) {
        prof.frameCount++;
        if (prof.lastFrameTime > 0) {
          const frameInterval = now - prof.lastFrameTime;
          prof.frameTimes.push(frameInterval);
        }
        prof.lastFrameTime = now;
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    // Register profiling functions to window object
    window.startFPSProfiling = () => {
      profilingRef.current = {
        active: true,
        startTime: performance.now(),
        frameCount: 0,
        frameTimes: [],
        lastFrameTime: performance.now(),
      };
      console.log('[Performance Profiler] Profiling started.');
    };

    window.stopFPSProfiling = () => {
      const prof = profilingRef.current;
      if (!prof.active) {
        console.warn('[Performance Profiler] Profiler was not active.');
        return null;
      }

      prof.active = false;
      const duration = performance.now() - prof.startTime;
      const avgFps = duration > 0 ? (prof.frameCount * 1000) / duration : 0;

      // Extract individual frame rates to find minimum
      const frameRates = prof.frameTimes.map((t) => 1000 / t);
      const minFps = frameRates.length > 0 ? Math.min(...frameRates) : 0;
      const maxFrameTime = prof.frameTimes.length > 0 ? Math.max(...prof.frameTimes) : 0;

      // Dropped frames: frames taking longer than 33.3ms (representing a drop below 30 FPS target)
      const droppedFramesCount = prof.frameTimes.filter((t) => t > 33.33).length;
      const droppedFramesPercent =
        prof.frameTimes.length > 0 ? (droppedFramesCount / prof.frameTimes.length) * 100 : 0;

      const currentLayers = useMapStore.getState().activeLayers;

      const summary = {
        averageFps: Number(avgFps.toFixed(1)),
        minimumFps: Number(minFps.toFixed(1)),
        maxFrameTimeMs: Number(maxFrameTime.toFixed(1)),
        droppedFramesPercent30fps: Number(droppedFramesPercent.toFixed(1)),
        totalFrames: prof.frameCount,
        durationMs: Number(duration.toFixed(1)),
        activeLayers: currentLayers,
      };

      console.log('[Performance Profiler] Profiling results:', summary);
      return summary;
    };

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      window.startFPSProfiling = undefined;
      window.stopFPSProfiling = undefined;
    };
  }, []);

  if (!isVisible) return null;

  // Determine color coding based on current FPS
  let fpsColorClass = 'text-emerald-400';
  let fpsBgIndicator = 'bg-emerald-400 shadow-[0_0_8px_#34d399]';
  if (fps < 30) {
    fpsColorClass = 'text-rose-400 animate-pulse';
    fpsBgIndicator = 'bg-rose-400 shadow-[0_0_8px_#f43f5e]';
  } else if (fps < 55) {
    fpsColorClass = 'text-amber-400';
    fpsBgIndicator = 'bg-amber-400 shadow-[0_0_8px_#fbbf24]';
  }

  // Gather active layer names for display
  const layersList = Object.entries(activeLayers)
    .filter(([name, active]) => name && active)
    .map(([name]) => {
      if (name === 'atsRoutes') return 'ATS Routes';
      if (name.startsWith('airspace') && name !== 'airspaces') return null; // skip sub-layers
      return name.charAt(0).toUpperCase() + name.slice(1);
    })
    .filter(Boolean) as string[];

  return (
    <div className="absolute top-16 right-4 z-50 pointer-events-none flex flex-col items-end gap-2.5">
      {/* Mini FPS HUD */}
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 px-3.5 py-2.5 backdrop-blur-xl shadow-lg">
        <Activity className={`h-4 w-4 ${fpsColorClass}`} />
        <span className="font-mono text-lg font-bold text-white leading-none">{fps}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">FPS</span>
        <span className={`h-1.5 w-1.5 rounded-full ${fpsBgIndicator}`} />
      </div>

      {/* Active Diagnostics Drawer */}
      <div className="w-56 rounded-2xl border border-white/10 bg-black/60 p-3.5 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-white/5 pb-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/40">
          <Layers className="h-3 w-3" />
          Layer Diagnostics
        </div>

        <div className="mt-2.5 space-y-2">
          <div className="flex items-center justify-between text-[10px] text-white/60">
            <span className="font-medium">Mode:</span>
            <span className="font-mono text-[9px] font-bold text-cyan-400 uppercase bg-cyan-950/40 border border-cyan-800/30 px-1.5 py-0.5 rounded">
              {viewMode}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/30">
              Active Layers ({layersList.length})
            </div>
            {layersList.length === 0 ? (
              <div className="text-[10px] text-white/30 italic">No layers loaded</div>
            ) : (
              <div className="flex flex-wrap gap-1 mt-1">
                {layersList.map((layer) => (
                  <span
                    key={layer}
                    className="text-[9px] font-medium text-emerald-400/90 bg-emerald-950/30 border border-emerald-900/30 px-1.5 py-0.5 rounded flex items-center gap-1"
                  >
                    <Zap className="h-2 w-2" />
                    {layer}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
