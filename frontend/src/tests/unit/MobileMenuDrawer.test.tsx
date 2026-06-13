import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import MobileMenuDrawer from '../../features/map/controls/MobileMenuDrawer';
import { useMapStore } from '../../store/useMapStore';

describe('MobileMenuDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  it('renders nothing when closed', () => {
    render(<MobileMenuDrawer {...defaultProps} isOpen={false} />);
    expect(screen.queryByLabelText('Navigation menu')).not.toBeInTheDocument();
  });

  it('renders sections and titles when open', () => {
    render(<MobileMenuDrawer {...defaultProps} />);
    expect(screen.getByText('User Profile')).toBeInTheDocument();
    expect(screen.getByText('AIP Supplements')).toBeInTheDocument();
    expect(screen.getByText('Enroute Notams')).toBeInTheDocument();
  });

  it('triggers onClose when clicking close button', () => {
    const onClose = vi.fn();
    render(<MobileMenuDrawer {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByLabelText('Close menu');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates store modals when clicking items', () => {
    const onClose = vi.fn();
    render(<MobileMenuDrawer {...defaultProps} onClose={onClose} />);

    // Click User Profile
    const profileBtn = screen.getByLabelText('User Profile');
    fireEvent.click(profileBtn);
    expect(useMapStore.getState().isUserProfileModalOpen).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});
