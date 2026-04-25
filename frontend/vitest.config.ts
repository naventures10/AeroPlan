/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    coverage: {
      include: ['src/**'],
      exclude: ['src/tests/**', 'src/**/*.d.ts', 'src/main.tsx', 'src/vite-env.d.ts', 'src/types/**'],
      all: true,
    },
    alias: {
      'react-map-gl/maplibre': path.resolve(__dirname, 'node_modules/react-map-gl/dist/maplibre.js'),
      'react-map-gl': path.resolve(__dirname, 'node_modules/react-map-gl/dist/mapbox.js')
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
