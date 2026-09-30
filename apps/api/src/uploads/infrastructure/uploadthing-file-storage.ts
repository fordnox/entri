import {
  UTApi,
  UploadThingError,
  createRouteHandler,
  createUploadthing,
  type FileRouter,
} from "uploadthing/server";
import { ConflictError } from "@/kernel/errors.ts";
import type {
  FileStorage,
  FileStoragePolicy,
  FileStorageRouteHandler,
  PutObjectInput,
  ReadObjectResult,
  StoredObject,
} from "@/uploads/application/file-storage.ts";

/**
 * Minimal session probe the adapter needs — passed in from composition
 * so the adapter doesn't have to know the shape of `AppContainer`.
 * Resolves to the authenticated user id or null.
 */
export type UploadSessionResolver = (req: Request) => Promise<string | null>;

export interface UploadthingFileStorageConfig {
  token: string;
}

/**
 * Build the UploadThing file router. Exposes a single generic upload
 * slot (`image`) for workspace/avatar images. Applications that build
 * on top of this kit can add more slots by subclassing or wrapping the
 * router factory.
 */
function buildRouter(
  resolveSession: UploadSessionResolver,
  policy: FileStoragePolicy,
): FileRouter {
  const f = createUploadthing();
  const maxFileSize = formatSize(policy.maxFileSizeBytes) as "16MB";
  return {
    image: f({
      image: {
        maxFileSize,
        maxFileCount: policy.maxFilesPerUpload,
      },
    })
      .middleware(async ({ req }) => {
        const userId = await resolveSession(req);
        if (!userId) {
          throw new UploadThingError({
            code: "FORBIDDEN",
            message: "sign in to upload",
          });
        }
        return { userId };
      })
      .onUploadComplete(async ({ metadata, file }) => ({
        uploadedBy: metadata.userId,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
      })),
  } satisfies FileRouter;
}

function formatSize(bytes: number): `${number}${"B" | "KB" | "MB" | "GB"}` {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024 * 1024))}GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/**
 * UploadThing adapter. The browser-direct route is UploadThing's own
 * protocol (`createRouteHandler`); the server-side path writes objects
 * with `acl: "private"` and reads them back through `generateSignedURL`,
 * so nothing stored that way is reachable without going through the
 * API's authorization first. See
 * https://docs.uploadthing.com/concepts/regions-acl
 */
export class UploadthingFileStorage implements FileStorage {
  readonly provider = "uploadthing";
  readonly canStore = true;
  readonly policy: FileStoragePolicy;
  private readonly utapi: UTApi;
  private readonly handler: (req: Request) => Promise<Response>;

  constructor(
    policy: FileStoragePolicy,
    config: UploadthingFileStorageConfig,
    resolveSession: UploadSessionResolver,
  ) {
    this.policy = policy;
    this.utapi = new UTApi({ token: config.token });
    const router = buildRouter(resolveSession, policy);
    const handle = createRouteHandler({
      router,
      config: { token: config.token },
    });
    this.handler = (req) => handle(req);
  }

  routeHandler(): FileStorageRouteHandler {
    return this.handler;
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const file = new File([input.body as BlobPart], input.filename, { type: input.contentType });
    const result = await this.utapi.uploadFiles(file, { acl: "private" });
    if (result.error || !result.data) {
      throw new ConflictError(
        "uploads.provider_error",
        `upload failed: ${result.error?.message ?? "unknown error"}`,
      );
    }
    return { key: result.data.key, sizeBytes: result.data.size };
  }

  async read(storageKey: string): Promise<ReadObjectResult> {
    const url = await this.signedReadUrl(storageKey, { expiresInSeconds: 120 });
    const res = await fetch(url);
    if (!res.ok) {
      throw new ConflictError(
        "uploads.provider_error",
        `failed to read object ${storageKey}: HTTP ${res.status}`,
      );
    }
    return {
      body: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get("content-type"),
    };
  }

  async signedReadUrl(
    storageKey: string,
    opts: { expiresInSeconds: number },
  ): Promise<string> {
    const { ufsUrl } = await this.utapi.generateSignedURL(storageKey, {
      expiresIn: `${Math.max(1, Math.floor(opts.expiresInSeconds))}s`,
    });
    return ufsUrl;
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await this.utapi.deleteFiles([storageKey]);
    } catch {
      // Best-effort; provider will GC stale blobs eventually.
    }
  }
}
