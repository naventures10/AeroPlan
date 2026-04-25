import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotamWidget } from '../features/terminal/components/NotamWidget';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, className }: any) => <div className={className}>{children}</div>
    }
  };
});

describe('NotamWidget', () => {
  it('renders correctly with notams', () => {
    const notams = [
      {
        notam_id: 'A1234',
        scope: 'AE',
        is_estimated: true,
        series: 'A',
        description: 'Test Notam',
        valid_from: '2024-01-01T00:00:00Z',
        valid_to: '2024-01-02T00:00:00Z',
        is_permanent: false
      },
      {
        notam_id: 'A1235',
        series: 'B',
        description: 'Test Notam Perm',
        is_permanent: true
      }
    ];

    render(<NotamWidget notams={notams as any} />);
    expect(screen.getByText('A1234')).toBeInTheDocument();
    expect(screen.getByText('AE')).toBeInTheDocument();
    expect(screen.getByText('EST')).toBeInTheDocument();
    expect(screen.getByText('SERIES A')).toBeInTheDocument();
    expect(screen.getByText('Test Notam')).toBeInTheDocument();

    // valid from
    expect(screen.getAllByText(/FROM:/)[0]).toHaveTextContent('2024-01-01T00:00:00Z');
    expect(screen.getAllByText(/TO:/)[0]).toHaveTextContent('2024-01-02T00:00:00Z');

    expect(screen.getByText('A1235')).toBeInTheDocument();
    expect(screen.getAllByText(/TO:/)[1]).toHaveTextContent('PERM');
  });

  it('renders correctly with empty notams', () => {
    render(<NotamWidget notams={[]} />);
    expect(screen.getByText('No active NOTAMs found.')).toBeInTheDocument();
  });
});
