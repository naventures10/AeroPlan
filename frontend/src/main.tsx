import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initTooltipPlatform } from './lib/initTooltipPlatform.ts';
import { useMapStore } from './store/useMapStore.ts';
import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

// Initialize Grafana Faro Web SDK for observability
const faroUrl = import.meta.env.VITE_FARO_URL;
if (faroUrl) {
  initializeFaro({
    url: faroUrl,
    app: {
      name: 'eaip-frontend',
      version: import.meta.env.VITE_APP_VERSION ?? '0.1.0',
      environment: import.meta.env.MODE,
    },
    instrumentations: [
      // Default instrumentations: errors, console, web vitals, resource timing (captures Martin tile fetch times)
      ...getWebInstrumentations(),

      // Propagates W3C traceparent headers on fetch/XHR to backend and Martin,
      // linking browser spans to backend spans in Grafana Tempo.
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: [
            // Propagate to backend API — links frontend fetches to FastAPI spans
            ...(import.meta.env.VITE_API_URL
              ? [new RegExp(import.meta.env.VITE_API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))]
              : []),
            // Propagate to Martin tile server — measures tile fetch network latency
            ...(import.meta.env.VITE_MARTIN_URL
              ? [new RegExp(import.meta.env.VITE_MARTIN_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))]
              : []),
          ],
        },
      }),
    ],
  });
}

// Expose useMapStore to window during development, E2E tests, or when running production builds locally on localhost (both IPv4 and IPv6) for local debugging/testing.
if (
  import.meta.env.DEV ||
  import.meta.env.VITE_E2E_TEST ||
  (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1'))
) {
  (window as any).useMapStore = useMapStore;
}

void initTooltipPlatform();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
