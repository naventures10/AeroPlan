import { create } from 'zustand';
import { fetchMe, login, logout, register } from '../api/auth';
import type { UserLogin, UserCreate, UserResponse } from '../api/auth';

interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  checkAuth: () => Promise<void>;
  loginUser: (data: UserLogin) => Promise<void>;
  registerUser: (data: UserCreate) => Promise<void>;
  logoutUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    try {
      const user = await fetchMe();
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (err: any) {
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  loginUser: async (data: UserLogin) => {
    set({ isLoading: true, error: null });
    try {
      await login(data);
      const user = await fetchMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.body || err.message || 'Login failed', isLoading: false });
      throw err;
    }
  },

  registerUser: async (data: UserCreate) => {
    set({ isLoading: true, error: null });
    try {
      await register(data);
      // Log them in immediately after registration
      await login({ email: data.email, password: data.password });
      const user = await fetchMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.body || err.message || 'Registration failed', isLoading: false });
      throw err;
    }
  },

  logoutUser: async () => {
    try {
      await logout();
    } finally {
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
