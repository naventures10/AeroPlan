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
import { useEffect, useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { MapController } from '@deck.gl/core';
import Map from 'react-map-gl/maplibre';
import { ClipExtension } from '@deck.gl/extensions';
import * as WeatherLayers from 'weatherlayers-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = `https://api.maptiler.com/maps/topo-v2-dark/style.json?key=${MAPTILER_KEY}`;

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

// Wind-speed palette: calm (blue) → fast (red)
// Data is in m/s, so we keep this mapped to m/s values.
const WIND_PALETTE = `
0       #3288bd
10.29   #66c2a5
20.58   #abdda4
30.87   #e6f598
41.16   #fee08b
51.44   #fdae61
61.73   #d53e4f
`;

const formatIST = (isoString: string) => {
  const utcDate = new Date(isoString);

  const labelFormatter = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  return {
    label: labelFormatter.format(utcDate),
    date: dateFormatter.format(utcDate),
  };
};

export interface ForecastTimestamp {
  label: string;
  date: string;
  validTime: string;
  files: Record<string, string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WindStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  validTime?: string;
}

export default function WindTestPage() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [loadedImages, setLoadedImages] = useState<Record<number, WeatherLayers.TextureData>>({});
  const [status, setStatus] = useState<WindStatus>({ state: 'idle' });

  const [forecastTimestamps, setForecastTimestamps] = useState<ForecastTimestamp[]>([]);
  const [selectedAltitude, setSelectedAltitude] = useState(0);
  const [animationTime, setAnimationTime] = useState(0); // float 0 to length-1
  const [isPlaying, setIsPlaying] = useState(false);

  // Hover Tooltip State
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    speed: number;
    direction: number;
  } | null>(null);

  // ── Hide global loader ─────────────────────────────────────────────────────
  useEffect(() => {
    // @ts-expect-error - native global from index.html
    if (window.hideLoader) window.hideLoader();
  }, []);

  // ── Fetch dynamic manifest ──────────────────────────────────────────────────
  useEffect(() => {
    async function fetchManifest() {
      try {
        const response = await fetch('/weather/weather_manifest.json');
        const manifestData = await response.json();
        if (manifestData && manifestData.forecasts) {
          const timestamps = manifestData.forecasts.map((f: any) => {
            const { label, date } = formatIST(f.valid_time);
            return {
              label,
              date,
              validTime: f.valid_time,
              files: f.files,
            };
          });
          setForecastTimestamps(timestamps);
        }
      } catch (err) {
        console.error('Failed to load weather manifest', err);
        setStatus({ state: 'error', message: 'Failed to load weather manifest' });
      }
    }
    fetchManifest();
  }, []);

  // ── Pre-load weather data for current altitude ─────────────────────────────
  useEffect(() => {
    let active = true;

    async function loadAll() {
      if (forecastTimestamps.length === 0) return;

      setStatus({ state: 'loading', message: 'Pre-loading forecast frames…' });
      setLoadedImages({});

      const levelKey =
        selectedAltitude === 0 ? 'surface' : String(selectedAltitude).padStart(3, '0');

      const loadPromises = forecastTimestamps.map((t) => {
        const url = t.files[levelKey];
        if (!url) throw new Error(`Missing URL for level ${levelKey}`);
        return WeatherLayers.loadTextureData(url);
      });

      try {
        const results = await Promise.all(loadPromises);
        if (!active) return;

        const imageMap: Record<number, WeatherLayers.TextureData> = {};
        results.forEach((img, i) => {
          imageMap[i] = img;
        });

        setLoadedImages(imageMap);
        setStatus({ state: 'ready', message: 'All frames ready' });
      } catch (err) {
        if (!active) return;
        console.error('[WindTestPage] Load error:', err);
        setStatus({ state: 'error', message: 'Failed to pre-load some frames' });
      }
    }

    loadAll();
    return () => {
      active = false;
    };
  }, [selectedAltitude, forecastTimestamps]);

  // ── Animation Loop (requestAnimationFrame) ─────────────────────────────────
  useEffect(() => {
    if (!isPlaying || forecastTimestamps.length === 0) return;

    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Speed: 10 seconds per frame transition (1 / 10 = 0.1 units per second)
      const playbackSpeed = 0.1;

      setAnimationTime((prev) => {
        let next = prev + dt * playbackSpeed;
        if (next >= forecastTimestamps.length - 1) {
          next = forecastTimestamps.length - 1;
          setIsPlaying(false);
        }
        return next;
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, forecastTimestamps.length]);

  // ── Calculate Interpolation ────────────────────────────────────────────────
  const maxIndex = Math.max(0, forecastTimestamps.length - 1);
  const index1 = Math.min(Math.floor(Math.max(0, animationTime)), maxIndex);
  const index2 = Math.min(index1 + 1, maxIndex);
  const interpolationWeight = animationTime - index1;

  // ── Build DeckGL layers ────────────────────────────────────────────────────
  const layers = loadedImages[index1]
    ? [
        new WeatherLayers.ParticleLayer({
          id: 'wind-particles',
          // Primary and secondary textures for interpolation
          image: loadedImages[index1],
          image2: loadedImages[index2] || null,
          imageWeight: interpolationWeight,

          bounds: WIND_BOUNDS,
          numParticles: 3000,
          maxAge: 100,
          speedFactor: 5,
          width: 2,
          palette: WIND_PALETTE,
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

  // ── Tooltip Logic (Uses current interpolated time) ─────────────────────────
  const getWindAtLngLat = useCallback(
    (lng: number, lat: number) => {
      const img1 = loadedImages[index1];
      const img2 = loadedImages[index2];
      if (!img1) return null;

      const [minLng, minLat, maxLng, maxLat] = WIND_BOUNDS;
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return null;

      const x = Math.floor(((lng - minLng) / (maxLng - minLng)) * img1.width);
      const y = Math.floor(((maxLat - lat) / (maxLat - minLat)) * img1.height);

      // Dynamically calculate components per pixel (2 for UV wind tiff, 4 for RGBA)
      const components = img1.data.length / (img1.width * img1.height);
      const idx = (y * img1.width + x) * components;

      const u1 = Number(img1.data[idx]);
      const v1 = Number(img1.data[idx + 1]);

      let u = u1;
      let v = v1;

      if (img2) {
        const u2 = Number(img2.data[idx]);
        const v2 = Number(img2.data[idx + 1]);
        u = u1 * (1 - interpolationWeight) + u2 * interpolationWeight;
        v = v1 * (1 - interpolationWeight) + v2 * interpolationWeight;
      }

      if (isNaN(u) || isNaN(v) || (u === 0 && v === 0)) return null;

      const speedMS = Math.sqrt(u * u + v * v);
      const speedKnots = speedMS * 1.94384;

      // atan2(-u, -v) = meteorological FROM direction (wind FROM direction)
      let dir = Math.atan2(-u, -v) * (180 / Math.PI);
      if (dir < 0) dir += 360;

      return { speed: speedKnots, direction: dir };
    },
    [loadedImages, index1, index2, interpolationWeight],
  );

  const onMouseMove = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      const windData = getWindAtLngLat(e.lngLat.lng, e.lngLat.lat);
      if (windData) {
        setHoverInfo({
          x: e.point.x,
          y: e.point.y,
          speed: windData.speed,
          direction: windData.direction,
        });
      } else {
        setHoverInfo(null);
      }
    },
    [getWindAtLngLat],
  );

  const onMouseOut = useCallback(() => {
    setHoverInfo(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="wind-test-root">
      <DeckGL
        viewState={viewState}
        controller={DECK_CONTROLLER}
        layers={layers}
        onViewStateChange={onViewStateChange as any}
      >
        <Map mapStyle={MAP_STYLE} reuseMaps onMouseMove={onMouseMove} onMouseOut={onMouseOut} />
      </DeckGL>

      {hoverInfo && (
        <div className="wind-tooltip wind-panel" style={{ left: hoverInfo.x, top: hoverInfo.y }}>
          <div className="wind-tooltip__row">
            <span className="wind-tooltip__label">Speed</span>
            <span className="wind-tooltip__value">{Math.round(hoverInfo.speed)} kt</span>
          </div>
          <div className="wind-tooltip__row">
            <span className="wind-tooltip__label">Dir</span>
            <span className="wind-tooltip__value">{Math.round(hoverInfo.direction)}°</span>
          </div>
        </div>
      )}

      <StatusBadge status={status} />
      <AltitudeSlider selectedAltitude={selectedAltitude} onChange={setSelectedAltitude} />
      <VerticalWindLegend />

      <TimelineControl
        animationTime={animationTime}
        isPlaying={isPlaying}
        timestamps={forecastTimestamps}
        onTimeChange={(val) => {
          setAnimationTime(val);
          setIsPlaying(false);
        }}
        onPlayToggle={() => {
          if (animationTime >= forecastTimestamps.length - 1) {
            setAnimationTime(0);
          }
          setIsPlaying(!isPlaying);
        }}
      />
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
    <div className={`wind-status wind-panel ${stateClass}`}>
      <span className="wind-status__dot" />
      <span className="wind-status__text">
        {status.state === 'loading' && '⟳ '}
        {status.message || status.state}
      </span>
    </div>
  );
}

function VerticalWindLegend() {
  return (
    <div className="wind-legend-v wind-panel">
      <div className="wind-legend-v__title">
        Wind
        <br />
        (kt)
      </div>
      <div className="wind-legend-v__track">
        <div className="wind-legend-v__ticks">
          <span className="wind-legend-v__tick">120</span>
          <span className="wind-legend-v__tick">80</span>
          <span className="wind-legend-v__tick">40</span>
          <span className="wind-legend-v__tick">0</span>
        </div>
      </div>
    </div>
  );
}

function AltitudeSlider({
  selectedAltitude,
  onChange,
}: {
  selectedAltitude: number;
  onChange: (v: number) => void;
}) {
  const formatAltitude = (alt: number) => {
    if (alt === 0) return 'Surface';
    if (alt < 5) return `${alt * 1000} ft`;
    return `FL${String(alt * 10).padStart(3, '0')}`;
  };

  return (
    <div className="wind-altitude wind-panel">
      <div className="wind-altitude__title">Altitude</div>
      <div className="wind-altitude__display">{formatAltitude(selectedAltitude)}</div>
      <div className="wind-altitude__slider-wrapper">
        <input
          type="range"
          min={0}
          max={39}
          step={1}
          value={selectedAltitude}
          onChange={(e) => onChange(Number(e.target.value))}
          className="wind-altitude__input"
        />
      </div>
    </div>
  );
}

function TimelineControl({
  animationTime,
  isPlaying,
  timestamps,
  onTimeChange,
  onPlayToggle,
}: {
  animationTime: number;
  isPlaying: boolean;
  timestamps: ForecastTimestamp[];
  onTimeChange: (v: number) => void;
  onPlayToggle: () => void;
}) {
  const currentIndex = Math.min(
    Math.floor(Math.max(0, animationTime)),
    Math.max(0, timestamps.length - 1),
  );
  const activeTime = timestamps[currentIndex];

  if (!activeTime) return null;

  return (
    <div className="wind-timeline wind-panel">
      <div className="wind-timeline__header">
        <button className="wind-timeline__play" onClick={onPlayToggle}>
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="wind-timeline__info">
          <span className="wind-timeline__title">Wind Speed</span>
          <span className="wind-timeline__date">{activeTime.date}</span>
        </div>
      </div>

      <div className="wind-timeline__track">
        <input
          type="range"
          className="wind-timeline__input"
          min={0}
          max={Math.max(0, timestamps.length - 1)}
          step={0.01}
          value={animationTime}
          onChange={(e) => onTimeChange(parseFloat(e.target.value))}
        />
        <div className="wind-timeline__labels">
          {timestamps.map((t, i) => (
            <span
              key={i}
              className={`wind-timeline__label ${i === currentIndex ? 'wind-timeline__label--active' : ''}`}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
