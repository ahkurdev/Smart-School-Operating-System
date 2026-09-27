/**
 * Storage provider abstraction. The database stores only file metadata and a
 * `storageKey`; the bytes live behind whichever provider is configured. Local
 * filesystem for development, S3-compatible (or any object store) for
 * production. Swapping providers must not require changes to callers.
 */
export type StoredObject = {
  key: string;
  size: number;
  mimeType: string;
};

export interface StorageProvider {
  /** Persist bytes and return the storage key. */
  put(key: string, data: Buffer, mimeType: string): Promise<StoredObject>;
  /** Retrieve bytes, or null if absent. */
  get(key: string): Promise<Buffer | null>;
  /** Delete an object (idempotent). */
  delete(key: string): Promise<void>;
  /** A direct URL when the provider can serve one (e.g. a signed S3 URL). */
  getUrl(key: string): Promise<string | null>;
  /** Whether a `put` overwrites silently. Local writes are atomic. */
  exists(key: string): Promise<boolean>;
}

import { LocalStorageProvider } from "@/server/storage/local";
import { S3StorageProvider } from "@/server/storage/s3";
import { getEnv } from "@/lib/env";

let cached: StorageProvider | null = null;

/** Resolve the configured storage provider (singleton). */
export function getStorage(): StorageProvider {
  if (cached) return cached;
  const env = getEnv();
  cached =
    env.STORAGE_PROVIDER === "s3"
      ? new S3StorageProvider()
      : new LocalStorageProvider(env.STORAGE_LOCAL_DIR);
  return cached;
}
