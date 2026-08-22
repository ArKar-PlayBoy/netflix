"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Play, X, AlertCircle, Check, Wifi, Subtitles, Pause,
  Volume2, VolumeX, Maximize, Minimize, RotateCcw, RotateCw, Gauge,
} from "lucide-react";
import { getRecommendedQuality } from "@/lib/network";

type QualityOption = { quality: string; file: string };
type SubtitleOption = { lang: string; label: string; file: string };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Module-level token cache — shared across all players, survives modal open/close.
// Tokens live 2h; we reuse until 10min-before-expiry, then refetch transparently.
let cachedToken: { value: string; expiresAt: number } | null = null;

function getCachedToken(): string | null {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 10 * 60 * 1000) {
    return cachedToken.value;
  }
  return null;
}

async function fetchFreshToken(): Promise<string> {
  const res = await fetch("/api/stream-token");
  if (!res.ok) throw new Error("token failed");
  const data = await res.json();
  const t = data.data?.token ?? data.token;
  cachedToken = { value: t, expiresAt: Date.now() + 7200_000 };
  return t;
}

export function prefetchStreamToken(): void {
  if (!getCachedToken()) {
    fetchFreshToken().catch(() => {});
  }
}

/** Shared getter used by all players — returns cached token instantly when valid */
export async function getValidToken(): Promise<string | null> {
  const cached = getCachedToken();
  if (cached) return cached;
  try { return await fetchFreshToken(); } catch { return null; }
}

