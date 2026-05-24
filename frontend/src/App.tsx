import { useLayoutEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import LandingPage from './pages/LandingPage';
import MapPage from './pages/MapPage';
import ShaderLab from './pages/ShaderLab/index';
import ProtectedRoute from './components/ProtectedRoute';
import { useMapStore } from './store/useMapStore';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <MapPage />
      </ProtectedRoute>
    ),
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
  const mapStyle = useMapStore((state) => state.mapStyle);

  useLayoutEffect(() => {
    // @ts-expect-error - native global from index.html
    if (window.hideLoader) window.hideLoader();
  }, []);

  useLayoutEffect(() => {
    if (mapStyle !== 'light') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mapStyle]);

  return <RouterProvider router={router} />;
}
