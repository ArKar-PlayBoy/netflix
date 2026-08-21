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
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadLocal = () => {
      setIsFavorite(safeGetFavorites().includes(movieId));
      setMounted(true);
    };

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (meRes) => {
        if (cancelled) return;
        const user = meRes.success ? meRes.data?.user : null;
        if (!user) {
          loadLocal();
          return;
        }
        setSignedIn(true);
        const favRes = await fetch("/api/favorites").then((r) => r.json());
        if (cancelled) return;
        const favorites: number[] = favRes.success ? favRes.data?.favorites ?? [] : [];
        setIsFavorite(favorites.includes(movieId));
        setMounted(true);
      })
      .catch(loadLocal);

    return () => {
      cancelled = true;
    };
  }, [movieId]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);

    if (signedIn) {
      try {
        if (isFavorite) {
          await fetch(`/api/favorites?movieId=${movieId}`, { method: "DELETE" });
          setIsFavorite(false);
        } else {
          const res = await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movieId }),
          });
          if (res.ok) setIsFavorite(true);
        }
      } catch {
      } finally {
        setBusy(false);
      }
      return;
    }

    const ids = safeGetFavorites();
    if (isFavorite) {
      safeSetFavorites(ids.filter((id) => id !== movieId));
    } else {
      ids.push(movieId);
      safeSetFavorites(ids);
    }
    setIsFavorite(!isFavorite);
    setBusy(false);
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
      disabled={busy}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 disabled:opacity-60 ${
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
