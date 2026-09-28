import { cache as reactCache } from "react";

/**
 * Caching (Phase 92).
 *
 * Two safe primitives, no global mutable cache of user data:
 *   - `requestCache`: dedupes identical async reads within a single request
 *     (React's `cache`), which collapses duplicate queries in one render.
 *   - `ttlCache`: a tiny TTL memo for *non-tenant, non-user* derived values
 *     (e.g. the permission catalog) where staleness is harmless.
 *
 * Nothing here caches tenant or user data across requests: that would risk a
 * cross-tenant leak. Tenant-scoped reads stay in the database. Cache keys that
 * must be tenant-aware include the tenant id explicitly (see `tenantKey`).
 */

/** Wrap an async function so repeated calls with the same args in one request hit once. */
export function requestCache<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>) {
  return reactCache(fn);
}

type Entry<T> = { value: T; expiresAt: number };
const store = new Map<string, Entry<unknown>>();

/**
 * Memoise a value-producing function with a TTL. Intended only for tenant-
 * independent data; callers must include any tenant/user discriminator in the
 * key themselves.
 */
export function ttlMemo<T>(key: string, ttlMs: number, produce: () => T): T {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;
  const value = produce();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Build a cache key that is explicitly tenant-scoped (defence against leaks). */
export function tenantKey(tenantId: string, ...parts: (string | number)[]): string {
  return [tenantId, ...parts].join(":");
}

export function clearTtlCache(): void {
  store.clear();
}
