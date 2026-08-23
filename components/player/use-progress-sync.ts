"use client";

import { useCallback, useEffect, useRef } from "react";

const SAVE_THROTTLE_MS = 30_000;

/**
 * Owns watch-progress persistence: resume position fetch + throttled saves.
 * Saves fire at most every 30s (DB is US-East for now — each roundtrip costs
 * ~250ms), plus immediately on pause (caller) and when the tab is hidden.
 *
 * Resume race handling: the progress API (Neon roundtrip) may answer AFTER the
 * video's loadedmetadata (fast CDN). So when the fetch resolves we apply the
 * position immediately if the video is already loaded and untouched
 * (duration known, currentTime < 1s); otherwise stash it for onLoadedMetadata,
 * which reads resumeAtRef. Whichever arrives last still wins.
 */
export function useProgressSync(
  movieId: number,
  enabled: boolean,
  getVideo: () => HTMLVideoElement | null,
  onResumeApplied?: (pos: number) => void
) {
  const resumeAtRef = useRef<number | null>(null);
  const lastSavedRef = useRef(0);
  // Ref-stabilized getter: keeps the resume effect's deps free of per-render identity churn
  const getVideoRef = useRef(getVideo);
  useEffect(() => {
    getVideoRef.current = getVideo;
  });
  // Same stabilization for the resume callback (setState fns are stable, but stay uniform)
  const onResumeRef = useRef(onResumeApplied);
  useEffect(() => {
    onResumeRef.current = onResumeApplied;
  });

  // Resume position
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(`/api/progress?movieId=${movieId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.success) return;
        const pos = d.data?.progress?.position_seconds;
        if (!pos || pos <= 5) return;
        const v = getVideoRef.current();
        if (v && v.duration > 0 && v.currentTime < 1) {
          // Metadata already loaded (race lost by loadedmetadata) → seek now
          v.currentTime = pos;
          onResumeRef.current?.(pos);
        } else {
          // Not loaded yet → onLoadedMetadata will apply it
          resumeAtRef.current = pos;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, movieId]);

  const saveProgress = useCallback(() => {
    const v = getVideoRef.current();
    if (!v || !v.duration || isNaN(v.duration)) return;
    const now = Date.now();
    if (now - lastSavedRef.current < SAVE_THROTTLE_MS) return;
    lastSavedRef.current = now;
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId, position: v.currentTime, duration: v.duration }),
    }).catch(() => {});
  }, [movieId]);

  // Tab hidden (phone switch / desktop tab change) → save immediately
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.hidden) saveProgress();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, saveProgress]);

  // "Start from beginning" — bypasses the 30s throttle so a restart isn't
  // overwritten by the stale pre-restart position on close
  const resetProgress = useCallback(() => {
    lastSavedRef.current = 0;
    saveProgress();
  }, [saveProgress]);

  return { resumeAtRef, saveProgress, resetProgress };
}
