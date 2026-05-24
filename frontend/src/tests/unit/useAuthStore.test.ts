import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../store/useAuthStore';
import * as authApi from '../../api/auth';

vi.mock('../../api/auth', () => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('checkAuth handles success', async () => {
    const mockUser = {
      id: '1',
      username: null,
      email: 'test@test.com',
      is_active: true,
      created_at: '',
      updated_at: '',
    };
    vi.mocked(authApi.fetchMe).mockResolvedValueOnce(mockUser);

    const store = useAuthStore.getState();
    await store.checkAuth();

    expect(authApi.fetchMe).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('checkAuth handles failure', async () => {
    vi.mocked(authApi.fetchMe).mockRejectedValueOnce(new Error('Failed'));

    const store = useAuthStore.getState();
    await store.checkAuth();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('loginUser handles success', async () => {
    const mockUser = {
      id: '1',
      username: null,
      email: 'test@test.com',
      is_active: true,
      created_at: '',
      updated_at: '',
    };
    vi.mocked(authApi.login).mockResolvedValueOnce({ message: 'Success' });
    vi.mocked(authApi.fetchMe).mockResolvedValueOnce(mockUser);

    const store = useAuthStore.getState();
    await store.loginUser({ email: 'test@test.com', password: 'password' });

    expect(authApi.login).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password' });
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
