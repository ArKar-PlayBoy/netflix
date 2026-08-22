"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, X, Film } from "lucide-react";

type Genre = { id: string; name: string };

const FALLBACK_GENRES: Genre[] = [
  { id: "28", name: "Action" }, { id: "12", name: "Adventure" },
  { id: "16", name: "Animation" }, { id: "35", name: "Comedy" },
  { id: "80", name: "Crime" }, { id: "99", name: "Documentary" },
  { id: "18", name: "Drama" }, { id: "10751", name: "Family" },
  { id: "14", name: "Fantasy" }, { id: "36", name: "History" },
  { id: "27", name: "Horror" }, { id: "10402", name: "Music" },
  { id: "9648", name: "Mystery" }, { id: "10749", name: "Romance" },
  { id: "878", name: "Science Fiction" }, { id: "53", name: "Thriller" },
  { id: "10752", name: "War" }, { id: "37", name: "Western" },
];

export default function MobileGenreFilter() {
  const [genres, setGenres] = useState<Genre[]>(FALLBACK_GENRES);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://api.themoviedb.org/3/genre/movie/list", {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_TOKEN}` },
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.genres) setGenres(data.genres);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Lock body scroll when sheet open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden w-full flex items-center justify-center gap-2 h-11 rounded-xl border bg-card text-sm font-medium mb-4 active:bg-muted transition-colors"
      >
        <LayoutGrid className="h-4 w-4 text-netflix" />
        Browse Categories
      </button>

      {/* Bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-200" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-background border-t max-h-[80dvh] flex flex-col"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="font-bold">Categories</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-full bg-muted hover:bg-border transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 pb-2">
              <button
                onClick={() => go("/")}
                className="w-full flex items-center gap-2.5 p-3 rounded-xl hover:bg-muted transition-colors text-sm font-medium"
              >
                <Film className="h-4 w-4 text-netflix" />
                All Movies
              </button>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {genres.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => go(`/genre/${g.name}/${g.id}`)}
                    className="px-3 py-3 rounded-xl bg-card border text-sm font-medium text-left hover:border-netflix/50 hover:text-netflix active:bg-muted transition-colors"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
