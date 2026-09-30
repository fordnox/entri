/**
 * Upload policy enforced by the provider-side file router. Kept as a
 * plain value object so adapters can translate it into provider-native
 * constraints at router-build time (e.g. UploadThing's size bucket
 * strings, S3 presign lifetimes, etc.).
 */
export interface FileStoragePolicy {
  readonly allowedMimeTypes: readonly string[];
  readonly maxFileSizeBytes: number;
  readonly maxFilesPerUpload: number;
}

/**
 * Single handler that responds to GET (config probe) and POST (the
 * actual upload signing / callback). Matches UploadThing v7's
 * `createRouteHandler` shape so adapters for S3-style providers can
 * branch on `request.method` without leaking details.
 */
export type FileStorageRouteHandler = (request: Request) => Promise<Response>;

export interface StoredObject {
  /** Provider-specific key. Persist this; never persist a URL. */
  readonly key: string;
  readonly sizeBytes: number;
}

export interface PutObjectInput {
  readonly body: Uint8Array;
  readonly contentType: string;
  /** Display name only — never used as the storage key. */
  readonly filename: string;
}

export interface ReadObjectResult {
  readonly body: Uint8Array;
  readonly contentType: string | null;
}

/**
 * Storage port. Anything we plug in — UploadThing, any S3-compatible
 * bucket (Cloudflare R2, AWS S3, MinIO…), or the no-op adapter — speaks
 * this and nothing more.
 *
 *  - `routeHandler()` mounts the provider's browser-facing upload route
 *    under `/v1/uploads` (avatar-style uploads).
 *  - `put()` / `read()` / `signedReadUrl()` are the **server-side**
 *    path: the API receives the bytes, validates them, stores them
 *    privately, and mints short-lived read URLs only after the caller's
 *    authorization has been checked.
 *  - `delete()` is best-effort cleanup used by higher-level services
 *    (e.g. when a user replaces an avatar and we want to GC the old
 *    blob).
 */
export interface FileStorage {
  readonly provider: string;
  readonly policy: FileStoragePolicy;
  /** False for the no-op adapter — callers surface a configuration message. */
  readonly canStore: boolean;
  routeHandler(): FileStorageRouteHandler;
  put(input: PutObjectInput): Promise<StoredObject>;
  read(storageKey: string): Promise<ReadObjectResult>;
  signedReadUrl(storageKey: string, opts: { expiresInSeconds: number }): Promise<string>;
  delete(storageKey: string): Promise<void>;
}
