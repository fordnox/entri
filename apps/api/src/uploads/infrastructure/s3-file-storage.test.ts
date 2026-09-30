import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "@/kernel/errors.ts";
import type { FileStoragePolicy } from "@/uploads/application/file-storage.ts";
import { S3FileStorage, type S3FileStorageConfig } from "./s3-file-storage.ts";

const policy: FileStoragePolicy = {
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  maxFileSizeBytes: 16 * 1024 * 1024,
  maxFilesPerUpload: 1,
};

const r2: S3FileStorageConfig = {
  endpoint: "https://acct.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "orbit-files",
  accessKeyId: "AKIATEST",
  secretAccessKey: "secret",
  forcePathStyle: false,
  keyPrefix: "",
};

const KEY = "abcd/abcdabcdabcdabcdabcdabcdabcdabcd.png";

function makeStorage(
  config: Partial<S3FileStorageConfig> = {},
  opts: { userId?: string | null; policy?: FileStoragePolicy } = {},
) {
  const merged = { ...r2, ...config };
  const client = new S3Client({
    region: merged.region,
    endpoint: merged.endpoint ?? undefined,
    forcePathStyle: merged.forcePathStyle,
    credentials: { accessKeyId: merged.accessKeyId, secretAccessKey: merged.secretAccessKey },
  });
  const send = vi.spyOn(client, "send").mockResolvedValue({} as never);
  const resolveSession = vi.fn(async () => opts.userId === undefined ? "user_1" : opts.userId);
  const storage = new S3FileStorage(opts.policy ?? policy, merged, resolveSession, client);
  return { storage, send, resolveSession };
}

function multipart(files: { name: string; type: string; bytes: Uint8Array }[]) {
  const form = new FormData();
  for (const f of files) form.append("file", new File([f.bytes as BlobPart], f.name, { type: f.type }));
  return new Request("http://x/v1/uploads", { method: "POST", body: form });
}

