import { createHash, createHmac } from "node:crypto";
import type { StorageProvider, StoredObject } from "@/server/storage";
import { getEnv } from "@/lib/env";

/**
 * S3-compatible storage using AWS Signature V4 computed with node:crypto — no
 * SDK dependency. Works with AWS S3, MinIO, Cloudflare R2, Backblaze B2, Wasabi,
 * etc. by pointing S3_ENDPOINT at the service.
 *
 * Path-style addressing is used (`endpoint/bucket/key`) which the S3-compatible
 * providers all support, avoiding DNS/vhost complications.
 */

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export class S3StorageProvider implements StorageProvider {
  private readonly endpoint: string;
  private readonly region: string;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly forcePathStyle: boolean;

  constructor() {
    const env = getEnv();
    this.endpoint = env.S3_ENDPOINT.replace(/\/$/, "");
    this.region = env.S3_REGION || "us-east-1";
    this.bucket = env.S3_BUCKET;
    this.accessKeyId = env.S3_ACCESS_KEY_ID;
    this.secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    this.forcePathStyle = env.S3_FORCE_PATH_STYLE;
    if (!this.endpoint || !this.bucket || !this.accessKeyId || !this.secretAccessKey) {
      throw new Error("S3 storage selected but S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are not all set.");
    }
  }

  private objectUrl(key: string): { url: URL; host: string; path: string } {
    const encoded = key.split("/").map(encodeURIComponent).join("/");
    const url = this.forcePathStyle
      ? new URL(`${this.endpoint}/${this.bucket}/${encoded}`)
      : new URL(`${this.endpoint.replace("://", `://${this.bucket}.`)}/${encoded}`);
    return { url, host: url.host, path: url.pathname };
  }

  /** Build SigV4 Authorization headers for one request. */
  private sign(method: string, key: string, payloadHash: string, extraHeaders: Record<string, string> = {}) {
    const { url, host, path } = this.objectUrl(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...extraHeaders,
    };
    const signedHeaders = Object.keys(headers).map((h) => h.toLowerCase()).sort();
    const canonicalHeaders = signedHeaders.map((h) => `${h}:${headers[h] ?? headers[h.toLowerCase()]}\n`).join("");
    const canonicalRequest = [
      method,
      path,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders.join(";"),
      payloadHash,
    ].join("\n");

    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
    return { url, headers: { ...headers, Authorization: authorization, ...extraHeaders } };
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const { url, headers } = this.sign("PUT", key, sha256Hex(data), { "content-type": mimeType });
    const res = await fetch(url, { method: "PUT", headers, body: new Uint8Array(data) });
    if (!res.ok) throw new Error(`S3 put failed: ${res.status}`);
    return { key, size: data.length, mimeType };
  }

  async get(key: string): Promise<Buffer | null> {
    const { url, headers } = this.sign("GET", key, sha256Hex(""));
    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`S3 get failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const { url, headers } = this.sign("DELETE", key, sha256Hex(""));
    await fetch(url, { method: "DELETE", headers });
  }

  /** Presigned GET URL (query-string signing), valid for one hour. */
  async getUrl(key: string): Promise<string | null> {
    const { url, host, path } = this.objectUrl(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const credential = `${this.accessKeyId}/${scope}`;

    url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
    url.searchParams.set("X-Amz-Credential", credential);
    url.searchParams.set("X-Amz-Date", amzDate);
    url.searchParams.set("X-Amz-Expires", "3600");
    url.searchParams.set("X-Amz-SignedHeaders", "host");

    const canonicalQuery = [...url.searchParams.entries()]
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .sort()
      .join("&");
    const canonicalRequest = ["GET", path, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    url.searchParams.set("X-Amz-Signature", signature);
    return url.toString();
  }

  async exists(key: string): Promise<boolean> {
    const { url, headers } = this.sign("HEAD", key, sha256Hex(""));
    const res = await fetch(url, { method: "HEAD", headers });
    return res.ok;
  }
}
