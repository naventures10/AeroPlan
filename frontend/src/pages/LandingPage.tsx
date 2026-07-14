import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router';
import {
  Plane,
  Map as MapIcon,
  ChevronRight,
  Sun,
  Moon,
  CloudSun,
  Route,
  FileText,
  Radar,
} from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { useState, useEffect, useCallback } from 'react';

/* ─── Data ──────────────────────────────────────────────────────────────────── */

/** Waypoints/Fixes distributed across a 1920x1080 canvas for the background flight network. */
const WAYPOINTS = [
  { id: 'IKULA', x: 350, y: 250, label: 'IKULA' },
  { id: 'POMAR', x: 960, y: 250, label: 'POMAR' },
  { id: 'INDBA', x: 1570, y: 250, label: 'INDBA' },
  { id: 'DABOL', x: 350, y: 550, label: 'DABOL' },
  { id: 'MABAS', x: 960, y: 550, label: 'MABAS' },
  { id: 'LURAA', x: 1570, y: 550, label: 'LURAA' },
  { id: 'BIBGO', x: 350, y: 850, label: 'BIBGO' },
  { id: 'ASOGI', x: 960, y: 850, label: 'ASOGI' },
  { id: 'GIVAL', x: 1570, y: 850, label: 'GIVAL' },
  { id: 'SAPAR', x: 655, y: 400, label: 'SAPAR' },
  { id: 'VUTAS', x: 1265, y: 700, label: 'VUTAS' },
] as const;

/** Straight airway corridors connecting coordinates. */
const NETWORK_PATHS = [
  { path: 'M -100 250 L 2020 250', duration: '18s', delay: '0s' },
  { path: 'M 2020 550 L -100 550', duration: '20s', delay: '3s' },
  { path: 'M -100 850 L 2020 850', duration: '19s', delay: '1.5s' },
  { path: 'M 350 -100 L 350 1180', duration: '15s', delay: '2s' },
  { path: 'M 960 1180 L 960 -100', duration: '17s', delay: '0.5s' },
  { path: 'M 1570 -100 L 1570 1180', duration: '16s', delay: '4s' },
  { path: 'M -100 -50 L 2020 1010', duration: '22s', delay: '1s' },
  { path: 'M 2020 70 L -100 1130', duration: '24s', delay: '2.5s' },
] as const;

const FEATURES = [
  {
    icon: MapIcon,
    title: 'Interactive AIP Map',
    description: 'Real-time airspace visualization with multi-layer overlays and 3D terrain',
  },
  {
    icon: CloudSun,
    title: 'Weather Intelligence',
    description: 'Live METAR, TAF, SIGMET overlays with animated wind & precipitation layers',
  },
  {
    icon: FileText,
    title: 'Aerodrome Charts',
    description: 'Terminal procedures, SID/STAR charts, and aerodrome ground layouts',
  },
  {
    icon: Route,
    title: 'Route Navigation',
    description: 'ATS routes, RNAV procedures, waypoint search, and navaid details',
  },
] as const;

const TYPEWRITER_PHRASES = [
  'Real-time AIP Visualization',
  'Live METAR & TAF Overlays',
  'Terminal Procedure Charts',
  'Airspace & Route Intelligence',
  'Next-Gen Flight Planning',
] as const;

/* ─── Sub-Components ────────────────────────────────────────────────────────── */

