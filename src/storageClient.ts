/**
 * Client for Azurite local storage (via the storage API server).
 * Use when Azurite and the storage API are running (npm run azurite, npm run storage-api).
 */

import { authHeaders } from './auth';

const API = '/api/storage';

export async function getKeys(): Promise<string[]> {
  const res = await fetch(API, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Storage API error: ${res.status}`);
  return res.json();
}

export async function getItem<T = string>(key: string): Promise<T | null> {
  const res = await fetch(`${API}/${encodeURIComponent(key)}`, { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Storage API error: ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export async function setItem(key: string, value: unknown): Promise<void> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }),
  });
  if (!res.ok) throw new Error(`Storage API error: ${res.status}`);
}

export async function removeItem(key: string): Promise<void> {
  const res = await fetch(`${API}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Storage API error: ${res.status}`);
}
