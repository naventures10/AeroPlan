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
