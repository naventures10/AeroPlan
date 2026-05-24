import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TerminalLegend from '../../features/terminal/components/TerminalLegend';
import { useMapStore } from '../../store/useMapStore';

describe('TerminalLegend', () => {
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

  it('renders hint popovers for each terminal legend control', () => {
    const { container } = render(<TerminalLegend />);

    const buttons = container.querySelectorAll('button[interestfor]');
    const tooltipLabels = [
      'Buildings',
      'Infrastructure',
      'Natural Hazards',
      'NavAids',
      'Other Hazards',
    ];

    expect(buttons).toHaveLength(5);

    for (const label of tooltipLabels) {
      const tooltip = screen.getByText(label).closest('[popover="hint"]');
      expect(tooltip).toBeInTheDocument();
    }
  });
});
