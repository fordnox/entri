import { randomBytes } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConflictError, DomainError, NotFoundError } from "@/kernel/errors.ts";
import type {
  FileStorage,
  FileStoragePolicy,
  FileStorageRouteHandler,
  PutObjectInput,
  ReadObjectResult,
  StoredObject,
} from "@/uploads/application/file-storage.ts";

/**
 * Minimal session probe the adapter needs for the browser-facing route
 * — passed in from composition so the adapter doesn't have to know the
 * shape of `AppContainer`. Resolves to the authenticated user id or null.
 */
export type UploadSessionResolver = (req: Request) => Promise<string | null>;

export interface S3FileStorageConfig {
  /**
   * Endpoint of the S3-compatible service. For Cloudflare R2 this is
   * `https://<account-id>.r2.cloudflarestorage.com`; for AWS S3 leave
   * it null and the SDK derives it from `region`.
   */
  endpoint: string | null;
  /** R2 accepts `auto`; AWS needs a real region such as `us-east-1`. */
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Path-style addressing (`endpoint/bucket/key`) instead of virtual
   * hosted (`bucket.endpoint/key`). Required by MinIO and most
   * self-hosted gateways; R2 and AWS work either way.
   */
  forcePathStyle: boolean;
  /** Optional key prefix inside the bucket, e.g. `avatars/`. */
  keyPrefix: string;
}

const KEY_PATTERN = /^(?:[a-z0-9._-]+\/)*[a-z0-9]{4}\/[a-z0-9]{32}\.[a-z0-9]{2,5}$/;

/** Presigned URLs are capped at 7 days by the SigV4 spec (R2 and AWS both enforce it). */
const MAX_PRESIGN_SECONDS = 7 * 24 * 60 * 60;

/** Lifetime of the read URL handed back by the browser-facing upload route. */
const DIRECT_UPLOAD_READ_URL_SECONDS = 15 * 60;

/**
 * Adapter for any S3-compatible object store — Cloudflare R2 is the
 * primary target, but AWS S3, MinIO, Backblaze B2, Tigris and friends
 * speak the same API and only differ in `endpoint`.
 *
 * Objects are written with no public ACL (R2 buckets are private by
 * default; on AWS, keep "block public access" on) and read through
 * presigned GetObject URLs, so nothing stored is reachable without
 * going through the API's authorization first — the same privacy model
 * as the UploadThing adapter.
 *
 * Keys are generated server-side (`<prefix><shard>/<random>.<ext>`)
 * and never derived from the client-supplied filename.
 *
 * The browser-facing route mounted at `/v1/uploads` is a plain
 * multipart POST proxied through the API (the bytes pass through this
 * process, then go to the bucket) — there is no provider-specific
 * client SDK, so the web app uploads with a `fetch` + `FormData`. It
 * answers with the stored key and a short-lived read URL per file.
 */
export class S3FileStorage implements FileStorage {
  readonly provider = "s3";
  readonly canStore = true;
  readonly policy: FileStoragePolicy;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly resolveSession: UploadSessionResolver;

  /** `client` is injectable so tests can stub `send` without network access. */
  constructor(
    policy: FileStoragePolicy,
    config: S3FileStorageConfig,
    resolveSession: UploadSessionResolver,
    client?: S3Client,
  ) {
    this.policy = policy;
    this.bucket = config.bucket;
    this.keyPrefix = normalizePrefix(config.keyPrefix);
    this.resolveSession = resolveSession;
    this.client = client ?? new S3Client(toClientConfig(config));
  }

