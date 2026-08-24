"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Play, X, Loader2 } from "lucide-react";
import { getValidToken } from "@/components/movie-player";

type Episode = {
  id: number;
  season: number;
  episode: number;
  name: string | null;
  file: string;
  qualities: { quality: string; file: string }[];
};

export default function SeasonsList({
  videoId,
  episodes,
}: {
  videoId: number;
  episodes: Episode[];
}) {
  const seasons = Array.from(new Set(episodes.map((e) => e.season))).sort((a, b) => a - b);
  const [activeSeason, setActiveSeason] = useState(seasons[0] ?? 1);
  const [token, setToken] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Episode | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const ensureToken = useCallback(async (): Promise<string | null> => {
    if (token) return token;
    setLoadingToken(true);
    const t = await getValidToken();
    if (t) setToken(t);
    setLoadingToken(false);
    return t;
  }, [token]);

  const playEpisode = async (ep: Episode) => {
    const t = await ensureToken();
    if (!t) return;
    setPlaying(ep);
    document.body.style.overflow = "hidden";
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && playing) {
        setPlaying(null);
        document.body.style.overflow = "";
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [playing]);

  const closePlayer = () => {
    videoRef.current?.pause();
    setPlaying(null);
    document.body.style.overflow = "";
  };

  const seasonEpisodes = episodes.filter((e) => e.season === activeSeason);

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold mb-4">Episodes</h2>

      {/* Season tabs */}
      {seasons.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
          {seasons.map((s) => {
            const count = episodes.filter((e) => e.season === s).length;
            return (
              <button
                key={s}
                onClick={() => setActiveSeason(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSeason === s
                    ? "bg-netflix text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Season {s}
                <span className={`ml-1.5 text-xs ${activeSeason === s ? "text-white/70" : "opacity-60"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Episode list */}
      <div className="space-y-2">
        {seasonEpisodes.map((ep) => (
          <button
            key={ep.id}
            onClick={() => playEpisode(ep)}
            className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              playing?.id === ep.id ? "border-netflix bg-netflix/5" : "bg-card hover:border-netflix/40"
            }`}
          >
            <span className="w-8 h-8 rounded-full bg-netflix/10 text-netflix flex items-center justify-center flex-shrink-0">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium">
                S{String(ep.season).padStart(2, "0")}E{String(ep.episode).padStart(2, "0")}
                {ep.name ? ` — ${ep.name}` : ""}
              </span>
              <span className="block text-xs text-muted-foreground truncate">{ep.file}</span>
            </span>
            {ep.qualities.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-netflix/10 text-netflix font-medium flex-shrink-0">
                {ep.qualities[0].quality}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Episode player modal */}
      {playing && (
        <div className="fixed inset-0 z-[200] bg-black lg:bg-black/95 lg:flex lg:items-center lg:justify-center lg:p-4" onClick={closePlayer}>
          <div
                  className="relative w-full aspect-video h-full lg:h-auto lg:max-w-5xl bg-black rounded-none lg:rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <span className="text-white text-sm font-medium">
                S{String(playing.season).padStart(2, "0")}E{String(playing.episode).padStart(2, "0")}
                {playing.name ? ` — ${playing.name}` : ""}
              </span>
              <button
                onClick={closePlayer}
                className="p-1.5 bg-white/20 rounded-full text-white hover:bg-white/30 transition pointer-events-auto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingToken ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            ) : (
              <video
                ref={videoRef}
                src={`/api/stream/${videoId}?token=${token}&ep=${playing.id}`}
                controls
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                autoPlay
                className="w-full h-full select-none"
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
