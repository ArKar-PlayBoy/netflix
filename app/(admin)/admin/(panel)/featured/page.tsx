"use client";

import { useEffect, useState } from "react";
import { Star, Trash2, Loader2, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type FeaturedItem = {
  id: number;
  movie_id: number;
  position: number;
  type: string;
};

export default function FeaturedPage() {
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movieId, setMovieId] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchFeatured = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/featured");
      const data = await res.json();
      if (data.success) {
        setFeatured(data.data?.featured || []);
      } else {
        setError(data.error || "Failed to load featured");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatured();
  }, []);

  const handleAdd = async () => {
    if (!movieId.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId: parseInt(movieId), type: "hero" }),
      });
      const data = await res.json();
      if (data.success) {
        setMovieId("");
        fetchFeatured();
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remove from featured?")) return;
    try {
      const res = await fetch(`/api/admin/featured?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setFeatured((prev) => prev.filter((f) => f.id !== id));
      }
    } catch {}
  };

  const handleClear = async () => {
    if (!confirm("Clear all featured content?")) return;
    try {
      const res = await fetch("/api/admin/featured?action=clear", { method: "DELETE" });
      const data = await res.json();
      if (data.success) setFeatured([]);
    } catch {}
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Featured Content</h1>

      <div className="rounded-xl border p-5 bg-card mb-8">
        <h2 className="font-bold mb-4">Add Movie</h2>
        <div className="flex gap-2">
          <input
            type="number"
            value={movieId}
            onChange={(e) => setMovieId(e.target.value)}
            placeholder="TMDB Movie ID"
            className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !movieId.trim()}
            className="px-4 py-2 bg-netflix text-white rounded-lg text-sm font-medium hover:bg-netflix-hover transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Current Featured</h2>
        {featured.length > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-red-500 hover:text-red-600 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-10">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <p className="text-muted-foreground text-sm mb-3">{error}</p>
          <Button onClick={fetchFeatured} variant="outline" size="sm">Try Again</Button>
        </div>
      ) : featured.length === 0 ? (
        <div className="text-center py-10 rounded-xl border">
          <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No featured content yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {featured.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-xl border bg-card"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">#{item.position}</span>
                <span className="font-medium">Movie #{item.movie_id}</span>
                <span className="px-2 py-0.5 rounded bg-netflix/10 text-netflix text-xs font-medium">
                  {item.type}
                </span>
              </div>
              <button
                onClick={() => handleRemove(item.id)}
                className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
