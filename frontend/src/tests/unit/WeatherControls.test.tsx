import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { WeatherControls } from '../../features/map/controls/WeatherControls';
import { AltitudeSlider } from '../../features/map/controls/AltitudeSlider';
import { StatusBadge } from '../../features/map/controls/StatusBadge';
import { TimelineControl } from '../../features/map/controls/TimelineControl';
import { useMapStore } from '../../store/useMapStore';

// Mock the wind layer hook
vi.mock('../../features/map/layers/useWindLayer', () => ({
  useWindLayer: () => ({
    windStatus: { state: 'ready' },
    forecastTimestamps: [
      { label: '12:00 PM', date: 'April 28', validTime: '2026-04-28T12:00:00Z', files: {} },
    ],
  }),
}));

describe('Weather UI Controls', () => {
  beforeEach(() => {
    useMapStore.setState({
      windAltitude: 0,
      windAnimationTime: 0,
      windIsPlaying: false,
      isWindMode: true,
      isCloudMode: false,
      cloudLoadingStatus: { state: 'ready' },
      setIsWindMode: (val: boolean) => useMapStore.setState({ isWindMode: val }),
      setIsCloudMode: (val: boolean) => useMapStore.setState({ isCloudMode: val }),
    });
  });

  describe('WeatherControls Component', () => {
    it('renders wind and cloud toggles', () => {
      const { getByRole } = render(<WeatherControls />);
      expect(getByRole('button', { name: /Wind/i })).toBeInTheDocument();
      expect(getByRole('button', { name: /Cloud/i })).toBeInTheDocument();
    });

    it('toggles wind mode', () => {
      const { getByRole } = render(<WeatherControls />);
      const windBtn = getByRole('button', { name: /Wind/i });

      fireEvent.click(windBtn);
      expect(useMapStore.getState().isWindMode).toBe(false);

      fireEvent.click(windBtn);
      expect(useMapStore.getState().isWindMode).toBe(true);
    });

    it('toggles cloud mode', () => {
      const { getByRole } = render(<WeatherControls />);
      const cloudBtn = getByRole('button', { name: /Cloud/i });

      fireEvent.click(cloudBtn);
      expect(useMapStore.getState().isCloudMode).toBe(true);

      fireEvent.click(cloudBtn);
      expect(useMapStore.getState().isCloudMode).toBe(false);
    });

    it('shows wind legend only in wind mode', () => {
      const { queryByText, rerender } = render(<WeatherControls />);
      // VerticalWindLegend has "Wind" and "(kt)" split by <br/>
      expect(queryByText(/kt/i)).toBeInTheDocument();

      act(() => {
        useMapStore.setState({ isWindMode: false });
      });
      rerender(<WeatherControls />);
      expect(queryByText(/kt/i)).not.toBeInTheDocument();
    });
  });

  describe('AltitudeSlider', () => {
    it('renders and displays correct altitude label', () => {
      const { getByText, rerender } = render(<AltitudeSlider />);

      // Default is 0 = SFC / Surface
      expect(getByText('SFC')).toBeInTheDocument();
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
      expect(getByText('3000')).toBeInTheDocument();
    });

    it('steps altitude up when clicking the up button', () => {
      const { getByTestId } = render(<AltitudeSlider />);
      const upBtn = getByTestId('altitude-up');

      // Starting at 0 (Surface), step up to 1 (1000 ft)
      fireEvent.click(upBtn);
      expect(useMapStore.getState().windAltitude).toBe(1);

      // Step up again to 2 (2000 ft)
      fireEvent.click(upBtn);
      expect(useMapStore.getState().windAltitude).toBe(2);
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

    it('toggles off weather mode when close button is clicked', () => {
      const setIsWindModeMock = vi.fn();
      const setIsCloudModeMock = vi.fn();
      const setIsWeatherModeMock = vi.fn();
      useMapStore.setState({
        setIsWindMode: setIsWindModeMock,
        setIsCloudMode: setIsCloudModeMock,
        setIsWeatherMode: setIsWeatherModeMock,
      });

      const { getByTitle } = render(<StatusBadge status={{ state: 'ready' }} />);
      fireEvent.click(getByTitle('Close Weather Layer'));

      expect(setIsWindModeMock).toHaveBeenCalledWith(false);
      expect(setIsCloudModeMock).toHaveBeenCalledWith(false);
      expect(setIsWeatherModeMock).toHaveBeenCalledWith(false);
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
  });
});
