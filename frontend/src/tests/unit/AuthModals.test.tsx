import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthModals from '../../features/user/AuthModals';
import { useAuthStore } from '../../store/useAuthStore';

// Mock the auth store
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('AuthModals', () => {
  const mockLoginUser = vi.fn();
  const mockRegisterUser = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as unknown as any).mockReturnValue({
      loginUser: mockLoginUser,
      registerUser: mockRegisterUser,
      isLoading: false,
      error: null,
      clearError: mockClearError,
    });
  });

  it('does not render when isOpen is false', () => {
    render(<AuthModals isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText(/Welcome Back|Create an Account/)).not.toBeInTheDocument();
  });

  it('renders login mode by default', () => {
    render(<AuthModals isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders register mode when initialMode is register', () => {
    render(<AuthModals isOpen={true} onClose={() => {}} initialMode="register" />);
    expect(screen.getByText('Create an Account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('updates mode when initialMode prop changes on re-open (Bug Fix Check)', () => {
    const { rerender } = render(
      <AuthModals isOpen={true} onClose={() => {}} initialMode="login" />,
    );
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();

    // Close the modal
    rerender(<AuthModals isOpen={false} onClose={() => {}} initialMode="login" />);
    expect(screen.queryByText('Welcome Back')).not.toBeInTheDocument();

    // Re-open the modal with register mode
    rerender(<AuthModals isOpen={true} onClose={() => {}} initialMode="register" />);
    // This should now show Create an Account instead of being stuck on Welcome Back
    expect(screen.getByText('Create an Account')).toBeInTheDocument();
  });

  it('toggles between modes when toggle button is clicked', () => {
    render(<AuthModals isOpen={true} onClose={() => {}} initialMode="login" />);

    // Switch to register
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByText('Create an Account')).toBeInTheDocument();

    // Switch back to login
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });

  it('calls loginUser with correct credentials on submit', () => {
    render(<AuthModals isOpen={true} onClose={() => {}} initialMode="login" />);

    const emailInput = screen.getByPlaceholderText('pilot@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    // Security check: password input must be type="password" to hide input
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(emailInput).toHaveAttribute('type', 'email');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secure123' } });

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    // Data flow verification
    expect(mockLoginUser).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'secure123',
    });
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it('calls registerUser with correct credentials on submit', () => {
    render(<AuthModals isOpen={true} onClose={() => {}} initialMode="register" />);

    const emailInput = screen.getByPlaceholderText('pilot@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const firstNameInput = screen.getByPlaceholderText('Amelia');
    const lastNameInput = screen.getByPlaceholderText('Earhart');

    fireEvent.change(firstNameInput, { target: { value: 'New' } });
    fireEvent.change(lastNameInput, { target: { value: 'User' } });
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'newpass123' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    // Data flow verification
    expect(mockRegisterUser).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      password: 'newpass123',
      username: 'New User',
    });
    expect(mockLoginUser).not.toHaveBeenCalled();
  });
});
