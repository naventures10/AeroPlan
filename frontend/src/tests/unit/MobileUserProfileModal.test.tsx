import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MobileUserProfileModal } from '../../features/user/mobile/MobileUserProfileModal';
import { useMapStore } from '../../store/useMapStore';
import { useAuthStore } from '../../store/useAuthStore';

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    useDragControls: () => ({
      start: vi.fn(),
    }),
    motion: {
      div: ({ children, className, style, onClick }: any) => (
        <div className={className} style={style} onClick={onClick} data-testid="motion-div">
          {children}
        </div>
      ),
    },
  };
});

// Mock the map store
vi.mock('../../store/useMapStore', () => ({
  useMapStore: vi.fn(),
}));

// Mock the auth store
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('MobileUserProfileModal', () => {
  const mockSetOpen = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default map store mock: OPEN
    (useMapStore as any).mockImplementation((selector: any) => {
      const state = {
        isUserProfileModalOpen: true,
        setUserProfileModalOpen: mockSetOpen,
      };
      return selector(state);
    });

    // Default auth store mock: active user
    (useAuthStore as any).mockReturnValue({
      user: {
        username: 'pilot1',
        email: 'pilot1@aeroplan.aero',
        created_at: '2026-01-15T08:00:00Z',
      },
      logoutUser: mockLogout,
    });
  });

  it('does not render when closed', () => {
    (useMapStore as any).mockImplementation((selector: any) => {
      const state = {
        isUserProfileModalOpen: false,
        setUserProfileModalOpen: mockSetOpen,
      };
      return selector(state);
    });

    const { container } = render(<MobileUserProfileModal />);
    expect(container.innerHTML).toBe('');
  });

  it('renders user details when open', () => {
    render(<MobileUserProfileModal />);

    expect(screen.getByText('User Profile')).toBeInTheDocument();
    expect(screen.getByText('pilot1')).toBeInTheDocument();
    expect(screen.getByText('Registered User')).toBeInTheDocument();
    expect(screen.getByText('pilot1@aeroplan.aero')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('triggers logout and closes modal when sign out is clicked', async () => {
    render(<MobileUserProfileModal />);

    const logoutBtn = screen.getByText('Sign Out');
    fireEvent.click(logoutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });
});