  routeHandler(): FileStorageRouteHandler {
    return async (req) => {
      if (req.method === "GET") {
        return json(200, { provider: this.provider, policy: this.policy });
      }
      if (req.method !== "POST") {
        return json(405, {
          error: { code: "uploads.method_not_allowed", message: "use POST multipart/form-data" },
        });
      }
      try {
        return await this.handleDirectUpload(req);
      } catch (err) {
        if (err instanceof DomainError) {
          return json(err.status, { error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    };
  }

  /**
   * `POST /v1/uploads` — multipart body with one or more `file` parts.
   * Session, count, type and size are all checked before any byte is
   * sent to the bucket. The whole body is buffered (the policy caps it
   * at a few MiB), so the `content-length` header is bounded first to
   * refuse oversized requests before parsing.
   */
  private async handleDirectUpload(req: Request): Promise<Response> {
    const userId = await this.resolveSession(req);
    if (!userId) {
      return json(401, { error: { code: "unauthorized", message: "sign in to upload" } });
    }

    const { maxFileSizeBytes, maxFilesPerUpload, allowedMimeTypes } = this.policy;
    const declared = Number(req.headers.get("content-length") ?? "0");
    // Multipart framing + field names are small; 1 MiB of slack is plenty.
    if (declared > maxFileSizeBytes * maxFilesPerUpload + 1024 * 1024) {
      throw new DomainError("uploads.file_too_large", "upload exceeds the size limit", 400);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new DomainError("uploads.invalid_body", "expected multipart/form-data", 400);
    }
    const files = form.getAll("file").filter((v): v is File => v instanceof File);
    if (files.length === 0) {
      throw new DomainError("uploads.no_file", "attach at least one `file` part", 400);
    }
    if (files.length > maxFilesPerUpload) {
      throw new DomainError(
        "uploads.too_many_files",
        `at most ${maxFilesPerUpload} file(s) per upload`,
        400,
      );
    }
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.type)) {
        throw new DomainError(
          "uploads.unsupported_type",
          `unsupported content type ${file.type || "(none)"}`,
          400,
        );
      }
      if (file.size > maxFileSizeBytes) {
        throw new DomainError(
          "uploads.file_too_large",
          `${file.name} exceeds ${maxFileSizeBytes} bytes`,
          400,
        );
      }
    }

    const stored = [];
    for (const file of files) {
      const body = new Uint8Array(await file.arrayBuffer());
      const object = await this.put({ body, contentType: file.type, filename: file.name });
      stored.push({
        uploadedBy: userId,
        key: object.key,
        name: file.name,
        size: object.sizeBytes,
        type: file.type,
        url: await this.signedReadUrl(object.key, {
          expiresInSeconds: DIRECT_UPLOAD_READ_URL_SECONDS,
        }),
      });
    }
    return json(200, { files: stored });
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    if (!this.policy.allowedMimeTypes.includes(input.contentType)) {
      throw new ConflictError(
        "uploads.unsupported_type",
        `unsupported content type ${input.contentType}`,
      );
    }
    const ext = extensionFromContentType(input.contentType);
    const id = randomBytes(16).toString("hex");
    const key = `${this.keyPrefix}${id.slice(0, 4)}/${id}.${ext}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: input.body,
          ContentType: input.contentType,
          ContentLength: input.body.byteLength,
        }),
      );
    } catch (err) {
      throw providerError(`upload failed: ${describe(err)}`);
    }
    return { key, sizeBytes: input.body.byteLength };
  }

  async read(storageKey: string): Promise<ReadObjectResult> {
    this.assertKey(storageKey);
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      if (!res.Body) throw new NotFoundError("file");
      const body = await res.Body.transformToByteArray();
      return {
        body,
        contentType: res.ContentType ?? contentTypeFromKey(storageKey),
      };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (err instanceof NoSuchKey || statusOf(err) === 404) throw new NotFoundError("file");
      throw providerError(`failed to read object ${storageKey}: ${describe(err)}`);
    }
  }

  async signedReadUrl(
    storageKey: string,
    opts: { expiresInSeconds: number },
  ): Promise<string> {
    this.assertKey(storageKey);
    // Clamp so a generous TTL doesn't become a signing error.
    const expiresIn = Math.min(MAX_PRESIGN_SECONDS, Math.max(1, Math.floor(opts.expiresInSeconds)));
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn },
    );
  }

  async delete(storageKey: string): Promise<void> {
    if (!KEY_PATTERN.test(storageKey)) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    } catch {
      // Best-effort; callers GC orphans on their next pass.
    }
  }

  private assertKey(storageKey: string): void {
    if (!KEY_PATTERN.test(storageKey)) throw new NotFoundError("file");
  }
}

function toClientConfig(config: S3FileStorageConfig): S3ClientConfig {
  return {
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // R2 rejects requests that include the SDK's default checksum
    // headers for streaming bodies; sending them only when explicitly
    // required matches Cloudflare's documented SDK setup.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  };
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "";
  if (!/^[a-z0-9._-]+(?:\/[a-z0-9._-]+)*$/.test(trimmed)) {
    throw new Error(
      `S3_KEY_PREFIX='${prefix}' is invalid; use lowercase letters, digits, '.', '_', '-' and '/'`,
    );
  }
  return `${trimmed}/`;
}

function extensionFromContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "application/json":
      return "json";
    default:
      throw new ConflictError("uploads.unsupported_type", `unsupported content type ${contentType}`);
  }
}

export function contentTypeFromKey(storageKey: string): string {
  const ext = storageKey.split(".").pop();
  switch (ext) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function providerError(message: string): ConflictError {
  return new ConflictError("uploads.provider_error", message);
}

function statusOf(err: unknown): number | undefined {
  return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
