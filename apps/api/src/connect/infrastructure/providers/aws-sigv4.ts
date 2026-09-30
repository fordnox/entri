/**
 * Minimal AWS Signature Version 4 signer (header-based), enough for
 * Route 53. https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html
 */
import { createHash, createHmac } from "node:crypto";

export interface SigV4Input {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  service: string;
  /** Defaults to now. */
  date?: Date;
  /** Add `x-amz-content-sha256` (S3 needs it; Route 53 doesn't). */
  signContentSha256?: boolean;
}

export interface SignedRequest {
  headers: Record<string, string>;
  /** Exposed for tests. */
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
}

export function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** RFC 3986 encoding as AWS expects (`~` unreserved, everything else escaped). */
export function awsEncode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function amzDate(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

export function signV4(input: SigV4Input): SignedRequest {
  const url = new URL(input.url);
  const date = input.date ?? new Date();
  const stamp = amzDate(date);
  const day = stamp.slice(0, 8);
  const body = input.body ?? "";
  const payloadHash = sha256Hex(body);

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers ?? {})) headers[k.toLowerCase()] = v;
  headers.host = url.host;
  headers["x-amz-date"] = stamp;
  if (input.sessionToken) headers["x-amz-security-token"] = input.sessionToken;
  if (input.signContentSha256) headers["x-amz-content-sha256"] = payloadHash;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((k) => `${k}:${headers[k]!.trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalUri =
    url.pathname
      .split("/")
      .map((seg) => awsEncode(awsEncode(decodeURIComponent(seg))))
      .join("/") || "/";

  const query = [...url.searchParams.entries()]
    .map(([k, v]) => [awsEncode(k), awsEncode(v)] as const)
    .sort(([ak, av], [bk, bv]) => (ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    stamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${input.secretAccessKey}`, day);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const out: Record<string, string> = { ...headers };
  delete out.host; // fetch sets Host itself
  out.authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { headers: out, canonicalRequest, stringToSign, signature };
}
