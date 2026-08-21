"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MovieType } from "@/types/global";
import { Heart, Loader2 } from "lucide-react";

const IMG = "https://image.tmdb.org/t/p";

export default function FavoritesPage() {
  const [movies, setMovies] = useState<MovieType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadIds = async (): Promise<number[]> => {
      try {
        const meRes = await fetch("/api/auth/me").then((r) => r.json());
        const user = meRes.success ? meRes.data?.user : null;
        if (user) {
          const favRes = await fetch("/api/favorites").then((r) => r.json());
          const accountIds: number[] = favRes.success ? favRes.data?.favorites ?? [] : [];

          // Merge guest favorites (localStorage) into the account once
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
    };

    loadIds().then((ids) => {
      if (cancelled) return;
      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      fetch(`/api/movies?ids=${ids.join(",")}`)
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          const list = json.success ? json.data : json;
          setMovies((list || []).filter(Boolean));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="text-center py-20">
        <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">My Favorites</h1>
        <p className="text-muted-foreground mb-2">No favorites yet.</p>
        <Link href="/" className="text-primary hover:underline">
          Browse movies
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Favorites ({movies.length})</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {movies.map((movie) => (
          <div key={movie.id} className="text-center">
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
            <h3 className="font-bold mt-2 line-clamp-1">{movie.title}</h3>
            <div className="text-muted-foreground text-sm">
              {movie.release_date?.split("-")[0]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
