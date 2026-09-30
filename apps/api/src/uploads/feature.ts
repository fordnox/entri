/**
 * Uploads doesn't contribute to the `services` record — it supplies a
 * `FileStorage` to the top of the container, consumed by the uploads
 * controller directly. Keeping its wiring here (instead of inline in
 * `composition.ts`) puts all upload-related code under one folder so
 * the generator can strip `uploads/` + its fenced region in composition
 * as a single unit.
 *
 * Provider selection (`UPLOADS_PROVIDER`):
 *   - `uploadthing` — hosted, private ACL + signed reads. Needs
 *     `UPLOADTHING_TOKEN`.
 *   - `s3` — any S3-compatible bucket (Cloudflare R2, AWS S3, MinIO,
 *     Backblaze B2…), private objects + presigned reads. Needs
 *     `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and, for
 *     anything but AWS, `S3_ENDPOINT`. `S3_REGION` defaults to `auto`
 *     (what R2 expects); `S3_FORCE_PATH_STYLE=true` for MinIO-style
 *     gateways; `S3_KEY_PREFIX` namespaces keys inside a shared bucket.
 *     `r2` is accepted as an alias.
 *   - `noop` — storage disabled; the upload route answers 501 and the
 *     server-side methods throw `uploads.not_configured`.
 * When unset: `uploadthing` if a token is present, `s3` if a bucket is
 * configured, otherwise `noop`.
 */
import type { AppConfig } from "@/composition.ts";
import type { buildBetterAuth } from "@/interfaces/http/better-auth.ts";
import type { FileStorage, FileStoragePolicy } from "@/uploads/application/file-storage.ts";
import { NoopFileStorage } from "@/uploads/infrastructure/noop-file-storage.ts";
import {
  S3FileStorage,
  type S3FileStorageConfig,
  type UploadSessionResolver,
} from "@/uploads/infrastructure/s3-file-storage.ts";
import { UploadthingFileStorage } from "@/uploads/infrastructure/uploadthing-file-storage.ts";

export type UploadsProviderKey = "uploadthing" | "s3" | "noop";

export interface UploadsConfig {
  provider: UploadsProviderKey;
  uploadthingToken: string | null;
  /** Present when the mandatory `S3_*` keys are set; used only if the provider is `s3`. */
  s3: S3FileStorageConfig | null;
  policy: FileStoragePolicy;
}

export function readUploadsConfig(env: NodeJS.ProcessEnv = process.env): UploadsConfig {
  const token = env.UPLOADTHING_TOKEN?.trim() || null;
  const s3 = readS3Config(env);
  const raw = env.UPLOADS_PROVIDER?.trim().toLowerCase();
  let provider: UploadsProviderKey;
  if (raw === "uploadthing" || raw === "s3" || raw === "noop") {
    provider = raw;
  } else if (raw === "r2") {
    // Friendly alias — R2 is the S3 adapter pointed at Cloudflare.
    provider = "s3";
  } else if (raw && raw !== "none") {
    throw new Error(
      `UPLOADS_PROVIDER='${raw}' is not supported; expected uploadthing, s3, or noop`,
    );
  } else if (token) {
    provider = "uploadthing";
  } else if (s3) {
    provider = "s3";
  } else {
    provider = "noop";
  }
  if (provider === "uploadthing" && !token) {
    throw new Error("UPLOADS_PROVIDER=uploadthing requires UPLOADTHING_TOKEN");
  }
  if (provider === "s3" && !s3) {
    throw new Error(
      "UPLOADS_PROVIDER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (plus S3_ENDPOINT for R2 and other non-AWS stores)",
    );
  }
  return {
    provider,
    uploadthingToken: token,
    s3,
    policy: {
      allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
      maxFileSizeBytes: 16 * 1024 * 1024,
      maxFilesPerUpload: 1,
    },
  };
}

/**
 * Returns null unless the three mandatory S3 keys are all present, so
 * a half-configured bucket never silently picks the adapter — the
 * caller reports the missing keys instead.
 */
function readS3Config(env: NodeJS.ProcessEnv): S3FileStorageConfig | null {
  const bucket = env.S3_BUCKET?.trim() || null;
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim() || null;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim() || null;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  const endpoint = env.S3_ENDPOINT?.trim().replace(/\/+$/, "") || null;
  if (endpoint && !/^https?:\/\//.test(endpoint)) {
    throw new Error(`S3_ENDPOINT='${endpoint}' must be an absolute http(s) URL`);
  }
  return {
    endpoint,
    region: env.S3_REGION?.trim() || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: /^(1|true|yes)$/i.test(env.S3_FORCE_PATH_STYLE?.trim() ?? ""),
    keyPrefix: env.S3_KEY_PREFIX?.trim() ?? "",
  };
}

export function buildFileStorage(
  config: AppConfig,
  auth: ReturnType<typeof buildBetterAuth>,
): FileStorage {
  const uploads = config.uploads;
  const resolveSession: UploadSessionResolver = async (req) => {
    const res = await auth.api.getSession({ headers: req.headers });
    return res?.user?.id ?? null;
  };
  if (uploads.provider === "uploadthing" && uploads.uploadthingToken) {
    return new UploadthingFileStorage(
      uploads.policy,
      { token: uploads.uploadthingToken },
      resolveSession,
    );
  }
  if (uploads.provider === "s3" && uploads.s3) {
    return new S3FileStorage(uploads.policy, uploads.s3, resolveSession);
  }
  return new NoopFileStorage(uploads.policy);
}
