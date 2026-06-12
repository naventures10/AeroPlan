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

  it('renders a button for each obstacle category', () => {
    const { container } = render(<TerminalLegend />);

    const buttons = container.querySelectorAll('.obstacle-legend-row');
    expect(buttons).toHaveLength(5);

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
  });
});