function fmt(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export default function MoviePlayer({
  movieId,
  title,
  hasLocalVideo = false,
  trailerKey,
  qualities = [],
  subtitles = [],
  backdropUrl,
}: {
  movieId: number;
  title: string;
  hasLocalVideo?: boolean;
  trailerKey?: string | null;
  qualities?: QualityOption[];
  subtitles?: SubtitleOption[];
  backdropUrl?: string | null;
}) {
  const [showModal, setShowModal] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoQuality, setAutoQuality] = useState("auto");
  const [currentQuality, setCurrentQuality] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`quality-${movieId}`);
      if (saved && saved !== "auto") return saved;
    }
    return "auto";
  });
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [subtitleOn, setSubtitleOn] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("subs-enabled") !== "off";
    return true;
  });

  // Custom control state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seekPreview, setSeekPreview] = useState<{ pct: number; time: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef(0);
  const resumeAtRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekingRef = useRef(false);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const [seekRipple, setSeekRipple] = useState<{ side: "l" | "r"; id: number } | null>(null);

  useEffect(() => {
    const { quality } = getRecommendedQuality();
    setAutoQuality(quality);
  }, []);

  // Resume position
  useEffect(() => {
    if (!showModal || !hasLocalVideo) return;
    let cancelled = false;
    fetch(`/api/progress?movieId=${movieId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.success && d.data?.progress?.position_seconds > 5) {
          resumeAtRef.current = d.data.progress.position_seconds;
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showModal, hasLocalVideo, movieId]);

  const saveProgress = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration || isNaN(v.duration)) return;
    const now = Date.now();
    if (now - lastSavedRef.current < 15000) return;
    lastSavedRef.current = now;
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId, position: v.currentTime, duration: v.duration }),
    }).catch(() => {});
  }, [movieId]);

  const getSelectedFile = useCallback(() => {
    const effective = currentQuality === "auto" ? autoQuality : currentQuality;
    return qualities.find((q) => q.quality === effective)?.file ?? qualities[0]?.file ?? "";
  }, [qualities, currentQuality, autoQuality]);

  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      const cached = getCachedToken();
      if (cached) { setToken(cached); setTokenError(false); setLoading(false); return; }
      const t = await fetchFreshToken();
      setToken(t);
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
    if (hasLocalVideo && !token) await fetchToken();
  }, [hasLocalVideo, token, fetchToken]);

  const closeModal = useCallback(() => {
    saveProgress();
    setShowModal(false);
    document.body.style.overflow = "";
    setShowQualityMenu(false);
    setShowSpeedMenu(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    videoRef.current?.pause();
  }, [saveProgress]);

  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && showModal && !document.fullscreenElement) closeModal(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [showModal, closeModal]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    if (!showQualityMenu && !showSpeedMenu) return;
    const handler = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) setShowQualityMenu(false);
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) setShowSpeedMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showQualityMenu, showSpeedMenu]);

  // ===== Player actions =====
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  }, []);

  const changeVolume = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.max(0, Math.min(1, v.volume + delta));
    v.volume = next;
    v.muted = false;
    setVolume(next);
    setMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else containerRef.current?.requestFullscreen().catch(() => {});
  }, []);

  const toggleSubtitles = useCallback(() => {
    const next = !subtitleOn;
    setSubtitleOn(next);
    localStorage.setItem("subs-enabled", next ? "on" : "off");
    const v = videoRef.current;
    if (v) {
      for (const t of v.textTracks) t.mode = "hidden";
      if (next) {
        const mm = Array.from(v.textTracks).find((t) => t.language === "mm") ?? v.textTracks[0];
        if (mm) mm.mode = "showing";
      }
    }
  }, [subtitleOn]);

  const setPlaybackSpeed = useCallback((s: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  }, []);

  const switchQuality = useCallback((quality: string) => {
    setCurrentQuality(quality);
    setShowQualityMenu(false);
    localStorage.setItem(`quality-${movieId}`, quality);
    const v = videoRef.current;
    if (v && token) {
      const time = v.currentTime;
      const wasPlaying = !v.paused;
      const effective = quality === "auto" ? autoQuality : quality;
      const file = qualities.find((q) => q.quality === effective)?.file;
      if (file) {
        v.src = `/api/stream/${movieId}?token=${token}&file=${encodeURIComponent(file)}`;
        v.currentTime = time;
        if (wasPlaying) v.play().catch(() => {});
      }
    }
  }, [movieId, token, qualities, autoQuality]);

  // ===== Keyboard shortcuts =====
  useEffect(() => {
    if (!showModal || !hasLocalVideo) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      switch (e.key.toLowerCase()) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "arrowright": e.preventDefault(); seekBy(5); break;
        case "arrowleft": e.preventDefault(); seekBy(-5); break;
        case "l": e.preventDefault(); seekBy(10); break;
        case "j": e.preventDefault(); seekBy(-10); break;
        case "arrowup": e.preventDefault(); changeVolume(0.1); break;
        case "arrowdown": e.preventDefault(); changeVolume(-0.1); break;
        case "m": toggleMute(); break;
        case "f": toggleFullscreen(); break;
        case "c": toggleSubtitles(); break;
        case ">": case ".": { const i = SPEEDS.indexOf(speed); if (i < SPEEDS.length - 1) setPlaybackSpeed(SPEEDS[i + 1]); break; }
        case "<": case ",": { const i = SPEEDS.indexOf(speed); if (i > 0) setPlaybackSpeed(SPEEDS[i - 1]); break; }
        default:
          if (/^[0-9]$/.test(e.key) && videoRef.current?.duration) {
            videoRef.current.currentTime = (parseInt(e.key) / 10) * videoRef.current.duration;
          }
      }
      showControls();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, hasLocalVideo, speed, subtitleOn, togglePlay, seekBy, changeVolume, toggleMute, toggleFullscreen, toggleSubtitles, setPlaybackSpeed]);

  // Auto-hide controls
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!videoRef.current?.paused) setControlsVisible(false);
    }, 3000);
  }, []);

  // ===== Mobile: tap / double-tap seek (YouTube-style) =====
  const handleVideoTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const last = lastTapRef.current;

    if (last && now - last.time < 300) {
      // Double tap — seek ±10s based on tap side
      const side: "l" | "r" = x < rect.width / 2 ? "l" : "r";
      seekBy(side === "l" ? -10 : 10);
      setSeekRipple({ side, id: now });
      setTimeout(() => setSeekRipple(null), 500);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, x };
      setTimeout(() => {
        if (lastTapRef.current && Date.now() - lastTapRef.current.time >= 300) {
          // Single tap — toggle controls (mobile) or play/pause (desktop cursor)
          if (!controlsVisible) {
            showControls();
          } else {
            togglePlay();
          }
          lastTapRef.current = null;
        }
      }, 300);
    }
  }, [controlsVisible, seekBy, showControls, togglePlay]);

  const streamUrl = token
    ? `/api/stream/${movieId}?token=${token}&file=${encodeURIComponent(getSelectedFile())}`
    : null;
  const youtubeUrl = trailerKey ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0` : null;
  const hasMultipleQualities = qualities.length > 1;
  const effectiveQuality = currentQuality === "auto" ? autoQuality : currentQuality;
  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = videoRef.current;
    if (v && duration) v.currentTime = pct * duration;
  };

  return (
    <>
      <button
        onClick={openModal}
        onMouseEnter={prefetchStreamToken}
        className="group inline-flex items-center gap-2.5 px-7 py-3 bg-netflix hover:bg-netflix-hover text-white rounded-xl font-semibold transition-all duration-200 text-base shadow-lg shadow-netflix/25 hover:shadow-netflix/40 active:scale-[0.98]"
      >
        <Play className="h-5 w-5 fill-current group-hover:scale-110 transition-transform" />
        {hasLocalVideo ? "Watch Now" : "Watch Trailer"}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4" onClick={closeModal}>
          <div
            ref={containerRef}
            className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl group/player"
            onClick={(e) => e.stopPropagation()}
            onMouseMove={() => { if (hasLocalVideo) showControls(); }}
          >
            {/* Top bar */}
            <div className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${hasLocalVideo && !controlsVisible ? "opacity-0" : "opacity-100"}`}>
              <span className="text-white text-sm font-medium truncate pr-4">{title}</span>
              <button onClick={closeModal} className="p-1.5 bg-white/20 rounded-full text-white hover:bg-white/30 transition flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quality badge + menus */}
            {hasLocalVideo && (
              <div className={`absolute top-12 left-4 z-30 flex items-center gap-2 transition-opacity duration-300 ${!controlsVisible ? "opacity-0" : "opacity-100"}`}>
                <div ref={qualityMenuRef}>
                  <button
                    onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); }}
                    className="px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-bold rounded backdrop-blur-sm transition border border-white/10 flex items-center gap-1.5"
                  >
                    {currentQuality === "auto" && <Wifi className="h-3 w-3" />}
                    {effectiveQuality.toUpperCase()}
                    <span className="text-[10px] opacity-70">▼</span>
                  </button>
                  {showQualityMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-black/90 rounded-lg border border-white/10 overflow-hidden min-w-[150px] backdrop-blur-sm">
                      <button onClick={() => switchQuality("auto")} className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-white/10 transition">
                        <span className="flex items-center gap-2"><Wifi className="h-3 w-3" />Auto ({autoQuality.toUpperCase()})</span>
                        {currentQuality === "auto" && <Check className="h-3 w-3 text-green-400" />}
                      </button>
                      {qualities.map((q) => (
                        <button key={q.quality} onClick={() => switchQuality(q.quality)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-white/10 transition">
                          <span>{q.quality}</span>
                          {currentQuality === q.quality && <Check className="h-3 w-3 text-green-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Speed */}
                <div ref={speedMenuRef}>
                  <button
                    onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); }}
                    className="px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-bold rounded backdrop-blur-sm transition border border-white/10 flex items-center gap-1.5"
                  >
                    <Gauge className="h-3 w-3" />
                    {speed}×
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-black/90 rounded-lg border border-white/10 overflow-hidden min-w-[90px] backdrop-blur-sm">
                      {SPEEDS.map((s) => (
                        <button key={s} onClick={() => setPlaybackSpeed(s)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-white/10 transition">
                          <span>{s === 1 ? "Normal" : `${s}×`}</span>
                          {speed === s && <Check className="h-3 w-3 text-green-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Single quality (no dropdown) */}
            {hasLocalVideo && !hasMultipleQualities && (
              <div className={`absolute top-12 left-4 z-20 transition-opacity duration-300 ${!controlsVisible ? "opacity-0" : "opacity-100"}`}>
                <span className="px-3 py-1.5 bg-black/60 text-white text-xs font-bold rounded backdrop-blur-sm border border-white/10">
                  {effectiveQuality.toUpperCase()}
                </span>
              </div>
            )}

            {/* Loading — cinematic backdrop, ONLY for local video buffering.
                Trailers (YouTube) load in their own iframe and never show this. */}
            {hasLocalVideo && loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black">
                {backdropUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={backdropUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60" />
                <div className="relative flex flex-col items-center gap-3">
                  <span className="text-2xl font-black tracking-tight text-white">
                    vionix<span className="text-netflix">.</span>
                  </span>
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-netflix animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Token error */}
            {tokenError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-4 px-6">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="text-white font-medium">Unable to load video</p>
                <button onClick={fetchToken} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition">Retry</button>
              </div>
            )}

            {/* Video */}
            {hasLocalVideo && streamUrl && !tokenError && (
              <>
                <video
                  ref={videoRef}
                  key={streamUrl}
                  src={streamUrl}
                  autoPlay
                  playsInline
                  className="w-full h-full select-none"
                  onContextMenu={(e) => e.preventDefault()}
                  onLoadedMetadata={(e) => {
                    setDuration(e.currentTarget.duration);
                    if (resumeAtRef.current && resumeAtRef.current > 5) {
                      e.currentTarget.currentTime = resumeAtRef.current;
                      resumeAtRef.current = null;
                    }
                    e.currentTarget.volume = volume;
                  }}
                  onTimeUpdate={(e) => { setCurrentTime(e.currentTarget.currentTime); saveProgress(); }}
                  onProgress={(e) => {
                    const v = e.currentTarget;
                    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
                  }}
                  onPlay={() => { setIsPlaying(true); setLoading(false); showControls(); }}
                  onPause={() => { setIsPlaying(false); saveProgress(); showControls(); }}
                  onWaiting={() => setLoading(true)}
                  onPlaying={() => setLoading(false)}
                  onCanPlay={() => setLoading(false)}
                >
                  {subtitles.map((sub) => (
                    <track
                      key={sub.lang}
                      kind="subtitles"
                      src={`/api/subtitle/${movieId}?token=${token}&file=${encodeURIComponent(sub.file)}`}
                      srcLang={sub.lang}
                      label={sub.label}
                      default={sub.lang === "mm" && subtitleOn}
                    />
                  ))}
                </video>

                {/* Tap surface: double-tap sides seek, single tap toggles controls */}
                <div className="absolute inset-0 z-[5]" onClick={handleVideoTap}>
                  {/* Seek ripples */}
                  {seekRipple && (
                    <div
                      className={`absolute inset-y-0 ${seekRipple.side === "l" ? "left-0" : "right-0"} w-1/2 bg-white/10 flex items-center justify-center animate-[ripple_0.5s_ease-out]`}
                    >
                      <span className="flex flex-col items-center gap-1 text-white">
                        {seekRipple.side === "l" ? <RotateCcw className="h-8 w-8" /> : <RotateCw className="h-8 w-8" />}
                        <span className="text-sm font-bold">10s</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Center play pulse when paused */}
                {!isPlaying && !loading && (
                  <button onClick={togglePlay} className="absolute inset-0 z-10 flex items-center justify-center">
                    <span className="p-5 rounded-full bg-black/50 backdrop-blur-sm">
                      <Play className="h-10 w-10 text-white fill-current" />
                    </span>
                  </button>
                )}

                {/* ===== Custom control bar ===== */}
                <div
                  className={`absolute bottom-0 left-0 right-0 z-20 px-3 sm:px-4 pt-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
                >
                  {/* Seek bar */}
                  <div
                    className="relative h-5 flex items-center cursor-pointer group/seek"
                    onClick={handleSeek}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      setSeekPreview({ pct: pct * 100, time: pct * duration });
                    }}
                    onMouseLeave={() => setSeekPreview(null)}
                  >
                    <div className="w-full h-1 group-hover/seek:h-1.5 rounded-full bg-white/20 transition-all relative overflow-visible">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${bufferedPct}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-netflix" style={{ width: `${progressPct}%` }} />
                      <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-netflix scale-0 group-hover/seek:scale-100 transition-transform shadow" style={{ left: `calc(${progressPct}% - 7px)` }} />
                      {seekPreview && (
                        <div
                          className="absolute -top-8 px-1.5 py-0.5 rounded bg-black/90 text-white text-[11px] -translate-x-1/2 pointer-events-none"
                          style={{ left: `${seekPreview.pct}%` }}
                        >
                          {fmt(seekPreview.time)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Buttons row */}
                  <div className="flex items-center gap-1.5 mt-1 text-white">
                    <button onClick={togglePlay} className="p-2.5 sm:p-2 active:bg-white/20 sm:hover:bg-white/10 rounded-full transition" aria-label={isPlaying ? "Pause (K)" : "Play (K)"}>
                      {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                    </button>
                    <button onClick={() => seekBy(-10)} className="p-2.5 sm:p-2 active:bg-white/20 sm:hover:bg-white/10 rounded-full transition" aria-label="Back 10s (J)">
                      <RotateCcw className="h-4.5 w-4.5" />
                    </button>
                    <button onClick={() => seekBy(10)} className="p-2.5 sm:p-2 active:bg-white/20 sm:hover:bg-white/10 rounded-full transition" aria-label="Forward 10s (L)">
                      <RotateCw className="h-4.5 w-4.5" />
                    </button>

                    {/* Volume */}
                    <div className="flex items-center gap-1 group/vol">
                      <button onClick={toggleMute} className="p-2.5 sm:p-2 active:bg-white/20 sm:hover:bg-white/10 rounded-full transition" aria-label="Mute (M)">
                        {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                      </button>
                      <input
                        type="range"
                        min={0} max={1} step={0.05}
                        value={muted ? 0 : volume}
                        onChange={(e) => {
                          const v = videoRef.current;
                          const val = parseFloat(e.target.value);
                          if (v) { v.volume = val; v.muted = val === 0; }
                          setVolume(val);
                          setMuted(val === 0);
                        }}
                        className="w-0 group-hover/vol:w-20 transition-all duration-300 accent-white h-1 cursor-pointer"
                        aria-label="Volume"
                      />
                    </div>

                    <span className="text-xs tabular-nums ml-1 text-white/90">
                      {fmt(currentTime)} <span className="text-white/50">/ {fmt(duration)}</span>
                    </span>

                    <div className="flex-1" />

                    {/* Subtitles */}
                    {subtitles.length > 0 && (
                      <button
                        onClick={toggleSubtitles}
                        className={`p-2 rounded-full transition ${subtitleOn ? "text-netflix" : "text-white hover:bg-white/10"}`}
                        aria-label="Subtitles (C)"
                      >
                        <Subtitles className="h-5 w-5" />
                      </button>
                    )}

                    {/* Speed */}
                    <button
                      onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); }}
                      className="px-2 py-2 hover:bg-white/10 rounded-full transition text-xs font-bold"
                      aria-label="Playback speed"
                    >
                      {speed}×
                    </button>

                    {/* Quality */}
                    {hasMultipleQualities && (
                      <button
                        onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); }}
                        className="px-2 py-2 hover:bg-white/10 rounded-full transition text-xs font-bold flex items-center gap-1"
                      >
                        {currentQuality === "auto" && <Wifi className="h-3.5 w-3.5" />}
                        {effectiveQuality.toUpperCase()}
                      </button>
                    )}

                    {/* Fullscreen */}
                    <button onClick={toggleFullscreen} className="p-2.5 sm:p-2 active:bg-white/20 sm:hover:bg-white/10 rounded-full transition" aria-label="Fullscreen (F)">
                      {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Shortcut hint (first 5s) */}
                <div className={`absolute bottom-16 right-4 z-20 text-[11px] text-white/50 bg-black/60 rounded-lg px-3 py-2 backdrop-blur-sm transition-opacity duration-1000 pointer-events-none ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
                  <span className="font-semibold text-white/80">Shortcuts:</span> Space play · ←→ 5s · JL 10s · F fullscreen · M mute · C subs · 0-9 jump
                </div>
              </>
            )}

            {/* YouTube fallback */}
            {!hasLocalVideo && youtubeUrl && (
              <iframe
                src={youtubeUrl}
                title={`${title} - Trailer`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}

            {/* Nothing available */}
            {!hasLocalVideo && !youtubeUrl && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-4 px-6">
                <AlertCircle className="h-12 w-12 text-muted-foreground" />
                <p className="text-white/70 text-sm text-center">No video available for this movie.</p>
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
