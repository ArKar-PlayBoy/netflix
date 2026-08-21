import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export async function getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  const r2 = getR2();
  const cmd = new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType });
  return getSignedUrl(r2, cmd, { expiresIn: 3600 });
}

export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const res = await getR2().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType };
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
