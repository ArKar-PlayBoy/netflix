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

export default function UploadsPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (file: File, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.file === file ? { ...it, ...patch } : it)));
  };

  const uploadOne = useCallback(async (item: UploadItem) => {
    const { file } = item;
    update(file, { status: "uploading", progress: 0 });

    try {
      // 1. Get presigned URL
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "video/mp4" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to get upload URL");
      const { key, uploadUrl } = data.data as { key: string; uploadUrl: string };

      // 2. PUT directly to R2 with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            update(file, { progress: Math.round((e.loaded / e.total) * 100) });
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      // 3. Verify object landed
      update(file, { status: "verifying" });
      const vRes = await fetch("/api/admin/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const vData = await vRes.json();
      if (!vData.success) throw new Error(vData.error || "Verification failed");

      update(file, { status: "done", progress: 100, message: `${(vData.data.size / 1024 / 1024).toFixed(1)} MB stored` });
    } catch (err) {
      update(file, { status: "error", message: err instanceof Error ? err.message : "Upload failed" });
    }
  }, []);

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
        Files go straight to cloud storage. After uploading, run the{" "}
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
                {item.status === "verifying" && "Verifying in storage..."}
                {item.status === "done" && `Stored ✓ ${item.message ?? ""}`}
                {item.status === "error" && <span className="text-red-500">{item.message}</span>}
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
