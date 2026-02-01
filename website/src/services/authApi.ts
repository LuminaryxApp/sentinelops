/**
 * Auth API client for the website. Uses Vercel serverless functions that connect to Turso.
 * Same database as the app = shared accounts.
 * 
 * If VITE_AUTH_API_URL is set, uses external API (for development/testing).
 * Otherwise, uses local API routes (/api/auth/*) which are Vercel serverless functions.
 */

const AUTH_API = import.meta.env.VITE_AUTH_API_URL || '';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  subscription: {
    plan: 'free' | 'pro' | 'team';
    status: string;
    expiresAt: string | null;
  };
}

const TOKEN_KEY = 'sentinelops_auth_token';
const USER_KEY = 'sentinelops_auth_user';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeSession(user: AuthUser, token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  // Use external API if configured, otherwise use local API routes
  const baseUrl = AUTH_API || '';
  const url = baseUrl ? `${baseUrl}${path}` : path;
  
  return fetch(url, { ...options, headers });
}

export async function signUp(email: string, password: string, name: string): Promise<{ success: boolean; user?: AuthUser; token?: string; error?: string }> {
  const res = await authFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error || 'Sign up failed' };
  }
  if (data.success && data.user && data.token) {
    storeSession(data.user, data.token);
    return { success: true, user: data.user, token: data.token };
  }
  return { success: false, error: data.error || 'Sign up failed' };
}

export async function signIn(email: string, password: string): Promise<{ success: boolean; user?: AuthUser; token?: string; error?: string }> {
  const res = await authFetch('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error || 'Sign in failed' };
  }
  if (data.success && data.user && data.token) {
    storeSession(data.user, data.token);
    return { success: true, user: data.user, token: data.token };
  }
  return { success: false, error: data.error || 'Sign in failed' };
}

export async function signOut(): Promise<void> {
  await authFetch('/api/auth/signout', { method: 'POST' });
  clearSession();
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await authFetch('/api/auth/me');
  const data = await res.json();
  if (!res.ok || !data.success || !data.user) {
    clearSession();
    return null;
  }
  storeSession(data.user, getToken()!);
  return data.user;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
