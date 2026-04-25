import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AerodromeInfoDropdown from '../features/aip/AerodromeInfoDropdown';
import { useMapStore } from '../store/useMapStore';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: {
      div: ({ children, className, style }: any) => <div className={className} style={style}>{children}</div>,
      button: ({ children, className, onClick }: any) => <button className={className} onClick={onClick}>{children}</button>
    }
  };
});

describe('AerodromeInfoDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and handles select', () => {
    const handleSelect = vi.fn();

    render(<AerodromeInfoDropdown onSectionSelect={handleSelect} activeAirport="VAAU" />);

    const toggleButton = screen.getByText('AERODROME INFORMATION');
    expect(toggleButton).toBeInTheDocument();

    act(() => {
      fireEvent.click(toggleButton.closest('button')!);
    });

    const item = screen.getByText('Geographical & Administrative Data');
    expect(item).toBeInTheDocument();

    act(() => {
      fireEvent.click(item.closest('button')!);
    });

    expect(handleSelect).toHaveBeenCalledWith('AD_2_2'); // first section is AD_2_2
  });

  it('closes on outside click', () => {
    render(<AerodromeInfoDropdown onSectionSelect={vi.fn()} activeAirport="VAAU" />);

    const toggleButton = screen.getByText('AERODROME INFORMATION');
    act(() => {
      fireEvent.click(toggleButton.closest('button')!);
    });

    expect(screen.getByText('Geographical & Administrative Data')).toBeInTheDocument();

    act(() => {
      fireEvent.mouseDown(document.body);
    });

    // AnimatePresence is mocked to just render children immediately,
    // but the component checks `isOpen` before rendering motion.div
    expect(screen.queryByText('Geographical & Administrative Data')).not.toBeInTheDocument();
  });

  it('returns null when activeAirport is null', () => {
    const { container } = render(<AerodromeInfoDropdown onSectionSelect={vi.fn()} activeAirport={null} />);
    expect(container.firstChild).toBeNull();
  });
});
