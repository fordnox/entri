import { ConflictError } from "@/kernel/errors.ts";
import type {
  FileStorage,
  FileStoragePolicy,
  FileStorageRouteHandler,
  PutObjectInput,
  ReadObjectResult,
  StoredObject,
} from "@/uploads/application/file-storage.ts";

export const UPLOADS_NOT_CONFIGURED_MESSAGE =
  "file storage is not configured: set UPLOADTHING_TOKEN or the S3_* keys";

/**
 * Fallback `FileStorage` used when no upload provider is configured
 * (e.g. local dev without `UPLOADTHING_TOKEN` or the `S3_*` keys).
 * Every write path refuses loudly — the route answers 501, the
 * server-side methods throw `uploads.not_configured` — so the feature
 * never silently half-works. Upload buttons in the UI can still
 * render, they just won't store anything.
 *
 * Keeping the same port shape means the rest of the stack doesn't
 * fork on "is storage configured?" — the adapter answers that
 * question for everyone (via `canStore`).
 */
export class NoopFileStorage implements FileStorage {
  readonly provider = "noop";
  readonly canStore = false;
  readonly policy: FileStoragePolicy;

  constructor(policy: FileStoragePolicy) {
    this.policy = policy;
  }

  routeHandler(): FileStorageRouteHandler {
    return async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "uploads.not_configured",
            message:
              "file uploads are disabled: set UPLOADTHING_TOKEN or the S3_* keys to enable",
          },
        }),
        { status: 501, headers: { "content-type": "application/json" } },
      );
  }

  async put(_input: PutObjectInput): Promise<StoredObject> {
    throw new ConflictError("uploads.not_configured", UPLOADS_NOT_CONFIGURED_MESSAGE);
  }

  async read(_storageKey: string): Promise<ReadObjectResult> {
    throw new ConflictError("uploads.not_configured", UPLOADS_NOT_CONFIGURED_MESSAGE);
  }

  async signedReadUrl(): Promise<string> {
    throw new ConflictError("uploads.not_configured", UPLOADS_NOT_CONFIGURED_MESSAGE);
  }

  async delete(_storageKey: string): Promise<void> {
    // No-op: nothing was stored, nothing to delete.
  }
}
