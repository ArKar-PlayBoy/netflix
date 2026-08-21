"use client";

import { useEffect, useState } from "react";
import { BookmarkPlus, BookmarkCheck } from "lucide-react";

export default function WatchlistButton({ movieId }: { movieId: number }) {
  const [inList, setInList] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    fetch(`/api/watchlist?movieId=${movieId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setInList(!!d.data?.inList);
      })
      .catch(() => {})
      .finally(() => setMounted(true));
  }, [movieId]);

  const toggle = async () => {
    // Optimistic
    setInList(!inList);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId }),
      });
      const d = await res.json();
      if (d.success) setInList(d.data.inList);
    } catch {}
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
        inList
          ? "bg-netflix/10 text-netflix border-netflix/30 hover:bg-netflix/20"
          : "bg-card text-muted-foreground border-border hover:border-netflix/50 hover:text-foreground"
      }`}
    >
      {inList ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
      {inList ? "In Watchlist" : "Watchlist"}
    </button>
  );
}
