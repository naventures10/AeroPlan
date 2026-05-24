import { ApiError } from './client';

const API_BASE = '/api/v1/auth';

export interface UserCreate {
  email: string;
  password?: string;
}

export interface UserLogin {
  email: string;
  password?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function fetchAuth<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => undefined);
    try {
      const json = JSON.parse(body || '');
      throw new ApiError(res.status, path, json.detail || body);
    } catch {
      throw new ApiError(res.status, path, body);
    }
  }
  return res.json();
}

export async function login(data: UserLogin) {
  return fetchAuth<{ message: string }>('/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function register(data: UserCreate) {
  return fetchAuth<UserResponse>('/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logout() {
  return fetchAuth<{ message: string }>('/logout', {
    method: 'POST',
  });
}

export async function fetchMe() {
  return fetchAuth<UserResponse>('/me', {
    method: 'GET',
  });
}
