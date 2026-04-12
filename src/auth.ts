const TOKEN_KEY = 'otp_auth_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function parsePayload(token: string): { exp?: number } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function isTokenValid(token: string): boolean {
  const payload = parsePayload(token);
  return typeof payload?.exp === 'number' && payload.exp * 1000 > Date.now();
}

/** Milliseconds since epoch when the current token expires, or null if missing/invalid. */
export function getTokenExpiryMs(): number | null {
  const token = getToken();
  if (!token) return null;
  const payload = parsePayload(token);
  if (typeof payload?.exp !== 'number') return null;
  return payload.exp * 1000;
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
