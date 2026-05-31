import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initTooltipPlatform } from './lib/initTooltipPlatform.ts';
import { useMapStore } from './store/useMapStore.ts';
import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk';

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
      // Load default web instrumentations (console, errors, web vitals)
      ...getWebInstrumentations(),
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
