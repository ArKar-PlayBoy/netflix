import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  isR2Configured,
  getPresignedUploadUrl,
  headObject,
  createMultipart,
  getPresignedPartUrl,
  completeMultipart,
  abortMultipart,
  generateStorageKey,
} from "@/lib/r2";
import { logAudit } from "@/lib/audit";

const ALLOWED_EXTENSIONS = [".mp4", ".mkv", ".webm", ".avi", ".mov"];
// Common release-name characters: dots, dashes, underscores, spaces, parens, brackets, apostrophes, etc.
const SAFE_KEY_RE = /^[a-zA-Z0-9._\- ()[\]'+,&!]+$/;

function validateFileName(fileName: string): string | null {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (!fileName || !ALLOWED_EXTENSIONS.includes(ext)) {
    return `Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }
  if (!SAFE_KEY_RE.test(fileName) || fileName.includes("..")) {
    return "Invalid file name";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    if (!isR2Configured()) {
      return NextResponse.json(
        { success: false, error: "R2 storage is not configured. Set R2 env vars." },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const action = body.action ?? "presign";

    // Single-shot presigned PUT (small files)
    if (action === "presign") {
      const fileName = typeof body.fileName === "string" ? body.fileName : "";
      const contentType = typeof body.contentType === "string" ? body.contentType : "video/mp4";
      const invalid = validateFileName(fileName);
      if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 });

      const storageKey = generateStorageKey(fileName);
      const uploadUrl = await getPresignedUploadUrl(storageKey, contentType, fileName);
      return NextResponse.json({ success: true, data: { key: storageKey, uploadUrl } });
    }

    // Multipart: create session
    if (action === "create") {
      const fileName = typeof body.fileName === "string" ? body.fileName : "";
      const contentType = typeof body.contentType === "string" ? body.contentType : "video/mp4";
      const invalid = validateFileName(fileName);
      if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 });

      // Unguessable storage key (public-CDN safe) — original name kept in
      // object metadata so the scanner can still auto-match content
      const storageKey = generateStorageKey(fileName);
      const uploadId = await createMultipart(storageKey, contentType, fileName);
      return NextResponse.json({ success: true, data: { key: storageKey, uploadId } });
    }

    // Multipart: presign one part
    if (action === "part-url") {
      const { key, uploadId, partNumber } = body;
      if (
        typeof key !== "string" ||
        typeof uploadId !== "string" ||
        typeof partNumber !== "number" ||
        partNumber < 1 ||
        partNumber > 10000
      ) {
        return NextResponse.json({ success: false, error: "key, uploadId, partNumber required" }, { status: 400 });
      }
      const url = await getPresignedPartUrl(key, uploadId, partNumber);
      return NextResponse.json({ success: true, data: { url } });
    }

    // Multipart: complete
    if (action === "complete") {
      const { key, uploadId, parts } = body;
      if (
        typeof key !== "string" ||
        typeof uploadId !== "string" ||
        !Array.isArray(parts) ||
        parts.length === 0
      ) {
        return NextResponse.json({ success: false, error: "key, uploadId, parts required" }, { status: 400 });
      }
      const cleanParts = parts
        .filter((p) => p && typeof p.ETag === "string" && typeof p.PartNumber === "number")
        .map((p) => ({ ETag: p.ETag.replace(/"/g, ""), PartNumber: p.PartNumber }));

      await completeMultipart(key, uploadId, cleanParts);

      const head = await headObject(key);
      if (!head) {
        return NextResponse.json({ success: false, error: "Object not found after assembly" }, { status: 500 });
      }
      await logAudit("upload.complete", `${key} (${(head.size / 1024 / 1024).toFixed(1)} MB, ${cleanParts.length} parts)`);
      return NextResponse.json({ success: true, data: { key, size: head.size } });
    }

    // Multipart: abort on failure
    if (action === "abort") {
      const { key, uploadId } = body;
      if (typeof key !== "string" || typeof uploadId !== "string") {
        return NextResponse.json({ success: false, error: "key, uploadId required" }, { status: 400 });
      }
      await abortMultipart(key, uploadId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Upload] Error:", err);
    return NextResponse.json({ success: false, error: "Upload operation failed" }, { status: 500 });
  }
}
