import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      /**
       * PRODUCTION DEPLOYMENT NOTE:
       * This plugin only sets the Cache-Control headers for local development.
       * When deploying to production (e.g. Nginx, S3, Vercel), you MUST manually
       * configure your server/CDN to serve `/weather/weather_manifest.json` with:
       * `Cache-Control: no-cache, no-store, must-revalidate`
       * Failure to do so will cause the client to request deleted weather files and crash.
       */
      name: 'weather-manifest-cache-control',
      configureServer(server: import('vite').ViteDevServer) {
        server.middlewares.use((req: any, res: any, next: () => void) => {
          if (req.url && req.url.includes('/weather/weather_manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
          next();
        });
      },
    },
  ].filter(Boolean) as import('vite').PluginOption[],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/tiles': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/tiles/, ''),
      },
    },
  },
  optimizeDeps: {
    include: ['framer-motion'],
  },
});
