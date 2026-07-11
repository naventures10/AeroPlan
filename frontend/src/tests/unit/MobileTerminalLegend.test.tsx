import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import MobileTerminalLegend from '../../features/terminal/mobile/components/MobileTerminalLegend';
import { useMapStore } from '../../store/useMapStore';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: {
      div: ({ children, className, onClick }: any) => (
        <div className={className} onClick={onClick}>
          {children}
        </div>
      ),
      button: ({ children, className, onClick }: any) => (
        <button className={className} onClick={onClick}>
          {children}
        </button>
      ),
    },
  };
});

describe('MobileTerminalLegend', () => {
  beforeEach(() => {
    useMapStore.setState({
      terminalSpatialFilters: {
        buildings: false,
        infrastructure: false,
        natural: false,
        navaids: false,
        other: false,
      },
    });
  });

  it('renders collapsed FAB initially, expands, toggles filters, and collapses', () => {
    const toggleSpy = vi.spyOn(useMapStore.getState(), 'toggleTerminalSpatialFilter');

    const { container } = render(<MobileTerminalLegend />);

    // Initially collapsed: FAB is visible, card is not
    const fabButton = container.querySelector('.mobile-legend-fab');
    expect(fabButton).toBeInTheDocument();
    expect(screen.queryByText('Obstacles')).not.toBeInTheDocument();

    // Expand
    act(() => {
      if (fabButton) fireEvent.click(fabButton);
    });

    // Verify expanded content
    expect(screen.getByText('Obstacles')).toBeInTheDocument();

    const tooltipLabels = [
      'Buildings',
      'Infrastructure',
      'Natural Hazards',
      'NavAids',
      'Other Hazards',
    ];

    for (const label of tooltipLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Toggle Buildings Filter
    const buildingsButton = screen.getByText('Buildings').closest('button');
    expect(buildingsButton).toBeInTheDocument();
    act(() => {
      if (buildingsButton) fireEvent.click(buildingsButton);
    });
    expect(toggleSpy).toHaveBeenCalledWith('buildings');

    // Collapse
    const closeBtn = container.querySelector('.mobile-legend-close-btn');
    expect(closeBtn).toBeInTheDocument();
    act(() => {
      if (closeBtn) fireEvent.click(closeBtn);
    });

    // Verify it is collapsed again
    expect(screen.queryByText('Obstacles')).not.toBeInTheDocument();
  });
});
