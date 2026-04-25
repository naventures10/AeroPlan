import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TafWidget } from '../features/terminal/components/TafWidget';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, className }: any) => <div className={className}>{children}</div>
    }
  };
});

describe('TafWidget', () => {
  it('renders correctly with taf data', () => {
    const mockWeather = {
      taf: [['LINE 1', 'LINE 2'], ['LINE 3']]
    };
    render(<TafWidget weather={mockWeather as any} />);
    expect(screen.getByText('LINE 1')).toBeInTheDocument();
    expect(screen.getByText('LINE 2')).toBeInTheDocument();
    expect(screen.getByText('LINE 3')).toBeInTheDocument();
  });

  it('renders correctly without taf data', () => {
    render(<TafWidget weather={null} />);
    expect(screen.getByText('No TAF data available.')).toBeInTheDocument();
  });
});
