import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_BUCKET;

export function isR2Configured(): boolean {
  return !!(ACCOUNT_ID && ACCESS_KEY && SECRET_KEY && BUCKET_NAME);
}

let _r2: S3Client | null = null;

function getR2(): S3Client {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  }
  if (!_r2) {
    _r2 = new S3Client({
      region: "auto",
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY!,
        secretAccessKey: SECRET_KEY!,
      },
    });
  }
  return _r2;
}

export function getBucket(): string {
  if (!BUCKET_NAME) throw new Error("R2_BUCKET is not set");
  return BUCKET_NAME;
}

export type R2Object = {
  key: string;
  size: number;
  lastModified: Date;
};

export async function listVideoFiles(): Promise<R2Object[]> {
  const r2 = getR2();
  const bucket = getBucket();
  const out: R2Object[] = [];
  let token: string | undefined;

  do {
    const res = await r2.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000, ContinuationToken: token })
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key || obj.Size === undefined) continue;
      out.push({ key: obj.Key, size: obj.Size, lastModified: obj.LastModified ?? new Date() });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  return out;
}

export async function getPresignedUploadUrl(key: string, contentType: string, originalName?: string): Promise<string> {
  const r2 = getR2();
  const cmd = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
    ...(originalName ? { Metadata: { originalname: encodeURIComponent(originalName) } } : {}),
  });
  return getSignedUrl(r2, cmd, { expiresIn: 3600 });
}

// Short-lived direct-download URL — viewer pulls bytes from Cloudflare edge,
// bypassing our server entirely (scales infinitely, zero server bandwidth)
export async function getPresignedStreamUrl(key: string, expiresIn: number = 900): Promise<string> {
  const r2 = getR2();
  const cmd = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

/** Public CDN base (custom domain attached to the bucket, e.g. https://cdn.example.com).
 *  When set, streams redirect viewers to Cloudflare CDN instead of proxying.
 *  Some ISPs block the raw *.r2.cloudflarestorage.com endpoint — CDN domains work. */
export function getPublicBaseUrl(): string | null {
  const base = process.env.R2_PUBLIC_BASE;
  return base ? base.replace(/\/$/, "") : null;
}

export function getPublicObjectUrl(key: string): string {
  // Encode each path segment; parens/dots are URL-safe, spaces become %20
  return `${getPublicBaseUrl()}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Unguessable storage key: <random12>-<sanitized-original>.<ext>
 *  Required when the bucket is exposed via public CDN URL — the random
 *  prefix acts as a capability token so files can't be guessed. */
export function generateStorageKey(originalName: string): string {
  const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
  const base = originalName
    .slice(0, originalName.lastIndexOf("."))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const rand = crypto.randomBytes(6).toString("hex");
  return `${rand}-${base}${ext}`;
}

/** Rename an existing object to a new key (copy + delete) */
export async function renameObject(oldKey: string, newKey: string): Promise<void> {
  const r2 = getR2();
  await r2.send(
    new CopyObjectCommand({ Bucket: getBucket(), CopySource: `/${getBucket()}/${encodeURIComponent(oldKey)}`, Key: newKey })
  );
  await r2.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: oldKey }));
}

// Multipart upload — large files are sent in parts with per-part retry
export async function createMultipart(key: string, contentType: string, originalName?: string): Promise<string> {
  const res = await getR2().send(
    new CreateMultipartUploadCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType,
      ...(originalName ? { Metadata: { originalname: encodeURIComponent(originalName) } } : {}),
    })
  );
  return res.UploadId!;
}

export async function getPresignedPartUrl(key: string, uploadId: string, partNumber: number): Promise<string> {
  const cmd = new UploadPartCommand({
    Bucket: getBucket(),
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(getR2(), cmd, { expiresIn: 6 * 3600 });
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[]
): Promise<void> {
  await getR2().send(
    new CompleteMultipartUploadCommand({
      Bucket: getBucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts]
          .sort((a, b) => a.PartNumber - b.PartNumber)
          .map((p) => ({ ETag: p.ETag, PartNumber: p.PartNumber })),
      },
    })
  );
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  await getR2().send(
    new AbortMultipartUploadCommand({ Bucket: getBucket(), Key: key, UploadId: uploadId })
  );
}

export async function headObject(key: string): Promise<{ size: number; contentType?: string; originalName: string | null } | null> {
  try {
    const res = await getR2().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    const raw = res.Metadata?.originalname;
    return {
      size: res.ContentLength ?? 0,
      contentType: res.ContentType,
      originalName: raw ? decodeURIComponent(raw) : null,
    };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getR2().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

export async function getObjectStream(key: string, range?: string): Promise<{
  body: ReadableStream<Uint8Array> | null;
  status: number;
  contentLength?: number;
  contentRange?: string;
  contentType?: string;
} | null> {
  try {
    const res = await getR2().send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
        ...(range ? { Range: range } : {}),
      })
    );
    return {
      body: (res.Body as ReadableStream<Uint8Array>) ?? null,
      status: range ? 206 : 200,
      contentLength: res.ContentLength,
      contentRange: res.ContentRange,
      contentType: res.ContentType,
    };
  } catch {
    return null;
  }
}
