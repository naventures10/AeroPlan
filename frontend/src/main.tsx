import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { HeroUIProvider } from '@heroui/react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import GlobalLoader from './components/GlobalLoader.tsx';

const WindTestPage = lazy(() => import('./features/windlayer/WindTestPage.tsx'));

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
  {
    path: '/wind-test',
    element: (
      <Suspense fallback={<GlobalLoader />}>
        <WindTestPage />
      </Suspense>
    ),
  },
]);

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
