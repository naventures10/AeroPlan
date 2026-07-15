import { useLayoutEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import LandingPage from './pages/LandingPage';
import MapPage from './pages/MapPage';
import BlogPage from './pages/BlogPage';

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
    path: '/blog',
    element: <BlogPage />,
  },
]);

/**
 * Root application shell with high-performance routing.
 */
export default function App() {
  useLayoutEffect(() => {
    // @ts-expect-error - native global from index.html
    if (window.hideLoader) window.hideLoader();
  }, []);

  return <RouterProvider router={router} />;
}
