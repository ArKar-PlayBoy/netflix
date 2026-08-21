"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, Link2, Film, CheckCircle, AlertTriangle, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";

type TmdbResult = {
  id: number;
  title: string;
  year: string | null;
  poster_path: string | null;
  vote_average: number;
  media_type: "movie" | "tv";
};

type UnlinkedVideo = {
  id: number;
  title: string;
  file: string;
  qualities: { quality: string; file: string }[];
};

export default function LinkPage() {
  const [videos, setVideos] = useState<UnlinkedVideo[]>([]);
  const [selected, setSelected] = useState<UnlinkedVideo | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tvSeason, setTvSeason] = useState("1");
  const [tvEpisode, setTvEpisode] = useState("1");

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/link");
      const data = await res.json();
      if (data.success) {
        setVideos(data.data?.videos || []);
      } else {
        setError(data.error || "Failed to load unlinked videos");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selected) return;
    setSearching(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/link?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.data?.results || []);
      } else {
        setMessage(data.error || "Search failed");
      }
    } catch {
      setMessage("Connection error");
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async (result: TmdbResult) => {
    if (!selected) return;
    const isTv = result.media_type === "tv";
    if (isTv && (!/^\d+$/.test(tvSeason) || !/^\d+$/.test(tvEpisode))) {
      setMessage("Enter valid season and episode numbers for TV shows");
      return;
    }
    setLinking(result.id);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: selected.id,
          tmdbId: result.id,
          ...(isTv ? { season: parseInt(tvSeason), episode: parseInt(tvEpisode) } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Linked "${selected.file}" to ${data.data?.title ?? result.title} (${data.data?.type})`);
        setSelected(null);
        setResults([]);
        setQuery("");
        fetchVideos();
      } else {
        setMessage(data.error || "Link failed");
      }
    } catch {
      setMessage("Connection error");
    } finally {
      setLinking(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Manual Link</h1>
      <p className="text-muted-foreground mb-6">
        Pick an unlinked video file, then search TMDB — movies and TV shows both supported.
      </p>

      {message && (
        <div className="mb-6 p-3 rounded-lg border bg-card text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          {message}
        </div>
      )}

      <h2 className="font-bold mb-3">1. Select a video file</h2>
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-10">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <p className="text-muted-foreground text-sm mb-3">{error}</p>
          <Button onClick={fetchVideos} variant="outline" size="sm">Try Again</Button>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-10 rounded-xl border mb-8">
          <Film className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">All videos are linked. Nothing to do.</p>
        </div>
      ) : (
        <div className="space-y-2 mb-8 max-w-2xl">
          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => {
                setSelected(video);
                setResults([]);
                setMessage(null);
              }}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                selected?.id === video.id
                  ? "border-netflix bg-netflix/5"
                  : "bg-card hover:border-netflix/50"
              }`}
            >
              <Film className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm">{video.file}</span>
              <span className="text-xs text-muted-foreground">{video.qualities.length} file(s)</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <h2 className="font-bold mb-3">
            2. Find TMDB match for <span className="text-netflix">&ldquo;{selected.title}&rdquo;</span>
          </h2>
          <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-2xl">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search TMDB for a movie or TV show..."
              className="flex-1 px-4 py-3 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-6 py-3 bg-netflix text-white rounded-lg font-semibold hover:bg-netflix-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </form>

          {results.length > 0 && (
            <div className="space-y-3 max-w-2xl">
              {results.map((result) => (
                <div
                  key={`${result.media_type}-${result.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-netflix/50 transition-colors"
                >
                  {result.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                      alt=""
                      className="w-12 h-18 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-18 rounded bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{result.title}</p>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          result.media_type === "tv" ? "bg-blue-500/15 text-blue-500" : "bg-netflix/10 text-netflix"
                        }`}
                      >
                        {result.media_type === "tv" ? "TV" : "Movie"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {result.year || "—"} | TMDB #{result.id}
                    </p>

                    {/* Season/episode inputs for TV */}
                    {result.media_type === "tv" && (
                      <div className="flex items-center gap-2 mt-2">
                        <Tv className="h-3.5 w-3.5 text-muted-foreground" />
                        <label className="text-xs text-muted-foreground">S</label>
                        <input
                          type="number"
                          min={1}
                          value={tvSeason}
                          onChange={(e) => setTvSeason(e.target.value)}
                          className="w-16 px-2 py-1 rounded border bg-background text-sm"
                        />
                        <label className="text-xs text-muted-foreground">E</label>
                        <input
                          type="number"
                          min={1}
                          value={tvEpisode}
                          onChange={(e) => setTvEpisode(e.target.value)}
                          className="w-16 px-2 py-1 rounded border bg-background text-sm"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleLink(result)}
                    disabled={linking === result.id}
                    className="px-4 py-2 bg-netflix/10 text-netflix rounded-lg text-sm font-medium hover:bg-netflix/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {linking === result.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    Link
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
