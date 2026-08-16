"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Genre = { id: string; name: string };

const FALLBACK_GENRES: Genre[] = [
  { id: "28", name: "Action" }, { id: "12", name: "Adventure" },
  { id: "16", name: "Animation" }, { id: "35", name: "Comedy" },
  { id: "80", name: "Crime" }, { id: "99", name: "Documentary" },
  { id: "18", name: "Drama" }, { id: "10751", name: "Family" },
  { id: "14", name: "Fantasy" }, { id: "36", name: "History" },
  { id: "27", name: "Horror" }, { id: "10402", name: "Music" },
  { id: "9648", name: "Mystery" }, { id: "10749", name: "Romance" },
  { id: "878", name: "Science Fiction" }, { id: "10770", name: "TV Movie" },
  { id: "53", name: "Thriller" }, { id: "10752", name: "War" },
  { id: "37", name: "Western" },
];

export default function GenreSidebar() {
  const [genres, setGenres] = useState<Genre[]>(FALLBACK_GENRES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch("https://api.themoviedb.org/3/genre/movie/list", {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_TOKEN}` },
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.genres) setGenres(data.genres);
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="space-y-1">
      <Button variant="ghost" className="w-full justify-start" asChild>
        <Link href="/">
          <Film className="mr-2 h-4 w-4" />
          All Movies
        </Link>
      </Button>
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        genres.map((genre) => (
          <Button
            key={genre.id}
            variant="ghost"
            className="w-full justify-start"
            asChild
          >
            <Link href={`/genre/${genre.name}/${genre.id}`}>
              <Play className="mr-2 h-4 w-4" />
              {genre.name}
            </Link>
          </Button>
        ))
      )}
    </div>
  );
}
