"use client";

import { useState } from "react";
import { Search, Loader2, Link2 } from "lucide-react";

type TmdbMovie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
};

export default function LinkPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbMovie[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const token = process.env.NEXT_PUBLIC_TMDB_TOKEN || "";
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setResults(data.results?.slice(0, 10) ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async (movie: TmdbMovie) => {
    setLinking(movie.id);
    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: movie.id, title: movie.title }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Linked: ${movie.title}`);
      }
    } catch {
      alert("Link failed");
    } finally {
      setLinking(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Manual Link</h1>
      <p className="text-muted-foreground mb-6">
        Search TMDB and manually link video files to movies.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search TMDB for a movie..."
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
        <div className="space-y-3">
          {results.map((movie) => (
            <div
              key={movie.id}
              className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-netflix/50 transition-colors"
            >
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                  alt=""
                  className="w-12 h-18 rounded object-cover"
                />
              ) : (
                <div className="w-12 h-18 rounded bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{movie.title}</p>
                <p className="text-sm text-muted-foreground">
                  {movie.release_date?.split("-")[0]} | TMDB #{movie.id}
                </p>
              </div>
              <button
                onClick={() => handleLink(movie)}
                disabled={linking === movie.id}
                className="px-4 py-2 bg-netflix/10 text-netflix rounded-lg text-sm font-medium hover:bg-netflix/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {linking === movie.id ? (
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
    </div>
  );
}
