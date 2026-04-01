/**
 * Simple in-memory cache with TTL.
 * Suitable for data that rarely changes (e.g., fabric catalog).
 */
const store = new Map<string, { data: unknown; expires: number }>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown, ttlMs: number): void {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

/** 10 minutes in ms */
export const FABRIC_CACHE_TTL = 10 * 60 * 1000;
