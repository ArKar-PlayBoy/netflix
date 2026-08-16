"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Play, X, Loader2, AlertCircle, Check, Wifi } from "lucide-react";
import { getRecommendedQuality } from "@/lib/network";

type QualityOption = {
  quality: string;
  file: string;
};

export default function MoviePlayer({
  movieId,
  title,
  hasLocalVideo = false,
  trailerKey,
  qualities = [],
}: {
  movieId: number;
  title: string;
  hasLocalVideo?: boolean;
  trailerKey?: string | null;
  qualities?: QualityOption[];
}) {
  const [showModal, setShowModal] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoQuality, setAutoQuality] = useState<string>("auto");
  const [currentQuality, setCurrentQuality] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`quality-${movieId}`);
      if (saved && saved !== "auto") return saved;
    }
    return "auto";
  });
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { quality } = getRecommendedQuality();
    setAutoQuality(quality);
  }, []);

  const getEffectiveQuality = useCallback(() => {
    if (currentQuality === "auto") return autoQuality;
    return currentQuality;
  }, [currentQuality, autoQuality]);

  const getSelectedFile = useCallback(() => {
    const effectiveQuality = getEffectiveQuality();
    const match = qualities.find((q) => q.quality === effectiveQuality);
    return match?.file ?? qualities[0]?.file ?? "";
  }, [qualities, getEffectiveQuality]);

  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stream-token");
      if (!res.ok) throw new Error("Failed to get token");
      const data = await res.json();
      setToken(data.token);
      setTokenError(false);
    } catch {
      setTokenError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const openModal = useCallback(async () => {
    setShowModal(true);
    document.body.style.overflow = "hidden";
    if (hasLocalVideo && !token) {
      await fetchToken();
    }
  }, [hasLocalVideo, token, fetchToken]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    document.body.style.overflow = "";
    setShowQualityMenu(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showModal) closeModal();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showModal, closeModal]);

  useEffect(() => {
    if (!showQualityMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showQualityMenu]);

  const switchQuality = useCallback(
    (quality: string) => {
      setCurrentQuality(quality);
      setShowQualityMenu(false);
      localStorage.setItem(`quality-${movieId}`, quality);

      if (videoRef.current && token) {
        const currentTime = videoRef.current.currentTime;
        const wasPlaying = !videoRef.current.paused;
        const effectiveQuality = quality === "auto" ? autoQuality : quality;
        const selectedFile = qualities.find((q) => q.quality === effectiveQuality)?.file;

        if (selectedFile) {
          videoRef.current.src = `/api/stream/${movieId}?token=${token}&file=${encodeURIComponent(selectedFile)}`;
          videoRef.current.currentTime = currentTime;
          if (wasPlaying) videoRef.current.play();
        }
      }
    },
    [movieId, token, qualities, autoQuality]
  );

  const streamUrl = token
    ? `/api/stream/${movieId}?token=${token}&file=${encodeURIComponent(getSelectedFile())}`
    : null;
  const youtubeUrl = trailerKey ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0` : null;
  const hasMultipleQualities = qualities.length > 1;
  const effectiveQuality = currentQuality === "auto" ? autoQuality : currentQuality;

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-2 px-6 py-3 bg-netflix hover:bg-netflix-hover text-white rounded-lg font-semibold transition-colors text-lg"
      >
        <Play className="h-5 w-5 fill-current" />
        {hasLocalVideo ? "Watch Movie" : "Watch Trailer"}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <span className="text-white text-sm font-medium">{title}</span>
              <button
                onClick={closeModal}
                className="p-1.5 bg-white/20 rounded-full text-white hover:bg-white/30 transition pointer-events-auto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quality selector - top left badge */}
            {hasLocalVideo && hasMultipleQualities && (
              <div className="absolute top-12 left-4 z-30" ref={qualityMenuRef}>
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-bold rounded backdrop-blur-sm transition border border-white/10 flex items-center gap-1.5"
                >
                  {currentQuality === "auto" && <Wifi className="h-3 w-3" />}
                  {effectiveQuality.toUpperCase()}
                  <span className="text-[10px] opacity-70">▼</span>
                </button>

                {showQualityMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-black/90 rounded-lg border border-white/10 overflow-hidden min-w-[140px] backdrop-blur-sm">
                    <button
                      onClick={() => switchQuality("auto")}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-white/10 transition"
                    >
                      <span className="flex items-center gap-2">
                        <Wifi className="h-3 w-3" />
                        Auto ({autoQuality.toUpperCase()})
                      </span>
                      {currentQuality === "auto" && (
                        <Check className="h-3 w-3 text-green-400" />
                      )}
                    </button>
                    {qualities.map((q) => (
                      <button
                        key={q.quality}
                        onClick={() => switchQuality(q.quality)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-white/10 transition"
                      >
                        <span>{q.quality}</span>
                        {currentQuality === q.quality && (
                          <Check className="h-3 w-3 text-green-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Single quality badge (no dropdown) */}
            {hasLocalVideo && !hasMultipleQualities && (
              <div className="absolute top-12 left-4 z-20">
                <span className="px-3 py-1.5 bg-black/60 text-white text-xs font-bold rounded backdrop-blur-sm border border-white/10">
                  {effectiveQuality.toUpperCase()}
                </span>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="text-white/70 text-sm">Preparing player...</p>
              </div>
            )}

            {/* Token error */}
            {tokenError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-4 px-6">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="text-white font-medium">Unable to load video</p>
                <p className="text-white/60 text-sm text-center">
                  The video server is unavailable. Please try again later.
                </p>
                <button
                  onClick={fetchToken}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* HTML5 Video for local files */}
            {hasLocalVideo && streamUrl && !tokenError && (
              <video
                ref={videoRef}
                key={streamUrl}
                src={streamUrl}
                controls
                autoPlay
                className="w-full h-full"
                onWaiting={() => setLoading(true)}
                onCanPlay={() => setLoading(false)}
              >
                Your browser does not support video playback.
              </video>
            )}

            {/* YouTube fallback when no local video */}
            {!hasLocalVideo && youtubeUrl && (
              <iframe
                src={youtubeUrl}
                title={`${title} - Trailer`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}

            {/* No video available */}
            {!hasLocalVideo && !youtubeUrl && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-4 px-6">
                <AlertCircle className="h-12 w-12 text-muted-foreground" />
                <p className="text-white/70 text-sm text-center">
                  No video available for this movie.
                </p>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(title + " full movie")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition"
                >
                  Search on YouTube
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
