import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useMapStore } from '../../store/useMapStore';

describe('useKeyboardShortcuts', () => {
  let returnToEnrouteMock: any;
  let setSelectedRouteIdsMock: any;
  let setSelectedFeatureMock: any;
  let cancelPendingSelectionMock: any;
  let onCloseSectionModalMock: any;
  let inputElement: HTMLInputElement | null = null;

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
    if (inputElement && inputElement.parentNode) {
      document.body.removeChild(inputElement);
    }
    inputElement = null;
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

  it('should disable the wind layer on Escape using the latest store state', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        sectionModalOpen: false,
        onCloseSectionModal: onCloseSectionModalMock,
        cancelPendingSelection: cancelPendingSelectionMock,
      }),
    );

    act(() => {
      useMapStore.setState((state) => ({
        isWindMode: false,
        activeLayers: { ...state.activeLayers, windlayer: true },
      }));
    });

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    act(() => {
      window.dispatchEvent(escEvent);
    });

    const state = useMapStore.getState();
    expect(state.isWindMode).toBe(false);
    expect(state.activeLayers.windlayer).toBe(false);
  });

  it('should ignore input when focused in an input field', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        sectionModalOpen: false,
        onCloseSectionModal: onCloseSectionModalMock,
        cancelPendingSelection: cancelPendingSelectionMock,
      }),
    );

    inputElement = document.createElement('input');
    document.body.appendChild(inputElement);
    inputElement.focus();

    act(() => {
      useMapStore.setState({ viewMode: 'TERMINAL' });
    });

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    act(() => {
      window.dispatchEvent(escEvent);
    });

    expect(returnToEnrouteMock).not.toHaveBeenCalled();
  });
});
