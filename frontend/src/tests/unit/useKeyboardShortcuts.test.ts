import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useMapStore } from '../../store/useMapStore';

describe('useKeyboardShortcuts', () => {
  let returnToEnrouteMock: any;
  let setSelectedRouteIdsMock: any;
  let setSelectedFeatureMock: any;
  let cancelPendingSelectionMock: any;
  let onCloseSectionModalMock: any;

  beforeEach(() => {
    returnToEnrouteMock = vi.fn();
    setSelectedRouteIdsMock = vi.fn();
    setSelectedFeatureMock = vi.fn();
    cancelPendingSelectionMock = vi.fn();
    onCloseSectionModalMock = vi.fn();

    useMapStore.setState({
      viewMode: 'ENROUTE',
      activeAirport: null,
      selectedRouteIds: [],
      selectedFeature: null,
      returnToEnroute: returnToEnrouteMock,
      setSelectedRouteIds: setSelectedRouteIdsMock,
      setSelectedFeature: setSelectedFeatureMock,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call returnToEnroute when Escape is pressed and in TERMINAL mode', () => {
    useMapStore.setState({ viewMode: 'TERMINAL' });

    renderHook(() =>
      useKeyboardShortcuts({
        sectionModalOpen: false,
        onCloseSectionModal: onCloseSectionModalMock,
        cancelPendingSelection: cancelPendingSelectionMock,
      }),
    );

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(escEvent);
    expect(returnToEnrouteMock).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending selection when Escape is pressed and routes are selected', () => {
    useMapStore.setState({ selectedRouteIds: ['A1'] });

    renderHook(() =>
      useKeyboardShortcuts({
        sectionModalOpen: false,
        onCloseSectionModal: onCloseSectionModalMock,
        cancelPendingSelection: cancelPendingSelectionMock,
      }),
    );

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(escEvent);
    expect(cancelPendingSelectionMock).toHaveBeenCalled();
    expect(setSelectedRouteIdsMock).toHaveBeenCalledWith([]);
    expect(setSelectedFeatureMock).toHaveBeenCalledWith(null);
  });

  it('should call onCloseSectionModal on Escape when modal is open', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        sectionModalOpen: true,
        onCloseSectionModal: onCloseSectionModalMock,
        cancelPendingSelection: cancelPendingSelectionMock,
      }),
    );

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(escEvent);
    expect(onCloseSectionModalMock).toHaveBeenCalled();
  });

  it('should ignore input when focused in an input field', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        sectionModalOpen: false,
        onCloseSectionModal: onCloseSectionModalMock,
        cancelPendingSelection: cancelPendingSelectionMock,
      }),
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    useMapStore.setState({ viewMode: 'TERMINAL' });

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(escEvent);

    expect(returnToEnrouteMock).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
