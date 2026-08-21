"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { MovieType } from "@/types/global";
import { Heart, Loader2, BookmarkPlus, X } from "lucide-react";

const IMG = "https://image.tmdb.org/t/p";

type Tab = "favorites" | "watchlist";

export default function FavoritesPage() {
  const [tab, setTab] = useState<Tab>("favorites");
  const [movies, setMovies] = useState<MovieType[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  const loadIds = useCallback(async (which: Tab): Promise<number[]> => {
    if (which === "watchlist") {
      const res = await fetch("/api/watchlist").then((r) => r.json());
      return res.success ? res.data?.watchlist ?? [] : [];
    }
    try {
      const meRes = await fetch("/api/auth/me").then((r) => r.json());
      const user = meRes.success ? meRes.data?.user : null;
      if (user) {
        const favRes = await fetch("/api/favorites").then((r) => r.json());
        const accountIds: number[] = favRes.success ? favRes.data?.favorites ?? [] : [];

        let localIds: number[] = [];
        try {
          localIds = JSON.parse(localStorage.getItem("favorites") || "[]");
        } catch {}

        const missing = localIds.filter((id) => !accountIds.includes(id));
        if (missing.length > 0) {
          await Promise.all(
            missing.map((id) =>
              fetch("/api/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ movieId: id }),
              }).catch(() => null)
            )
          );
          localStorage.removeItem("favorites");
          return [...accountIds, ...missing];
        }
        return accountIds;
      }
    } catch {}
    try {
      const stored = localStorage.getItem("favorites");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const loadTab = useCallback(
    async (which: Tab) => {
      setLoading(true);
      try {
        const ids = await loadIds(which);
        if (ids.length === 0) {
          setMovies([]);
          setLoading(false);
          return;
        }
        const res = await fetch(`/api/movies?ids=${ids.join(",")}`);
        const json = await res.json();
        const list = json.success ? json.data : json;
        // Keep original ordering of ids
        const byId = new Map<number, MovieType>((list || []).filter(Boolean).map((m: MovieType) => [m.id, m]));
        setMovies(ids.map((id) => byId.get(id)).filter(Boolean) as MovieType[]);
      } catch {
        setMovies([]);
      } finally {
        setLoading(false);
      }
    },
    [loadIds]
  );

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  const removeFromWatchlist = async (movieId: number) => {
    setRemoving(movieId);
    try {
      await fetch(`/api/watchlist?movieId=${movieId}`, { method: "DELETE" });
      setMovies((prev) => prev.filter((m) => m.id !== movieId));
    } catch {}
    setRemoving(null);
  };

  const emptyText =
    tab === "favorites"
      ? "No favorites yet. Tap the heart on any movie."
      : "Watchlist is empty. Use the bookmark button on any movie.";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">My List</h1>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted max-w-xs mb-6">
        {(["favorites", "watchlist"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? "bg-netflix text-white shadow-md shadow-netflix/25" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "favorites" ? <Heart className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
            {t === "favorites" ? "Favorites" : "Watchlist"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : movies.length === 0 ? (
        <div className="text-center py-20">
          {tab === "favorites" ? (
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          ) : (
            <BookmarkPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          )}
          <p className="text-muted-foreground mb-4">{emptyText}</p>
          <Link href="/" className="text-primary hover:underline">
            Browse movies
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {movies.map((movie) => (
            <div key={movie.id} className="text-center relative group">
              <Link href={`/view/${movie.id}`}>
                <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                  {movie.poster_path ? (
                    <Image
                      src={`${IMG}/w342${movie.poster_path}`}
                      alt={movie.title}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                      No Poster
                    </div>
                  )}
                </div>
              </Link>
              {/* Remove button (watchlist only) */}
              {tab === "watchlist" && (
                <button
                  onClick={() => removeFromWatchlist(movie.id)}
                  disabled={removing === movie.id}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  aria-label="Remove from watchlist"
                >
                  {removing === movie.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </button>
              )}
              <h3 className="font-bold mt-2 line-clamp-1">{movie.title}</h3>
              <div className="text-muted-foreground text-sm">{movie.release_date?.split("-")[0]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
