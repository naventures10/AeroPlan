/**
 * WindTestPage — Isolated sandbox for testing WeatherLayers GL ParticleLayer.
 *
 * Route: /wind-test
 *
 * Renders an animated wind-particle layer over India (bbox 65°E–100°E, 5°N–40°N)
 * using the COG GeoTIFF produced by the backend weather pipeline.
 *
 * No production store / hooks — fully self-contained for rapid iteration.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { MapController } from '@deck.gl/core';
import Map from 'react-map-gl/maplibre';
import { ClipExtension } from '@deck.gl/extensions';
import * as WeatherLayers from 'weatherlayers-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;

/** GeoTIFF data bounds matching the GDAL crop: [minLon, minLat, maxLon, maxLat] */
const WIND_BOUNDS: [number, number, number, number] = [65, 5, 100, 40];

/** Clip slightly outside bounds so particles don't get clipped at exact edge */
const CLIP_BOUNDS: [number, number, number, number] = [64.5, 4.5, 100.5, 40.5];

/** Centre of India for initial view */
const INITIAL_VIEW_STATE = {
  longitude: 82.5,
  latitude: 22.5,
  zoom: 4.5,
  pitch: 0,
  bearing: 0,
};

const DECK_CONTROLLER = { type: MapController };

// Wind-speed palette: calm (blue) → fast (red), matching meteorological convention
const WIND_PALETTE = `
0   #3288bd
5   #66c2a5
10  #abdda4
15  #e6f598
20  #fee08b
25  #fdae61
30  #f46d43
40  #d53e4f
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface WindStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  validTime?: string;
}

export default function WindTestPage() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [windImage, setWindImage] = useState<WeatherLayers.TextureData | null>(null);
  const [status, setStatus] = useState<WindStatus>({ state: 'idle' });
  const [numParticles, setNumParticles] = useState(5000);
  const [maxAge, setMaxAge] = useState(80);
  const [speedFactor, setSpeedFactor] = useState(0.5);
  const [fadeOpacity, setFadeOpacity] = useState(0.96); // Default to a higher value for visible trails
  const [particleWidth, setParticleWidth] = useState(2);
  const [selectedAltitude, setSelectedAltitude] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // ── Hide global loader ─────────────────────────────────────────────────────
  useEffect(() => {
    // @ts-expect-error - native global from index.html
    if (window.hideLoader) window.hideLoader();
  }, []);

  // ── Load weather data ──────────────────────────────────────────────────────
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    async function load() {
      setStatus({ state: 'loading', message: 'Fetching manifest…' });
      try {
        // 1. Read manifest to find current GeoTIFF
        const manifestRes = await fetch('/weather/weather_manifest.json', {
          signal: controller.signal,
        });
        if (!manifestRes.ok) throw new Error(`Manifest fetch failed: ${manifestRes.status}`);
        const manifest = await manifestRes.json();

        const levelKey =
          selectedAltitude === 0
            ? 'wind_surface'
            : `wind_${String(selectedAltitude).padStart(3, '0')}`;
        const layerData = manifest[levelKey];
        if (!layerData) throw new Error(`Data for altitude ${levelKey} not found in manifest`);

        const { url, valid_time } = layerData as {
          url: string;
          valid_time: string;
        };

        setStatus({ state: 'loading', message: `Loading GeoTIFF: ${url}` });

        // 2. Load GeoTIFF via WeatherLayers helper (reads bands, returns TextureData)
        const image = await WeatherLayers.loadTextureData(url);
        if (controller.signal.aborted) return;

        setWindImage(image);
        setStatus({
          state: 'ready',
          validTime: valid_time,
          message: `Data valid: ${new Date(valid_time).toUTCString()}`,
        });
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
        console.error('[WindTestPage] Load error:', err);
        setStatus({
          state: 'error',
          message: String(err instanceof Error ? err.message : err),
        });
      }
    }

    load();
    return () => controller.abort();
  }, [selectedAltitude]);

  // ── Build DeckGL layers ────────────────────────────────────────────────────
  const layers = windImage
    ? [
        new WeatherLayers.ParticleLayer({
          id: 'wind-particles',
          // Data
          image: windImage,
          bounds: WIND_BOUNDS,
          // Particle behaviour
          numParticles,
          maxAge,
          speedFactor,
          fadeOpacity,
          // Style
          width: particleWidth,
          palette: WIND_PALETTE,
          // Clip to data bbox to prevent wrapping artefacts
          extensions: [new ClipExtension()],
          clipBounds: CLIP_BOUNDS,
        }),
      ]
    : [];

  const onViewStateChange = useCallback(
    ({ viewState: vs }: { viewState: typeof INITIAL_VIEW_STATE }) => {
      setViewState(vs);
    },
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="wind-test-root">
      {/* ── Map canvas ── */}
      <DeckGL
        viewState={viewState}
        controller={DECK_CONTROLLER}
        layers={layers}
        onViewStateChange={onViewStateChange as any}
      >
        <Map mapStyle={MAP_STYLE} reuseMaps />
      </DeckGL>

      {/* ── Status badge ── */}
      <StatusBadge status={status} />

      {/* ── Control panel ── */}
      <ControlPanel
        numParticles={numParticles}
        maxAge={maxAge}
        speedFactor={speedFactor}
        fadeOpacity={fadeOpacity}
        particleWidth={particleWidth}
        selectedAltitude={selectedAltitude}
        onNumParticlesChange={setNumParticles}
        onMaxAgeChange={setMaxAge}
        onSpeedFactorChange={setSpeedFactor}
        onFadeOpacityChange={setFadeOpacity}
        onParticleWidthChange={setParticleWidth}
        onAltitudeChange={setSelectedAltitude}
      />

      {/* ── Legend ── */}
      <WindLegend />

      {/* ── Page title ── */}
      <header className="wind-test-header">
        <span className="wind-test-header-badge">DEV</span>
        WeatherLayers GL — Wind Particle Test
      </header>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WindStatus }) {
  const stateClass = {
    idle: 'status--idle',
    loading: 'status--loading',
    ready: 'status--ready',
    error: 'status--error',
  }[status.state];

  return (
    <div className={`wind-status ${stateClass}`}>
      <span className="wind-status__dot" />
      <span className="wind-status__text">
        {status.state === 'loading' && '⟳ '}
        {status.message || status.state}
      </span>
    </div>
  );
}

interface ControlPanelProps {
  numParticles: number;
  maxAge: number;
  speedFactor: number;
  fadeOpacity: number;
  particleWidth: number;
  selectedAltitude: number;
  onNumParticlesChange: (v: number) => void;
  onMaxAgeChange: (v: number) => void;
  onSpeedFactorChange: (v: number) => void;
  onFadeOpacityChange: (v: number) => void;
  onParticleWidthChange: (v: number) => void;
  onAltitudeChange: (v: number) => void;
}

function ControlPanel({
  numParticles,
  maxAge,
  speedFactor,
  fadeOpacity,
  particleWidth,
  selectedAltitude,
  onNumParticlesChange,
  onMaxAgeChange,
  onSpeedFactorChange,
  onFadeOpacityChange,
  onParticleWidthChange,
  onAltitudeChange,
}: ControlPanelProps) {
  const formatAltitude = (alt: number) => {
    if (alt === 0) return 'Surface';
    if (alt < 5) return `${alt * 1000} ft`;
    return `FL${String(alt * 10).padStart(3, '0')}`;
  };

  return (
    <aside className="wind-controls">
      <h3 className="wind-controls__title">🎛 Particle Controls</h3>

      <SliderRow
        label="Altitude"
        value={selectedAltitude}
        min={0}
        max={39}
        step={1}
        display={formatAltitude(selectedAltitude)}
        onChange={onAltitudeChange}
      />

      <SliderRow
        label="Particles"
        value={numParticles}
        min={500}
        max={20000}
        step={500}
        display={numParticles.toLocaleString()}
        onChange={onNumParticlesChange}
      />
      <SliderRow
        label="Max Age"
        value={maxAge}
        min={10}
        max={1000}
        step={10}
        display={`${maxAge} frames`}
        onChange={onMaxAgeChange}
      />
      <SliderRow
        label="Speed Factor"
        value={speedFactor}
        min={0.05}
        max={3.0}
        step={0.05}
        display={speedFactor.toFixed(2)}
        onChange={onSpeedFactorChange}
      />
      <SliderRow
        label="Trail Persistence"
        value={fadeOpacity}
        min={0.8}
        max={0.99}
        step={0.005}
        display={`${(fadeOpacity * 100).toFixed(1)}%`}
        onChange={onFadeOpacityChange}
      />
      <SliderRow
        label="Line Width"
        value={particleWidth}
        min={1}
        max={6}
        step={0.5}
        display={`${particleWidth}px`}
        onChange={onParticleWidthChange}
      />
    </aside>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="wind-slider">
      <div className="wind-slider__header">
        <span className="wind-slider__label">{label}</span>
        <span className="wind-slider__value">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="wind-slider__input"
      />
    </div>
  );
}

function WindLegend() {
  const stops = [
    { speed: 0, color: '#3288bd', label: 'Calm' },
    { speed: 10, color: '#abdda4', label: '10 m/s' },
    { speed: 20, color: '#fee08b', label: '20 m/s' },
    { speed: 30, color: '#f46d43', label: '30 m/s' },
    { speed: 40, color: '#d53e4f', label: '40+ m/s' },
  ];

  return (
    <div className="wind-legend">
      <div className="wind-legend__title">Wind Speed</div>
      <div className="wind-legend__bar">
        {stops.map((s) => (
          <div key={s.speed} className="wind-legend__stop">
            <div className="wind-legend__swatch" style={{ background: s.color }} />
            <span className="wind-legend__speed">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