/** Fullscreen structured airway network with straight moving aircraft symbols. */
function FlightNetworkSVG() {
  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Flight Network Airway Corridors */}
      {NETWORK_PATHS.map((item, idx) => (
        <path
          key={`path-${idx}`}
          d={item.path}
          stroke="var(--accent-cyan)"
          strokeWidth="1.2"
          strokeOpacity="0.25"
          fill="none"
        />
      ))}

      {/* Travelling Flight Dots */}
      {NETWORK_PATHS.map((item, idx) => (
        <g key={`dot-${idx}`}>
          {/* Outer faint halo */}
          <circle r="12" fill="var(--accent-cyan)" opacity="0.35" filter="url(#glow-filter)" />
          {/* Inner core */}
          <circle r="3" fill="var(--accent-cyan)" opacity="1" />
          <animateMotion
            path={item.path}
            dur={item.duration}
            begin={item.delay}
            repeatCount="indefinite"
          />
        </g>
      ))}

      {/* Waypoint Nodes (Aeronautical Intersections) */}
      {WAYPOINTS.map((wp) => (
        <g key={wp.id}>
          {/* Triangluar waypoint symbol standard in aviation charts */}
          <polygon
            points={`${wp.x},${wp.y - 7} ${wp.x - 7},${wp.y + 5} ${wp.x + 7},${wp.y + 5}`}
            stroke="var(--accent-cyan)"
            strokeWidth="1.2"
            strokeOpacity="0.7"
            fill="none"
          />
          {/* Pulsing visual indicator inside fix */}
          <circle
            cx={wp.x}
            cy={wp.y + 1}
            r="1.5"
            fill="var(--accent-cyan)"
            className="landing-dot-pulse"
            style={{ transformOrigin: `${wp.x}px ${wp.y + 1}px` }}
          />
          {/* Waypoint Label */}
          <text
            x={wp.x}
            y={wp.y + 20}
            fill="var(--accent-cyan)"
            fontSize="9"
            fontWeight="bold"
            letterSpacing="1.5"
            opacity="0.6"
            textAnchor="middle"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {wp.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Typewriter effect that cycles through capability phrases. */
function TypewriterSubtitle() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const tick = useCallback(() => {
    const currentPhrase = TYPEWRITER_PHRASES[phraseIndex];
    if (!currentPhrase) return;
    if (!isDeleting) {
      // Typing
      setDisplayText(currentPhrase.slice(0, displayText.length + 1));
      if (displayText.length + 1 === currentPhrase.length) {
        // Pause at end of phrase before deleting
        setTimeout(() => setIsDeleting(true), 2000);
        return;
      }
    } else {
      // Deleting
      setDisplayText(currentPhrase.slice(0, displayText.length - 1));
      if (displayText.length - 1 === 0) {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % TYPEWRITER_PHRASES.length);
        return;
      }
    }
  }, [displayText, isDeleting, phraseIndex]);

  useEffect(() => {
    const speed = isDeleting ? 40 : 70;
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [tick, isDeleting]);

  return (
    <span className="text-on-surface-variant text-lg md:text-xl font-light tracking-wide">
      {displayText}
      <span className="landing-cursor-blink text-accent-cyan ml-0.5">|</span>
    </span>
  );
}

/** Auto-rotating feature carousel with glassmorphism cards. */
function FeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % FEATURES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-3xl">
      {/* Card display area */}
      <div className="relative w-full h-28 md:h-24">
        <AnimatePresence mode="wait">
          {FEATURES.map(
            (feature, index) =>
              index === activeIndex && (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="absolute inset-0 glass-morphism-heavy rounded-2xl p-5 md:p-6 flex items-center gap-5 landing-glow-pulse"
                >
                  <div className="w-12 h-12 min-w-12 rounded-xl bg-[var(--accent-cyan-opacity-20)] flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-[var(--accent-cyan)]" />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="text-on-surface font-bold text-base tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ),
          )}
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-2">
        {FEATURES.map((feature, index) => (
          <button
            key={feature.title}
            onClick={() => setActiveIndex(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === activeIndex
                ? 'bg-[var(--accent-cyan)] w-6'
                : 'bg-[var(--accent-cyan-opacity-30)] hover:bg-[var(--accent-cyan-opacity-20)]'
            }`}
            aria-label={`Show ${feature.title}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Theme toggle button using the existing map store. */
function ThemeToggle() {
  const isDarkMode = useMapStore((s) => s.isDarkMode);
  const setMapStyle = useMapStore((s) => s.setMapStyle);

  const toggle = () => {
    setMapStyle(isDarkMode ? 'light' : 'dark');
  };

  return (
    <motion.button
      onClick={toggle}
      className="fixed top-6 right-6 z-50 w-11 h-11 rounded-full glass-morphism-heavy flex items-center justify-center hover:scale-110 transition-transform"
      aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
      whileTap={{ scale: 0.9 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isDarkMode ? 'moon' : 'sun'}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {isDarkMode ? (
            <Moon className="w-5 h-5 text-on-surface-variant" />
          ) : (
            <Sun className="w-5 h-5 text-on-surface-variant" />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

/**
 * Premium Landing Page for AeroInfo.
 * Features animated SVG globe, typewriter subtitle, feature carousel,
 * and dark/light theme toggle.
 */
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden flex items-center justify-center font-sans">
      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Ambient Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[var(--accent-cyan-opacity-10)] rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[var(--accent-cyan-opacity-10)] rounded-full blur-[100px] animate-pulse-slow" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent-cyan-opacity-10)] rounded-full blur-[180px] opacity-30" />

      {/* Fullscreen Flight Network Background */}
      <div className="absolute inset-0 opacity-60 pointer-events-none w-full h-full">
        <FlightNetworkSVG />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 gap-6 max-w-2xl w-full">
        {/* Logo Icon */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="landing-float"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--accent-cyan-700)] to-[var(--accent-cyan-500)] rounded-2xl flex items-center justify-center shadow-lg glow-accent-strong">
            <Radar className="text-white w-8 h-8" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-on-surface text-5xl md:text-7xl font-bold tracking-tighter"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Aero
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(135deg, var(--accent-cyan-500), var(--accent-cyan-300))',
            }}
          >
            Info
          </span>
        </motion.h1>

        {/* Typewriter Subtitle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="h-8 flex items-center justify-center"
        >
          <TypewriterSubtitle />
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <button
            id="launch-app-btn"
            onClick={() => navigate('/app')}
            className="bg-[var(--accent-cyan-700)] hover:bg-[var(--accent-cyan-800)] text-white font-bold px-8 h-14 rounded-xl transition-all flex items-center justify-center gap-2.5 group text-lg glow-accent shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plane className="w-5 h-5 -rotate-45" />
            Launch Application
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* Feature Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.6 }}
          className="w-full mt-4"
        >
          <FeatureCarousel />
        </motion.div>
      </div>

      {/* Footer Tag */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.5 }}
        className="absolute bottom-6 text-on-surface-variant text-[10px] uppercase tracking-[0.3em] font-bold"
      >
        Next-Gen Aviation Intelligence
      </motion.div>
    </div>
  );
}
