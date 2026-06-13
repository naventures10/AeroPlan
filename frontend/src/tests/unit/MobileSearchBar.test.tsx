import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import MobileSearchBar from '../../features/map/controls/MobileSearchBar';
import { useIsMobile } from '../../hooks/useIsMobile';

describe('useIsMobile hook', () => {
  it('should return isMobile true if window.innerWidth is less than threshold', () => {
    // Mock window.innerWidth
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });

    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(true);

    // Reset window width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalWidth,
    });
  });

  it('should return isMobile false if window.innerWidth is greater than or equal to threshold', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(false);

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalWidth,
    });
  });

  it('should update state when resize event is fired', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(false);

    // Simulate window resize
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalWidth,
    });
  });
});

describe('MobileSearchBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    searchInput: '',
    setSearchInput: vi.fn(),
    suggestions: [],
    isLoading: false,
    isSearchFocused: false,
    setIsSearchFocused: vi.fn(),
    searchSelectedIndex: -1,
    setSearchSelectedIndex: vi.fn(),
    searchInputRef: { current: null },
    handleGlobalSearchSelect: vi.fn(),
    handleSearchKeyDown: vi.fn(),
  };

  it('renders trigger button when search is not focused', () => {
    render(<MobileSearchBar {...defaultProps} isSearchFocused={false} />);
    expect(screen.getByTestId('mobile-search-trigger')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Search locations.../i)).not.toBeInTheDocument();
  });

  it('opens overlay and shows input when search is focused', () => {
    render(<MobileSearchBar {...defaultProps} isSearchFocused={true} />);
    expect(screen.queryByTestId('mobile-search-trigger')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search locations.../i)).toBeInTheDocument();
  });

  it('handles input change', () => {
    const setSearchInput = vi.fn();
    render(
      <MobileSearchBar {...defaultProps} isSearchFocused={true} setSearchInput={setSearchInput} />,
    );
    const input = screen.getByPlaceholderText(/Search locations.../i);
    fireEvent.change(input, { target: { value: 'KJFK' } });
    expect(setSearchInput).toHaveBeenCalledWith('KJFK');
  });

  it('triggers close when clicking back button', () => {
    const setIsSearchFocused = vi.fn();
    render(
      <MobileSearchBar
        {...defaultProps}
        isSearchFocused={true}
        setIsSearchFocused={setIsSearchFocused}
      />,
    );
    const backBtn = screen.getByTestId('mobile-search-back');
    fireEvent.click(backBtn);
    expect(setIsSearchFocused).toHaveBeenCalledWith(false);
  });

  it('renders suggestions', () => {
    const suggestions = [
      { id: 'KJFK', name: 'John F Kennedy International', type: 'AERODROME' } as any,
    ];
    render(
      <MobileSearchBar
        {...defaultProps}
        isSearchFocused={true}
        searchInput="JFK"
        suggestions={suggestions}
      />,
    );
    expect(screen.getByText('KJFK')).toBeInTheDocument();
    expect(screen.getByText('John F Kennedy International')).toBeInTheDocument();
  });

  it('calls handleGlobalSearchSelect and closes overlay when suggestion clicked', () => {
    const handleGlobalSearchSelect = vi.fn();
    const setIsSearchFocused = vi.fn();
    const suggestions = [
      { id: 'KJFK', name: 'John F Kennedy International', type: 'AERODROME' } as any,
    ];
    render(
      <MobileSearchBar
        {...defaultProps}
        isSearchFocused={true}
        searchInput="JFK"
        suggestions={suggestions}
        handleGlobalSearchSelect={handleGlobalSearchSelect}
        setIsSearchFocused={setIsSearchFocused}
      />,
    );

    const itemBtn = screen.getByTestId('mobile-search-result-item');
    fireEvent.mouseDown(itemBtn);
    expect(handleGlobalSearchSelect).toHaveBeenCalledWith(suggestions[0]);
    expect(setIsSearchFocused).toHaveBeenCalledWith(false);
  });
});
