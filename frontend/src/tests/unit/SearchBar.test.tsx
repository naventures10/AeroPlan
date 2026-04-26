import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from '../../features/map/controls/SearchBar';

describe('SearchBar Component', () => {
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

  it('renders search input', () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText(/SEARCH AIRPORT OR ICAO/i)).toBeInTheDocument();
  });

  it('handles input change', () => {
    const setSearchInput = vi.fn();
    render(<SearchBar {...defaultProps} setSearchInput={setSearchInput} />);
    const input = screen.getByPlaceholderText(/SEARCH AIRPORT OR ICAO/i);
    fireEvent.change(input, { target: { value: 'test' } });
    expect(setSearchInput).toHaveBeenCalledWith('test');
  });

  it('renders suggestions', () => {
    render(
      <SearchBar
        {...defaultProps}
        searchInput="test"
        isSearchFocused={true}
        suggestions={[{ id: '1', name: 'Airport 1', type: 'AERODROME' } as any]}
      />,
    );
    expect(screen.getByText('1')).toBeInTheDocument(); // It renders item.id
    expect(screen.getByText('Airport 1')).toBeInTheDocument();
  });
});
