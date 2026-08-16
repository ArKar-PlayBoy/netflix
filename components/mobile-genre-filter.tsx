"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <select
      onChange={(e) => {
        if (e.target.value) router.push(e.target.value);
      }}
      className="w-full h-10 rounded-lg border bg-card px-3 text-sm md:hidden mb-4"
      defaultValue=""
    >
      <option value="" disabled>Browse Genres</option>
      {genres.map((g) => (
        <option key={g.id} value={`/genre/${g.name}/${g.id}`}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
