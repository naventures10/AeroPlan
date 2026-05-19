import { heroui } from '@heroui/react';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          50: 'var(--accent-cyan-50, #ecfeff)',
          100: 'var(--accent-cyan-100, #cffafe)',
          200: 'var(--accent-cyan-200, #a5f3fc)',
          300: 'var(--accent-cyan-300, #67e8f9)',
          400: 'var(--accent-cyan-400, #22d3ee)',
          500: 'var(--accent-cyan-500, #06b6d4)',
          600: 'var(--accent-cyan-600, #0891b2)',
          700: 'var(--accent-cyan-700, #0369a1)',
          800: 'var(--accent-cyan-800, #075985)',
          900: 'var(--accent-cyan-900, #0c4a6e)',
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [heroui()],
};
