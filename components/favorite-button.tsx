"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

function safeGetFavorites(): number[] {
  try {
    const stored = localStorage.getItem("favorites");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function safeSetFavorites(ids: number[]) {
  try {
    localStorage.setItem("favorites", JSON.stringify(ids));
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

export default function FavoriteButton({ movieId }: { movieId: number }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsFavorite(safeGetFavorites().includes(movieId));
    setMounted(true);
  }, [movieId]);

  const toggle = () => {
    const ids = safeGetFavorites();

    if (isFavorite) {
      safeSetFavorites(ids.filter((id) => id !== movieId));
    } else {
      ids.push(movieId);
      safeSetFavorites(ids);
    }

    setIsFavorite(!isFavorite);
  };

  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium bg-card text-muted-foreground border-border">
        <Heart className="h-4 w-4" />
        Add to Favorites
      </div>
    );
  }

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
        isFavorite
          ? "bg-netflix/10 text-netflix border-netflix/30 hover:bg-netflix/20"
          : "bg-card text-muted-foreground border-border hover:border-netflix/50 hover:text-foreground"
      }`}
    >
      <Heart className={`h-4 w-4 transition-all ${isFavorite ? "fill-netflix text-netflix" : ""}`} />
      {isFavorite ? "Favorited" : "Add to Favorites"}
    </button>
  );
}
