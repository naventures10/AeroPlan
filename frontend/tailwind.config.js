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
          50: 'var(--accent-cyan-50, #f5f3ff)',
          100: 'var(--accent-cyan-100, #ede9fe)',
          200: 'var(--accent-cyan-200, #ddd6fe)',
          300: 'var(--accent-cyan-300, #c4b5fd)',
          400: 'var(--accent-cyan)',
          500: 'var(--accent-cyan)',
          600: 'var(--accent-cyan-600, #7c3aed)',
          700: 'var(--accent-cyan-700, #6d28d9)',
          800: 'var(--accent-cyan-800, #5b21b6)',
          900: 'var(--accent-cyan-900, #4c1d95)',
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [heroui()],
};
