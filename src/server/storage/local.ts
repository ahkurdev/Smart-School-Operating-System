import { mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import type { StorageProvider, StoredObject } from "@/server/storage";

/**
 * Local filesystem storage for development. Keys are mapped under a single root
 * and every resolved path is verified to stay inside that root, so a crafted key
 * (`../../etc/passwd`) cannot escape — the storage layer never trusts the key.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private resolveKey(key: string): string {
    const safe = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = resolve(join(this.root, safe));
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    return { key, size: data.length, mimeType };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolveKey(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await rm(this.resolveKey(key), { force: true });
    } catch {
      /* idempotent */
    }
  }

  async getUrl(): Promise<string | null> {
    // Local files are served through the authorised /api/files route, not a URL.
    return null;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }
}
