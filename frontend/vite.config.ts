import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Run `ANALYZE=true npm run build` to generate stats.html
    process.env.ANALYZE === 'true' &&
      visualizer({
        open: true,
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
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
