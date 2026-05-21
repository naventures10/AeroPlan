import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavaidDetailsPanel } from '../../features/map/components/NavaidDetailsPanel';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: {
      div: ({ children, className }: any) => <div className={className}>{children}</div>,
    },
  };
});

describe('NavaidDetailsPanel', () => {
  it('renders correctly with base data', () => {
    const data = {
      ident: 'V1',
      aid_type: 'VOR',
      frequency: '112.5 MHz',
      elevation: '100 ft',
      raw_coordinates: '10N 020E',
      hours_of_operation: 'H24',
      remarks: 'TEST REMARK',
    };

    render(<NavaidDetailsPanel isLoadingNavaid={false} navaidDetails={null} data={data} />);

    expect(screen.getByText('V1')).toBeInTheDocument();
    expect(screen.getByText('VOR')).toBeInTheDocument();
    expect(screen.getByText('112.5 MHz')).toBeInTheDocument();
    expect(screen.getByText('100 ft')).toBeInTheDocument();
    expect(screen.getByText('10N 020E')).toBeInTheDocument();
    expect(screen.getByText('H24')).toBeInTheDocument();

    const remarkToggle = screen.getByText('Remarks').closest('button');
    expect(screen.queryByText('TEST REMARK')).not.toBeInTheDocument(); // Hidden initially

    fireEvent.click(remarkToggle!);
    expect(screen.getByText('TEST REMARK')).toBeInTheDocument();

    fireEvent.click(remarkToggle!);
    expect(screen.queryByText('TEST REMARK')).not.toBeInTheDocument();
  });

  it('renders loading spinner when loading', () => {
    const data = {};
    render(<NavaidDetailsPanel isLoadingNavaid={true} navaidDetails={null} data={data} />);
    // The spinner sets aria-label or we can just find it
    expect(document.querySelector('.animate-spin')).toBeInTheDocument(); // Tailwind spinner
  });

  it('prioritizes navaidDetails over data', () => {
    const data = { ident: 'V1' };
    const navaidDetails = { ident: 'V2' };
    render(
      <NavaidDetailsPanel
        isLoadingNavaid={false}
        navaidDetails={navaidDetails as any}
        data={data}
      />,
    );
    expect(screen.getByText('V2')).toBeInTheDocument();
    expect(screen.queryByText('V1')).not.toBeInTheDocument();
  });
});
