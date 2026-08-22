"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

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

  // Active genre from URL: /genre/<name>/<id>
  const activeId = pathname.startsWith("/genre/") ? pathname.split("/")[3] : null;
  const allActive = pathname === "/" || pathname.startsWith("/popular");

  return (
    <div className="relative md:hidden mb-5 -mx-4">
      {/* Edge fade for scroll affordance */}
      <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-1 snap-x">
        {/* All */}
        <Link
          href="/"
          className={`flex-none px-4 py-1.5 rounded-full text-[13px] font-semibold snap-start transition-all duration-200 border ${
            allActive
              ? "bg-netflix text-white border-netflix shadow-md shadow-netflix/25"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          All
        </Link>

        {genres.map((g) => {
          const active = activeId === g.id;
          return (
            <Link
              key={g.id}
              href={`/genre/${g.name}/${g.id}`}
              className={`flex-none px-4 py-1.5 rounded-full text-[13px] font-medium snap-start transition-all duration-200 border ${
                active
                  ? "bg-netflix text-white border-netflix shadow-md shadow-netflix/25"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {g.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
