"use client";

import { useEffect, useState } from "react";
import { Search, Trash2, Loader2, Film, AlertTriangle, Subtitles as SubtitlesIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Video = {
  id: number;
  tmdb_id: number | null;
  title: string;
  year: string | null;
  file: string;
  qualities: string;
  poster_path: string | null;
};

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = async (p: number, s: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/videos?page=${p}&search=${encodeURIComponent(s)}`);
      const data = await res.json();
      if (data.success) {
        setVideos(data.data?.videos || []);
        setTotal(data.data?.total || 0);
      } else {
        setError(data.error || "Failed to load videos");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos(page, search);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchVideos(1, search);
  };

  // Subtitle attach state
  const [subModal, setSubModal] = useState<{ videoId: number; title: string } | null>(null);
  const [subLang, setSubLang] = useState("mm");
  const [subFile, setSubFile] = useState<File | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg] = useState("");

  const openSubtitleModal = (videoId: number, title: string) => {
    setSubModal({ videoId, title });
    setSubLang("mm");
    setSubFile(null);
    setSubMsg("");
  };

  const srtToVtt = (srt: string): string => {
    return "WEBVTT\n\n" + srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  };

  const handleSubtitleUpload = async () => {
    if (!subModal || !subFile) return;
    setSubBusy(true);
    setSubMsg("");
    try {
      // 1. Get an unguessable storage key
      const kRes = await fetch("/api/admin/subtitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "key", fileName: subFile.name }),
      });
      const kData = await kRes.json();
      if (!kData.success) throw new Error(kData.error);
      const key: string = kData.data.key;

      // 2. Convert SRT→VTT if needed, upload text THROUGH our server (ISP-proof)
      const raw = await subFile.text();
      const vtt = subFile.name.toLowerCase().endsWith(".srt") ? srtToVtt(raw) : raw;
      const put = await fetch(`/api/admin/subtitle?action=put&key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "text/vtt" },
        body: vtt,
      });
      if (!put.ok) throw new Error("Failed to store subtitle");

      // 3. Attach to video
      const aRes = await fetch("/api/admin/subtitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach",
          videoId: subModal.videoId,
          lang: subLang,
          label: subLang === "mm" ? "မြန်မာ" : subLang.toUpperCase(),
          key,
        }),
      });
      const aData = await aRes.json();
      if (!aData.success) throw new Error(aData.error);

      setSubMsg("Subtitle attached ✓");
      setTimeout(() => setSubModal(null), 1200);
    } catch (err) {
      setSubMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this video entry?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/videos?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setVideos((prev) => prev.filter((v) => v.id !== id));
        setTotal((prev) => prev - 1);
      }
    } finally {
      setDeleting(null);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Videos</h1>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos..."
              className="pl-9 pr-4 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50 w-64"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-netflix text-white rounded-lg text-sm font-medium hover:bg-netflix-hover transition-colors">
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchVideos(page, search)} variant="outline" size="sm">Try Again</Button>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20">
          <Film className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No videos found</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-x-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Title</th>
                    <th className="text-left px-4 py-3 font-medium">Year</th>
                    <th className="text-left px-4 py-3 font-medium">TMDB ID</th>
                    <th className="text-left px-4 py-3 font-medium">File</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {videos.map((video) => {
                    let qualities: string[] = [];
                    try {
                      qualities = JSON.parse(video.qualities || "[]").map((q: { quality: string }) => q.quality);
                    } catch {}

                    return (
                      <tr key={video.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {video.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${video.poster_path}`}
                                alt=""
                                className="w-8 h-12 rounded object-cover"
                              />
                            ) : (
                              <div className="w-8 h-12 rounded bg-muted flex items-center justify-center">
                                <Film className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-medium truncate max-w-[200px]">{video.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{video.year || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{video.tmdb_id || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {qualities.map((q) => (
                              <span key={q} className="px-1.5 py-0.5 rounded bg-netflix/10 text-netflix text-xs font-medium">
                                {q}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openSubtitleModal(video.id, video.title)}
                              title="Attach subtitles"
                              className="p-1.5 text-muted-foreground hover:text-netflix transition-colors"
                            >
                              <SubtitlesIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(video.id)}
                              disabled={deleting === video.id}
                              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                            >
                              {deleting === video.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Subtitle modal */}
      {subModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !subBusy && setSubModal(null)}>
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Attach Subtitle</h2>
              <button onClick={() => setSubModal(null)} disabled={subBusy} className="p-1 hover:bg-muted rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4 truncate">{subModal.title}</p>

            <label className="text-sm font-medium block mb-1.5">Language</label>
            <select value={subLang} onChange={(e) => setSubLang(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border bg-background text-sm mb-4">
              <option value="mm">Myanmar (မြန်မာ)</option>
              <option value="en">English</option>
            </select>

            <label className="text-sm font-medium block mb-1.5">Subtitle file (.srt or .vtt)</label>
            <input
              type="file"
              accept=".srt,.vtt"
              onChange={(e) => setSubFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-netflix/10 file:text-netflix file:text-sm file:font-medium"
            />

            {subMsg && <p className={`text-sm mt-3 ${subMsg.includes("✓") ? "text-green-500" : "text-red-500"}`}>{subMsg}</p>}

            <button
              onClick={handleSubtitleUpload}
              disabled={!subFile || subBusy}
              className="w-full mt-5 py-2.5 bg-netflix text-white rounded-lg text-sm font-semibold hover:bg-netflix-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {subBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Upload & Attach
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
