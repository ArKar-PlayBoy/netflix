"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { MovieType } from "@/types/global";

type ProgressItem = {
  tmdb_id: number;
  position_seconds: number;
  duration_seconds: number;
};

const IMG = "https://image.tmdb.org/t/p";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m left`;
}

export default function ContinueWatchingRow() {
  const [items, setItems] = useState<(ProgressItem & { movie: MovieType | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/progress")
      .then((r) => r.json())
      .then(async (d) => {
        if (cancelled || !d.success) return;
        const list: ProgressItem[] = d.data?.items ?? [];
        if (list.length === 0) {
          setLoading(false);
          return;
        }
        const ids = list.map((i) => i.tmdb_id).join(",");
        const mRes = await fetch(`/api/movies?ids=${ids}`).then((r) => r.json());
        const movies: (MovieType | null)[] = mRes.success ? mRes.data : [];
        if (cancelled) return;
        const merged = list.map((item, i) => ({ ...item, movie: movies[i] ?? null }));
        setItems(merged.filter((i) => i.movie));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="flex items-center gap-2.5 text-lg md:text-xl font-bold mb-3 px-4 md:px-8">
        <span className="h-5 w-1 rounded-full bg-netflix" />
        Continue Watching
      </h2>
      <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2 snap-x">
        {items.map((item) => {
          const pct =
            item.duration_seconds > 0
              ? Math.min(100, Math.round((item.position_seconds / item.duration_seconds) * 100))
              : 0;
          return (
            <Link
              key={item.tmdb_id}
              href={`/view/${item.tmdb_id}`}
              className="group flex-none w-[150px] sm:w-[170px] md:w-[190px] snap-start"
            >
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted ring-1 ring-white/5 group-hover:ring-netflix/50 transition-all">
                {item.movie?.backdrop_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${IMG}/w500${item.movie.backdrop_path}`}
                    alt={item.movie.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : item.movie?.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${IMG}/w342${item.movie.poster_path}`}
                    alt={item.movie.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">No Image</div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PlayCircle className="h-10 w-10 text-white drop-shadow-lg" />
                </div>
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/25">
                  <div className="h-full bg-netflix" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <h3 className="font-semibold mt-2 line-clamp-1 text-sm group-hover:text-netflix transition-colors">
                {item.movie?.title}
              </h3>
              <p className="text-muted-foreground text-xs">{formatTime(item.duration_seconds - item.position_seconds)}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
