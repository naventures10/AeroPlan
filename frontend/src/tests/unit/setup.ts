import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock map-related components to prevent webgl issues in jsdom
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'mock-map' }, children),
  Map: ({ children }: any) => React.createElement('div', { 'data-testid': 'mock-map' }, children),
  Source: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'mock-source' }, children),
  Layer: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'mock-layer' }, children),
  NavigationControl: () => React.createElement('div', { 'data-testid': 'mock-nav-control' }),
  useControl: vi.fn(),
}));

vi.mock('@deck.gl/react', () => ({
  DeckGL: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'mock-deckgl' }, children),
  default: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'mock-deckgl' }, children),
}));

// Mock framer-motion to simplify testing
vi.mock('framer-motion', async () => {
  const actual = (await vi.importActual('framer-motion')) as any;
  return {
    ...actual,
    AnimatePresence: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'mock-animate-presence' }, children),
    motion: {
      div: ({ children, ...props }: any) =>
        React.createElement(
          'div',
          { ...props, 'data-testid': props['data-testid'] || 'mock-motion-div' },
          children,
        ),
      button: ({ children, ...props }: any) =>
        React.createElement(
          'button',
          { ...props, 'data-testid': props['data-testid'] || 'mock-motion-button' },
          children,
        ),
      span: ({ children, ...props }: any) =>
        React.createElement(
          'span',
          { ...props, 'data-testid': props['data-testid'] || 'mock-motion-span' },
          children,
        ),
      aside: ({ children, ...props }: any) =>
        React.createElement(
          'aside',
          { ...props, 'data-testid': props['data-testid'] || 'mock-motion-aside' },
          children,
        ),
      ul: ({ children, ...props }: any) =>
        React.createElement(
          'ul',
          { ...props, 'data-testid': props['data-testid'] || 'mock-motion-ul' },
          children,
        ),
      li: ({ children, ...props }: any) =>
        React.createElement(
          'li',
          { ...props, 'data-testid': props['data-testid'] || 'mock-motion-li' },
          children,
        ),
    },
  };
});

// Mock weatherlayers-gl
vi.mock('weatherlayers-gl', () => ({
  ParticleLayer: vi.fn(),
}));

// Mock Worker for libraries that expect it in browser environment
if (typeof global.Worker === 'undefined') {
  global.Worker = class {
    onmessage = () => {};
    postMessage = () => {};
    terminate = () => {};
    addEventListener = () => {};
    removeEventListener = () => {};
    dispatchEvent = () => false;
  } as any;
}

// Mock DOMMatrix for react-pdf/pdf.js canvas
if (typeof global.DOMMatrix === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  global.DOMMatrix = class DOMMatrix {} as any;
}

// Mock localStorage and sessionStorage for store persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(global, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
});
