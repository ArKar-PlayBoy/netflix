"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Play, X, AlertCircle, Check, Wifi, Subtitles, Pause,
  Volume2, VolumeX, Maximize, Minimize, RotateCcw, RotateCw,
} from "lucide-react";
import { getRecommendedQuality } from "@/lib/network";
import { useProgressSync } from "@/components/player/use-progress-sync";
import SubtitleRenderer from "@/components/player/subtitle-renderer";
import { useAdaptiveQuality } from "@/components/player/use-adaptive-quality";
import { usePlayerGestures } from "@/components/player/use-gestures";
import { useFullscreen } from "@/components/player/use-fullscreen";

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
  const [showSubsMenu, setShowSubsMenu] = useState(false);
  // Active subtitle language (null = off); persisted globally, mm → en smart default
  const [activeSub, setActiveSub] = useState<string | null>(null);

  // Custom control state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seekPreview, setSeekPreview] = useState<{ pct: number; time: number } | null>(null);
  const [everPlayed, setEverPlayed] = useState(false);
  const [stalling, setStalling] = useState(false);
  // Position the player auto-resumed from (null = started fresh / no banner)
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const subsMenuRef = useRef<HTMLDivElement>(null);

  // Progress persistence (resume fetch + throttled saves) — extracted hook
  const { resumeAtRef, saveProgress, resetProgress } = useProgressSync(
    movieId,
    showModal && hasLocalVideo,
    () => videoRef.current,
    setResumedFrom
  );

  // Fullscreen via shared hook — native API with webkit fallback, fake-fullscreen on iPhone
  const { isActive: fsActive, fakeFs: fsFake, toggle: toggleFs, exit: exitFs } = useFullscreen(() => containerRef.current);

  useEffect(() => {
    const { quality } = getRecommendedQuality();
    setAutoQuality(quality);
  }, []);

  const getSelectedFile = useCallback(() => {
    const effective = currentQuality === "auto" ? autoQuality : currentQuality;
    return qualities.find((q) => q.quality === effective)?.file ?? qualities[0]?.file ?? "";
  }, [qualities, currentQuality, autoQuality]);

  const fetchToken = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const cached = force ? null : getCachedToken();
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
    setEverPlayed(false);
    setStalling(false);
    setResumedFrom(null);
    setShowModal(false);
    document.body.style.overflow = "";
    setShowQualityMenu(false);
    setShowSpeedMenu(false);
    setShowSubsMenu(false);
    exitFs();
    videoRef.current?.pause();
  }, [saveProgress, exitFs]);

  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
    if (!showModal) return;
    if (e.key === "Escape") {
      if (fsFake) exitFs();
      else if (!document.fullscreenElement) closeModal();
    }
  };
    window.addEventListener("keydown", onEsc);
    return () =>     window.removeEventListener("keydown", onEsc);
  }, [showModal, closeModal, fsFake, exitFs]);

  // Close menus on outside click
  useEffect(() => {
  if (!showQualityMenu && !showSpeedMenu && !showSubsMenu) return;
  const handler = (e: MouseEvent) => {
    if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) setShowQualityMenu(false);
    if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) setShowSpeedMenu(false);
    if (subsMenuRef.current && !subsMenuRef.current.contains(e.target as Node)) setShowSubsMenu(false);
  };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showQualityMenu, showSpeedMenu, showSubsMenu]);

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

  // Resolve initial subtitle language: saved pref → mm → en → first available
  useEffect(() => {
    if (subtitles.length === 0) {
      setActiveSub(null);
      return;
    }
    const saved = localStorage.getItem("subs-lang");
    const pick =
      subtitles.find((s) => s.lang === saved) ??
      subtitles.find((s) => s.lang === "mm") ??
      subtitles.find((s) => s.lang === "en") ??
      subtitles[0];
    setActiveSub(pick.lang);
  }, [subtitles]);

  const selectSubtitle = useCallback((lang: string | null) => {
    setActiveSub(lang);
    if (lang) localStorage.setItem("subs-lang", lang);
    setShowSubsMenu(false);
  }, []);

  // "c" cycles: current → next track → off → first
  const cycleSubtitles = useCallback(() => {
    if (subtitles.length === 0) return;
    const options: (string | null)[] = [...subtitles.map((s) => s.lang), null];
    const next = options[(options.indexOf(activeSub) + 1) % options.length];
    selectSubtitle(next);
  }, [subtitles, activeSub, selectSubtitle]);

  // "Start from beginning" — seek 0 first so resetProgress persists ~0, not the stale resume point
  const restartFromBeginning = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      if (v.paused) v.play().catch(() => {});
    }
    setResumedFrom(null);
    resetProgress();
  }, [resetProgress]);

  // Resume banner is an FYI, not a modal — auto-dismiss
  useEffect(() => {
    if (resumedFrom == null) return;
    const t = setTimeout(() => setResumedFrom(null), 8000);
    return () => clearTimeout(t);
  }, [resumedFrom]);

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

  // ===== Keyboard shortcuts (desktop) — every action also has an on-screen button =====
  // space/k play·pause · ←/→ seek 5s · j/l seek 10s · ↑/↓ volume · m mute
  // f fullscreen · c subtitles · >/. speed up · </, speed down · 0–9 jump to %
  // Laptop media keys: ▶/⏸ (MediaPlayPause), ⏭ +10s, ⏮ −10s
  // Limitation: keys never fire while focus is inside a cross-origin embed iframe.
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
        case "f": toggleFs(); break;
        case "c": cycleSubtitles(); break;
        case "mediaplaypause": e.preventDefault(); togglePlay(); break;
        case "mediatracknext": e.preventDefault(); seekBy(10); break;
        case "mediatrackprevious": e.preventDefault(); seekBy(-10); break;
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
  }, [showModal, hasLocalVideo, speed, cycleSubtitles, togglePlay, seekBy, changeVolume, toggleMute, toggleFs, setPlaybackSpeed]);

  // Auto-hide controls (never while a menu is open — that was "vanishing selection" bug)
  const menuOpenRef = useRef(false);
  menuOpenRef.current = showQualityMenu || showSpeedMenu || showSubsMenu;

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!videoRef.current?.paused && !menuOpenRef.current) setControlsVisible(false);
    }, 3000);
  }, []);

  // ===== Gestures (hold-2x, double-tap seek, tap controls) — extracted hook =====
  const gestures = usePlayerGestures({
    videoRef,
    seekBy,
    togglePlay,
    showControls,
    hideControls: () => setControlsVisible(false),
    controlsVisible,
    speed,
  });

  // ===== Adaptive quality (Auto mode only) — extracted hook =====
  useAdaptiveQuality({
    active: showModal && hasLocalVideo,
    autoMode: currentQuality === "auto",
    videoRef,
    autoQuality,
    onAutoSwitch: (next) => {
      switchQuality(next);
      setCurrentQuality("auto");
    },
  });

  const streamUrl = token
    ? `/api/stream/${movieId}?token=${token}&file=${encodeURIComponent(getSelectedFile())}`
    : null;
  const youtubeUrl = trailerKey ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0` : null;
  const hasMultipleQualities = qualities.length > 1;
  const effectiveQuality = currentQuality === "auto" ? autoQuality : currentQuality;
  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  // ===== Seek scrubbing — pointer-based so touch can drag (YouTube-style) =====
  const pctFromClientX = (clientX: number): number => {
    const el = seekBarRef.current;
    if (!el || !duration) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const onSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubbingRef.current = true;
    const pct = pctFromClientX(e.clientX);
    setSeekPreview({ pct: pct * 100, time: pct * duration });
  };

  const onSeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubbingRef.current) {
      const pct = pctFromClientX(e.clientX);
      setSeekPreview({ pct: pct * 100, time: pct * duration });
      return;
    }
    if (e.pointerType === "mouse") {
      const pct = pctFromClientX(e.clientX);
      setSeekPreview({ pct: pct * 100, time: pct * duration });
    }
  };

  const onSeekPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    const pct = pctFromClientX(e.clientX);
    const v = videoRef.current;
    if (v && duration) v.currentTime = pct * duration;
    setSeekPreview(null);
  };

  const onSeekPointerLeave = () => {
    if (!scrubbingRef.current) setSeekPreview(null);
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
        <div className="fixed inset-0 z-[200] bg-black sm:bg-black/95 sm:flex sm:items-center sm:justify-center sm:p-4" onClick={closeModal}>
          <div
            ref={containerRef}
            className="relative w-full aspect-video h-full sm:h-auto sm:max-w-5xl bg-black sm:rounded-lg overflow-hidden shadow-2xl group/player"
            onClick={(e) => e.stopPropagation()}
            onMouseMove={() => { if (hasLocalVideo) showControls(); }}
            onPointerDown={() => { gestures.resetDoubleTap(); if (hasLocalVideo) showControls(); }}
          >
            {/* Top bar */}
            <div className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${hasLocalVideo && !controlsVisible ? "opacity-0" : "opacity-100"}`}>
              <span className="text-white text-sm font-medium truncate pr-4">{title}</span>
              <button onClick={closeModal} className="p-1.5 bg-white/20 rounded-full text-white hover:bg-white/30 transition flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quality indicator (display-only — selection lives in control bar) */}
            {hasLocalVideo && (
              <div className={`absolute top-12 left-4 z-20 transition-opacity duration-300 ${!controlsVisible ? "opacity-0" : "opacity-100"}`}>
                <span className="px-2.5 py-1 bg-black/60 text-white text-[11px] font-bold rounded backdrop-blur-sm border border-white/10">
                  {effectiveQuality.toUpperCase()}
                </span>
              </div>
            )}

            {/* Mid-playback stall: subtle spinner, video frame stays visible */}
            {stalling && !loading && (
              <div className="absolute inset-0 z-[15] flex items-center justify-center pointer-events-none">
                <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-netflix animate-spin" />
              </div>
            )}

            {/* Loading — cinematic backdrop, ONLY for initial load.
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
                    <button onClick={async () => { setLoading(true); setTokenError(false); await fetchToken(true); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition">Retry</button>
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
                      setResumedFrom(resumeAtRef.current);
                      resumeAtRef.current = null;
                    }
                    e.currentTarget.volume = volume;
                  }}
                  onTimeUpdate={(e) => { setCurrentTime(e.currentTarget.currentTime); saveProgress(); }}
                  onProgress={(e) => {
                    const v = e.currentTarget;
                    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
                  }}
                  onPlay={() => { setIsPlaying(true); setEverPlayed(true); setStalling(false); setLoading(false); showControls(); }}
                  onPause={() => { setIsPlaying(false); saveProgress(); showControls(); }}
                  onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
                  onWaiting={() => { if (everPlayed) { setStalling(true); } else { setLoading(true); } }}
                  onPlaying={() => setLoading(false)}
                  onCanPlay={() => { setLoading(false); if (everPlayed) setStalling(false); }}
                  onError={() => {
                    // Stream broke (expired URL / transient reset) → show retry panel
                    setTokenError(true);
                    setLoading(false);
                  }}
                >
                </video>

                {/* Custom caption overlay — replaces native <track> for identical rendering everywhere */}
                {activeSub && token && (() => {
                  const active = subtitles.find((s) => s.lang === activeSub);
                  return active ? (
                    <SubtitleRenderer
                      movieId={movieId}
                      token={token}
                      file={active.file}
                      currentTime={currentTime}
                      controlsVisible={controlsVisible}
                    />
                  ) : null;
                })()}

                {/* Tap surface: double-tap sides seek, single tap toggles controls, hold = 2x */}
                <div
                  className="absolute inset-0 z-[5] touch-manipulation select-none"
                  onClick={(e) => { if (gestures.consumeSuppressedTap()) { e.stopPropagation(); return; } gestures.handleSurfaceTap(e); }}
                  onTouchStart={gestures.startLongPress}
                  onTouchMove={gestures.cancelLongPress}
                  onTouchEnd={() => gestures.endLongPress()}
                >
                  {/* Seek ripples */}
                  {gestures.seekRipple && (
                    <div
                      className={`absolute inset-y-0 ${gestures.seekRipple.side === "l" ? "left-0" : "right-0"} w-1/2 bg-white/10 flex items-center justify-center animate-[ripple_0.5s_ease-out]`}
                    >
                      <span className="flex flex-col items-center gap-1 text-white">
                        {gestures.seekRipple.side === "l" ? <RotateCcw className="h-8 w-8" /> : <RotateCw className="h-8 w-8" />}
                        <span className="text-sm font-bold">10s</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* 2x hold indicator */}
                {gestures.longPress2x && (
                  <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-white text-sm font-bold flex items-center gap-1.5">
                    <Play className="h-4 w-4 fill-current" /> 2x
                  </div>
                )}

                {/* Resumed-from banner — tells the viewer why playback didn't start at 0 */}
                {resumedFrom != null && !gestures.longPress2x && (
                  <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 rounded-full bg-black/70 backdrop-blur-sm pl-4 pr-1.5 py-1.5 text-white text-sm shadow-lg">
                    <span className="whitespace-nowrap">Resumed from {fmt(resumedFrom)}</span>
                    <button
                      onClick={restartFromBeginning}
                      className="rounded-full bg-white/15 hover:bg-white/25 px-3 py-1 text-xs font-semibold transition"
                    >
                      Restart
                    </button>
                    <button
                      onClick={() => setResumedFrom(null)}
                      aria-label="Dismiss"
                      className="rounded-full p-1.5 hover:bg-white/15 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

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
                  className={`absolute bottom-0 left-0 right-0 z-20 px-3 sm:px-4 pt-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 touch-manipulation ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
                >
                  {/* Seek bar — pointer capture enables touch drag-scrubbing */}
                  <div
                    ref={seekBarRef}
                    className="relative h-5 flex items-center cursor-pointer group/seek touch-none"
                    onPointerDown={onSeekPointerDown}
                    onPointerMove={onSeekPointerMove}
                    onPointerUp={onSeekPointerUp}
                    onPointerCancel={onSeekPointerUp}
                    onPointerLeave={onSeekPointerLeave}
                  >
                    <div className="w-full h-1 group-hover/seek:h-1.5 rounded-full bg-white/20 transition-all relative overflow-visible">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${bufferedPct}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-netflix" style={{ width: `${progressPct}%` }} />
                      {seekPreview && (
                        <div className="absolute inset-y-0 left-0 rounded-full bg-white/70" style={{ width: `${seekPreview.pct}%` }} />
                      )}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-netflix transition-transform shadow ${seekPreview ? "scale-100" : "scale-0 group-hover/seek:scale-100"}`}
                        style={{ left: `calc(${seekPreview ? seekPreview.pct : progressPct}% - 7px)` }}
                      />
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

                    {/* Volume — desktop only; phones use hardware keys */}
                    <div className="hidden sm:flex items-center gap-1 group/vol">
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
                        className="hidden sm:block w-0 group-hover/vol:w-20 transition-all duration-300 accent-white h-1 cursor-pointer"
                        aria-label="Volume"
                      />
                    </div>

                    <span className="text-[10px] sm:text-xs tabular-nums ml-1 text-white/90">
                      {fmt(currentTime)} <span className="text-white/50">/ {fmt(duration)}</span>
                    </span>

                    <div className="flex-1" />

                    {/* Subtitles — language menu */}
                    {subtitles.length > 0 && (
                      <div className="relative" ref={subsMenuRef}>
                        <button
                          onClick={() => { setShowSubsMenu(!showSubsMenu); setShowQualityMenu(false); setShowSpeedMenu(false); showControls(); }}
                          className={`p-2 rounded-full transition ${activeSub ? "text-netflix" : "text-white hover:bg-white/10"}`}
                          aria-label="Subtitles (C)"
                        >
                          <Subtitles className="h-5 w-5" />
                        </button>
                        {showSubsMenu && (
                          <div className="absolute bottom-full right-0 mb-3 bg-black/95 rounded-xl border border-white/10 overflow-hidden min-w-[150px] backdrop-blur-md shadow-2xl">
                            <p className="px-4 pt-2.5 pb-1 text-[11px] uppercase tracking-wider text-white/40 font-semibold">Subtitles</p>
                            <button
                              onClick={() => selectSubtitle(null)}
                              className="w-full flex items-center justify-between px-4 py-3 text-sm text-white active:bg-white/20 sm:hover:bg-white/10 transition"
                            >
                              <span>Off</span>
                              {activeSub === null && <Check className="h-4 w-4 text-netflix" />}
                            </button>
                            {subtitles.map((s) => (
                              <button
                                key={s.lang}
                                onClick={() => selectSubtitle(s.lang)}
                                className="w-full flex items-center justify-between px-4 py-3 text-sm text-white active:bg-white/20 sm:hover:bg-white/10 transition"
                              >
                                <span>{s.label || ({ en: "English", mm: "မြန်မာ" } as Record<string, string>)[s.lang] || s.lang}</span>
                                {activeSub === s.lang && <Check className="h-4 w-4 text-netflix" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Speed — menu opens ABOVE the bar, thumb-friendly */}
                    <div className="relative" ref={speedMenuRef}>
                      <button
                        onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); showControls(); }}
                        className={`px-2.5 py-2.5 sm:px-2 sm:py-2 rounded-full transition text-xs font-bold ${showSpeedMenu ? "bg-white/20" : "active:bg-white/20 sm:hover:bg-white/10"}`}
                        aria-label="Playback speed"
                      >
                        {speed}×
                      </button>
                      {showSpeedMenu && (
                        <div className="absolute bottom-full right-0 mb-3 bg-black/95 rounded-xl border border-white/10 overflow-hidden min-w-[130px] backdrop-blur-md shadow-2xl">
                          <p className="px-4 pt-2.5 pb-1 text-[11px] uppercase tracking-wider text-white/40 font-semibold">Speed</p>
                          {SPEEDS.map((s) => (
                            <button key={s} onClick={() => setPlaybackSpeed(s)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-white active:bg-white/20 sm:hover:bg-white/10 transition min-w-[120px]">
                              <span>{s === 1 ? "Normal" : `${s}×`}</span>
                              {speed === s && <Check className="h-4 w-4 text-netflix" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quality — same bottom-sheet pattern */}
                    {hasMultipleQualities && (
                      <div className="relative" ref={qualityMenuRef}>
                        <button
                          onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); showControls(); }}
                          className={`px-2.5 py-2.5 sm:px-2 sm:py-2 rounded-full transition text-xs font-bold flex items-center gap-1 ${showQualityMenu ? "bg-white/20" : "active:bg-white/20 sm:hover:bg-white/10"}`}
                          aria-label="Quality"
                        >
                          {currentQuality === "auto" && <Wifi className="h-3.5 w-3.5" />}
                          {effectiveQuality.toUpperCase()}
                        </button>
                        {showQualityMenu && (
                          <div className="absolute bottom-full right-0 mb-3 bg-black/95 rounded-xl border border-white/10 overflow-hidden min-w-[170px] backdrop-blur-md shadow-2xl">
                            <p className="px-4 pt-2.5 pb-1 text-[11px] uppercase tracking-wider text-white/40 font-semibold">Quality</p>
                            <button onClick={() => switchQuality("auto")} className="w-full flex items-center justify-between px-4 py-3 text-sm text-white active:bg-white/20 sm:hover:bg-white/10 transition">
                              <span className="flex items-center gap-2"><Wifi className="h-4 w-4" />Auto</span>
                              {currentQuality === "auto" && <Check className="h-4 w-4 text-netflix" />}
                            </button>
                            {qualities.map((q) => (
                              <button key={q.quality} onClick={() => switchQuality(q.quality)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-white active:bg-white/20 sm:hover:bg-white/10 transition">
                                <span>{q.quality}</span>
                                {currentQuality === q.quality && <Check className="h-4 w-4 text-netflix" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fullscreen */}
                    <button onClick={toggleFs} className="p-2.5 sm:p-2 active:bg-white/20 sm:hover:bg-white/10 rounded-full transition" aria-label="Fullscreen (F)">
                      {fsActive ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Shortcut hint — desktop only (overlaps menus on phones) */}
                <div className={`hidden md:block absolute bottom-16 right-4 z-20 text-[11px] text-white/50 bg-black/60 rounded-lg px-3 py-2 backdrop-blur-sm transition-opacity duration-1000 pointer-events-none ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
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
