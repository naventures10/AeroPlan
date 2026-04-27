import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { HeroUIProvider } from '@heroui/react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { useMapStore } from './store/useMapStore.ts';

// Expose useMapStore for E2E testing
if (import.meta.env.DEV || (window as any).PLAYWRIGHT) {
  (window as any).useMapStore = useMapStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HeroUIProvider>
        <App />
      </HeroUIProvider>
    </ErrorBoundary>
  </StrictMode>,
);
