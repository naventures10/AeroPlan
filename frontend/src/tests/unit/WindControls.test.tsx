import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { AltitudeSlider } from '../../features/map/controls/AltitudeSlider';
import { StatusBadge } from '../../features/map/controls/StatusBadge';
import { TimelineControl } from '../../features/map/controls/TimelineControl';
import { useMapStore } from '../../store/useMapStore';

describe('Wind UI Controls', () => {
  beforeEach(() => {
    useMapStore.setState({
      windAltitude: 0,
      windAnimationTime: 0,
      windIsPlaying: false,
      isWindMode: true,
    });
  });

  describe('AltitudeSlider', () => {
    it('renders and displays correct altitude label', () => {
      const { getByText, rerender } = render(<AltitudeSlider />);

      expect(getByText('Surface')).toBeInTheDocument();

      act(() => {
        useMapStore.setState({ windAltitude: 10 });
      });
      rerender(<AltitudeSlider />);
      expect(getByText('FL100')).toBeInTheDocument();

      act(() => {
        useMapStore.setState({ windAltitude: 3 });
      });
      rerender(<AltitudeSlider />);
      expect(getByText('3000 ft')).toBeInTheDocument();
    });

    it('calls setWindAltitude on slider change', () => {
      const { getByRole } = render(<AltitudeSlider />);
      const slider = getByRole('slider');

      fireEvent.change(slider, { target: { value: '25' } });
      expect(useMapStore.getState().windAltitude).toBe(25);
    });
  });

  describe('StatusBadge', () => {
    it('renders message or state', () => {
      const { getByText, rerender } = render(
        <StatusBadge status={{ state: 'loading', message: 'Wait...' }} />,
      );
      expect(getByText(/Wait.../)).toBeInTheDocument();

      rerender(<StatusBadge status={{ state: 'ready' }} />);
      expect(getByText('ready')).toBeInTheDocument();
    });

    it('toggles off wind mode when close button is clicked', () => {
      const setIsWindModeMock = vi.fn();
      useMapStore.setState({ setIsWindMode: setIsWindModeMock });

      const { getByTitle } = render(<StatusBadge status={{ state: 'ready' }} />);
      fireEvent.click(getByTitle('Close Wind Layer'));

      expect(setIsWindModeMock).toHaveBeenCalledWith(false);
    });
  });

  describe('TimelineControl', () => {
    const mockTimestamps = [
      { label: '12:00 PM', date: 'April 28', validTime: '2026-04-28T12:00:00Z', files: {} },
      { label: '03:00 PM', date: 'April 28', validTime: '2026-04-28T15:00:00Z', files: {} },
    ];

    it('renders time labels and active date', () => {
      const { getByText } = render(<TimelineControl timestamps={mockTimestamps} />);
      expect(getByText('12:00 PM')).toBeInTheDocument();
      expect(getByText('April 28')).toBeInTheDocument();
    });

    it('toggles playback', () => {
      const { getByRole } = render(<TimelineControl timestamps={mockTimestamps} />);
      const playButton = getByRole('button');

      fireEvent.click(playButton);
      expect(useMapStore.getState().windIsPlaying).toBe(true);

      fireEvent.click(playButton);
      expect(useMapStore.getState().windIsPlaying).toBe(false);
    });

    it('updates animation time on slider change and stops playback', () => {
      useMapStore.setState({ windIsPlaying: true });
      const { getByRole } = render(<TimelineControl timestamps={mockTimestamps} />);
      const slider = getByRole('slider');

      fireEvent.change(slider, { target: { value: '0.5' } });
      expect(useMapStore.getState().windAnimationTime).toBe(0.5);
      expect(useMapStore.getState().windIsPlaying).toBe(false);
    });
  });
});
