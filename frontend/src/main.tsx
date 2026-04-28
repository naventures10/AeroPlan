import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { HeroUIProvider } from '@heroui/react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { useMapStore } from './store/useMapStore.ts';

// Expose useMapStore for E2E testing
if (import.meta.env.DEV || import.meta.env.VITE_E2E_TEST) {
  (window as any).useMapStore = useMapStore;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <HeroUIProvider>
          <App />
        </HeroUIProvider>
      </ErrorBoundary>
    ),
  },
]);

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
