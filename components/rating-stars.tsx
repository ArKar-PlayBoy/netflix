"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

export default function RatingStars({ movieId }: { movieId: number }) {
  const [myScore, setMyScore] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/ratings?movieId=${movieId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.score) setMyScore(d.data.score);
      })
      .catch(() => {});
  }, [movieId]);

  const rate = async (stars: number) => {
    const score = stars * 2;
    setMyScore(score);
    setSaving(true);
    try {
      await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId, score }),
      });
    } catch {}
    setSaving(false);
  };

  const display = hover ?? (myScore ? myScore / 2 : 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => rate(star)}
            onMouseEnter={() => setHover(star)}
            disabled={saving}
            className="p-0.5 transition-transform hover:scale-125 disabled:opacity-50"
            aria-label={`Rate ${star * 2} out of 10`}
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                star <= display ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {myScore ? `You rated ${myScore}/10` : "Rate this"}
      </span>
    </div>
  );
}
