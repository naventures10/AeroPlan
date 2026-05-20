import { useLayoutEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import LandingPage from './pages/LandingPage';
import MapPage from './pages/MapPage';
import ShaderLab from './pages/ShaderLab/index';
import { useMapStore } from './store/useMapStore';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/app',
    element: <MapPage />,
  },
  {
    path: '/shader-lab',
    element: <ShaderLab />,
  },
]);

/**
 * Root application shell with high-performance routing.
 */
export default function App() {
  useLayoutEffect(() => {
    // @ts-expect-error - native global from index.html
    if (window.hideLoader) window.hideLoader();

    // Sync initial dark class with store state (defaults to dark)
    const isDark = useMapStore.getState().mapStyle !== 'light';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return <RouterProvider router={router} />;
}
