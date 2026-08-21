"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileVideo, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type UploadItem = {
  file: File;
  status: "waiting" | "uploading" | "done" | "error" | "verifying";
  progress: number;
  message?: string;
};

const ALLOWED = [".mp4", ".mkv", ".webm", ".avi", ".mov"];
const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB parts
const MAX_RETRIES = 3;
const CONCURRENCY = 3;

export default function UploadsPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (file: File, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.file === file ? { ...it, ...patch } : it)));
  };

  // PUT one chunk straight to R2 with retries; returns the ETag
  const putPart = async (
    url: string,
    chunk: Blob,
    contentType: string,
    onBytes: (sent: number) => void
  ): Promise<string> => {
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", contentType);
          let lastLoaded = 0;
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onBytes(e.loaded - lastLoaded);
            lastLoaded = e.loaded;
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const etag = xhr.getResponseHeader("ETag");
              if (!etag) reject(new Error("Missing ETag in response"));
              else resolve(etag);
            } else {
              reject(new Error(`Part failed (${xhr.status})`));
            }
          };
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(chunk);
        });
      } catch (err) {
        lastErr = err as Error;
        if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
    throw lastErr ?? new Error("Part upload failed");
  };

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      const { file } = item;
      update(file, { status: "uploading", progress: 0 });
      const contentType = file.type || "video/mp4";
      const key = file.name;
      let uploadId: string | null = null;

      try {
        // 1. Create multipart session (BEGIN)
        const cRes = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", fileName: file.name, contentType }),
        });
        const cData = await cRes.json();
        if (!cData.success) throw new Error(cData.error || "Failed to start upload");
        uploadId = cData.data.uploadId as string;

        // 2. Upload parts (limited concurrency)
        const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        const parts: { ETag: string; PartNumber: number }[] = [];
        let uploadedBytes = 0;

        const uploadPart = async (partNumber: number): Promise<void> => {
          const start = (partNumber - 1) * CHUNK_SIZE;
          const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));

          const pRes = await fetch("/api/admin/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "part-url", key, uploadId, partNumber }),
          });
          const pData = await pRes.json();
          if (!pData.success) throw new Error(pData.error || "Failed to sign part");

          const etag = await putPart(pData.data.url, chunk, contentType, (bytes) => {
            uploadedBytes += bytes;
            update(file, { progress: Math.min(99, Math.round((uploadedBytes / file.size) * 100)) });
          });
          parts.push({ ETag: etag, PartNumber: partNumber });
        };

        let nextPart = 1;
        const workers = Array.from({ length: Math.min(CONCURRENCY, totalParts) }, async () => {
          while (nextPart <= totalParts) {
            const n = nextPart++;
            await uploadPart(n);
          }
        });
        await Promise.all(workers);

        // 3. Complete assembly
        update(file, { status: "verifying" });
        const fRes = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", key, uploadId, parts }),
        });
        const fData = await fRes.json();
        if (!fData.success) throw new Error(fData.error || "Failed to assemble file");

        update(file, {
          status: "done",
          progress: 100,
          message: `${(fData.data.size / 1024 / 1024).toFixed(1)} MB stored`,
        });
      } catch (err) {
        // ROLLBACK: abort the real session so R2 discards all uploaded parts
        if (uploadId) {
          try {
            await fetch("/api/admin/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "abort", key, uploadId }),
            });
          } catch {}
        }
        update(file, { status: "error", message: err instanceof Error ? err.message : "Upload failed" });
      }
    },
    []
  );

  const addFiles = useCallback(
    (files: FileList) => {
      const valid: UploadItem[] = [];
      for (const f of Array.from(files)) {
        const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
        if (ALLOWED.includes(ext)) valid.push({ file: f, status: "waiting", progress: 0 });
      }
      setItems((prev) => [...prev, ...valid]);
      valid.forEach((item) => uploadOne(item));
    },
    [uploadOne]
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Upload Videos</h1>
      <p className="text-muted-foreground mb-6">
        Large files are sent in 8MB chunks with automatic retry. After uploading, run the{" "}
        <a href="/admin/scan" className="text-netflix hover:underline">Scanner</a> to match them to TMDB.
      </p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors mb-8 ${
          dragging ? "border-netflix bg-netflix/5" : "border-border hover:border-netflix/50"
        }`}
      >
        <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">Drag & drop video files here</p>
        <p className="text-sm text-muted-foreground mt-1">or click to browse — mp4, mkv, webm, avi, mov</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".mp4,.mkv,.webm,.avi,.mov,video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Queue */}
      {items.length > 0 && (
        <div className="space-y-3 max-w-2xl">
          {items.map((item) => (
            <div key={item.file.name + item.file.lastModified} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                {item.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                ) : item.status === "error" ? (
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-netflix flex-shrink-0" />
                )}
                <FileVideo className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate text-sm font-medium">{item.file.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {(item.file.size / 1024 / 1024).toFixed(0)} MB
                </span>
              </div>

              {(item.status === "uploading" || item.status === "done") && (
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${item.status === "done" ? "bg-green-500" : "bg-netflix"}`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {item.status === "waiting" && "Queued..."}
                {item.status === "uploading" && `Uploading ${item.progress}%`}
                {item.status === "verifying" && "Assembling parts..."}
                {item.status === "done" && `Stored ✓ ${item.message ?? ""}`}
                {item.status === "error" && <span className="text-red-500">{item.message} — you can re-drop the file to retry</span>}
              </p>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setItems([])}>
            Clear list
          </Button>
        </div>
      )}
    </div>
  );
}