describe("S3FileStorage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("puts objects under a random sharded key and reports the size", async () => {
    const { storage, send } = makeStorage();
    const body = new Uint8Array([1, 2, 3, 4]);
    const stored = await storage.put({ body, contentType: "image/png", filename: "cover.png" });

    expect(stored.sizeBytes).toBe(4);
    expect(stored.key).toMatch(/^[a-z0-9]{4}\/[a-z0-9]{32}\.png$/);
    expect(stored.key.startsWith(stored.key.slice(5, 9))).toBe(true);

    const cmd = send.mock.calls[0]![0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({
      Bucket: "orbit-files",
      Key: stored.key,
      ContentType: "image/png",
      ContentLength: 4,
    });
  });

  it("applies the key prefix", async () => {
    const { storage } = makeStorage({ keyPrefix: "/avatars/prod/" });
    const stored = await storage.put({
      body: new Uint8Array(1),
      contentType: "image/jpeg",
      filename: "x",
    });
    expect(stored.key).toMatch(/^avatars\/prod\/[a-z0-9]{4}\/[a-z0-9]{32}\.jpg$/);
  });

  it("rejects an invalid key prefix at construction", () => {
    expect(() => makeStorage({ keyPrefix: "Bad Prefix!" })).toThrow(/S3_KEY_PREFIX/);
  });

  it("rejects content types outside the policy before touching the bucket", async () => {
    const { storage, send } = makeStorage();
    await expect(
      storage.put({ body: new Uint8Array(1), contentType: "image/svg+xml", filename: "x" }),
    ).rejects.toMatchObject({ code: "uploads.unsupported_type" });
    expect(send).not.toHaveBeenCalled();
  });

  it("wraps provider failures on put as uploads.provider_error", async () => {
    const { storage, send } = makeStorage();
    send.mockRejectedValueOnce(new Error("AccessDenied"));
    await expect(
      storage.put({ body: new Uint8Array(1), contentType: "image/png", filename: "x" }),
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof ConflictError &&
        e.code === "uploads.provider_error" &&
        e.message.includes("AccessDenied"),
    );
  });

  it("reads objects back with the stored content type", async () => {
    const { storage, send } = makeStorage();
    send.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array([9, 9]) },
      ContentType: "image/png",
    } as never);

    const res = await storage.read(KEY);
    expect(res).toEqual({ body: new Uint8Array([9, 9]), contentType: "image/png" });
    const cmd = send.mock.calls[0]![0] as GetObjectCommand;
    expect(cmd).toBeInstanceOf(GetObjectCommand);
    expect(cmd.input).toEqual({ Bucket: "orbit-files", Key: KEY });
  });

  it("falls back to the extension when the store returns no content type", async () => {
    const { storage, send } = makeStorage();
    send.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array(0) },
    } as never);
    const res = await storage.read("abcd/abcdabcdabcdabcdabcdabcdabcdabcd.webp");
    expect(res.contentType).toBe("image/webp");
  });

  it("maps a missing object to NotFoundError", async () => {
    const { storage, send } = makeStorage();
    send.mockRejectedValueOnce(
      new NoSuchKey({ message: "gone", $metadata: { httpStatusCode: 404 } }),
    );
    await expect(storage.read(KEY)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses malformed keys without calling the store", async () => {
    const { storage, send } = makeStorage();
    await expect(storage.read("../../etc/passwd")).rejects.toBeInstanceOf(NotFoundError);
    await expect(storage.signedReadUrl("nope", { expiresInSeconds: 60 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await storage.delete("nope");
    expect(send).not.toHaveBeenCalled();
  });

  it("mints presigned GetObject URLs against the configured endpoint", async () => {
    const { storage, send } = makeStorage();
    const url = new URL(await storage.signedReadUrl(KEY, { expiresInSeconds: 900 }));

    expect(url.host).toBe("orbit-files.acct.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/${KEY}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-Credential")).toContain("AKIATEST/");
    // Presigning is local — no request leaves the process.
    expect(send).not.toHaveBeenCalled();
  });

  it("uses path-style URLs when asked", async () => {
    const { storage } = makeStorage({
      endpoint: "http://localhost:9000",
      forcePathStyle: true,
    });
    const url = new URL(await storage.signedReadUrl(KEY, { expiresInSeconds: 60 }));
    expect(url.host).toBe("localhost:9000");
    expect(url.pathname).toBe(`/orbit-files/${KEY}`);
  });

  it("clamps presign lifetimes to the seven-day SigV4 maximum", async () => {
    const { storage } = makeStorage();
    const url = new URL(
      await storage.signedReadUrl(KEY, { expiresInSeconds: 30 * 24 * 60 * 60 }),
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(7 * 24 * 60 * 60));
  });

  it("deletes best-effort and swallows provider errors", async () => {
    const { storage, send } = makeStorage();
    send.mockRejectedValueOnce(new Error("boom"));
    await expect(storage.delete(KEY)).resolves.toBeUndefined();
    const cmd = send.mock.calls[0]![0] as DeleteObjectCommand;
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    expect(cmd.input).toEqual({ Bucket: "orbit-files", Key: KEY });
  });

  describe("browser-facing route", () => {
    it("answers the policy on GET", async () => {
      const { storage } = makeStorage();
      const res = await storage.routeHandler()(new Request("http://x/v1/uploads"));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ provider: "s3", policy });
    });

    it("rejects anything but GET and POST", async () => {
      const { storage } = makeStorage();
      const res = await storage.routeHandler()(
        new Request("http://x/v1/uploads", { method: "PUT" }),
      );
      expect(res.status).toBe(405);
    });

    it("requires a session before reading the body", async () => {
      const { storage, send } = makeStorage({}, { userId: null });
      const res = await storage.routeHandler()(
        multipart([{ name: "a.png", type: "image/png", bytes: new Uint8Array(3) }]),
      );
      expect(res.status).toBe(401);
      expect(send).not.toHaveBeenCalled();
    });

    it("stores each file and returns key, metadata and a signed read URL", async () => {
      const { storage, send } = makeStorage();
      const res = await storage.routeHandler()(
        multipart([{ name: "a.png", type: "image/png", bytes: new Uint8Array([1, 2, 3]) }]),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { files: Record<string, unknown>[] };
      expect(body.files).toHaveLength(1);
      const [file] = body.files;
      expect(file).toMatchObject({
        uploadedBy: "user_1",
        name: "a.png",
        size: 3,
        type: "image/png",
      });
      expect(file!.key).toMatch(/^[a-z0-9]{4}\/[a-z0-9]{32}\.png$/);
      const url = new URL(file!.url as string);
      expect(url.pathname).toBe(`/${file!.key}`);
      expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
      expect(send.mock.calls[0]![0]).toBeInstanceOf(PutObjectCommand);
    });

    it("refuses a body with no file part", async () => {
      const { storage, send } = makeStorage();
      const form = new FormData();
      form.append("note", "hello");
      const res = await storage.routeHandler()(
        new Request("http://x/v1/uploads", { method: "POST", body: form }),
      );
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: { code: "uploads.no_file" } });
      expect(send).not.toHaveBeenCalled();
    });

    it("enforces the per-upload file count", async () => {
      const { storage, send } = makeStorage();
      const res = await storage.routeHandler()(
        multipart([
          { name: "a.png", type: "image/png", bytes: new Uint8Array(1) },
          { name: "b.png", type: "image/png", bytes: new Uint8Array(1) },
        ]),
      );
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        error: { code: "uploads.too_many_files" },
      });
      expect(send).not.toHaveBeenCalled();
    });

    it("enforces the content-type allowlist", async () => {
      const { storage, send } = makeStorage();
      const res = await storage.routeHandler()(
        multipart([{ name: "a.svg", type: "image/svg+xml", bytes: new Uint8Array(1) }]),
      );
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        error: { code: "uploads.unsupported_type" },
      });
      expect(send).not.toHaveBeenCalled();
    });

    it("enforces the size cap", async () => {
      const { storage, send } = makeStorage({}, { policy: { ...policy, maxFileSizeBytes: 2 } });
      const res = await storage.routeHandler()(
        multipart([{ name: "a.png", type: "image/png", bytes: new Uint8Array(3) }]),
      );
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        error: { code: "uploads.file_too_large" },
      });
      expect(send).not.toHaveBeenCalled();
    });

    it("surfaces bucket failures as a 409 with the provider error code", async () => {
      const { storage, send } = makeStorage();
      send.mockRejectedValueOnce(new Error("AccessDenied"));
      const res = await storage.routeHandler()(
        multipart([{ name: "a.png", type: "image/png", bytes: new Uint8Array(1) }]),
      );
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({
        error: { code: "uploads.provider_error" },
      });
    });
  });
});
