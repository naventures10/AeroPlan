import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { HeroUIProvider } from '@heroui/react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { useMapStore } from './store/useMapStore.ts';

// Expose useMapStore for E2E testing
if (
  import.meta.env.DEV ||
  import.meta.env.VITE_E2E_TEST ||
  (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
) {
  (window as any).useMapStore = useMapStore;
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <HeroUIProvider>
      <App />
    </HeroUIProvider>
  </ErrorBoundary>,
);
