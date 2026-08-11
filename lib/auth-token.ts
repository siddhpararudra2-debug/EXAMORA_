const TOKEN_KEY = "examora_token";
const USER_KEY = "examora_user";

export interface AuthUser {
  id?: string;
  name: string;
  email: string;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser): void {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  }
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Redirects to /login when a request returns 401 (invalid/expired session).
 * Clears stale credentials first so guards and subsequent fetches see
 * the user as logged out.
 */
export function handleAuthFailure(): void {
  clearAuthToken();
  if (typeof window !== "undefined") {
    window.location.assign("/login");
  }
}
