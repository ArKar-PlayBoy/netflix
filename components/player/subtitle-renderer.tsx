"use client";

import { useEffect, useState } from "react";
import { parseVtt, type VttCue } from "@/lib/vtt";

/**
 * Custom caption overlay — replaces native <track> so subtitles render
 * identically on every device (Myanmar Angoun font, Netflix-style pill),
 * including iPhones where ::cue font support is unreliable.
 *
 * Parsed cues are cached per file (P4): reopening a title never refetches.
 * Purely presentational — driven by the player's existing currentTime state.
 * Cache hits resolve during render (no effect-time setState); only network
 * fetches touch state asynchronously.
 *
 * Error policy: transient failures (network reset / 5xx — the flaky-R2 case)
 * retry once after a short backoff; permanent ones (401/404/400) give up
 * immediately. Giving up renders nothing and stays quiet — no fetch loop.
 */

const CACHE_TTL_MS = 30 * 60 * 1000;
const RETRY_DELAY_MS = 1200;
const MAX_ATTEMPTS = 2; // initial try + one retry
const cueCache = new Map<string, { at: number; cues: VttCue[] }>();

function freshFromCache(file: string): VttCue[] | null {
  const c = cueCache.get(file);
  return c && Date.now() - c.at < CACHE_TTL_MS ? c.cues : null;
}

/** Network rejects carry no numeric status → retryable; 5xx → retryable; the rest → permanent */
function isRetryable(err: unknown): boolean {
  const status = Number((err as Error)?.message);
  return Number.isNaN(status) || status >= 500;
}

export default function SubtitleRenderer({
  movieId,
  token,
  file,
  currentTime,
  controlsVisible,
}: {
  movieId: number;
  token: string;
  file: string;
  currentTime: number;
  controlsVisible: boolean;
}) {
  const [loaded, setLoaded] = useState<{ file: string; cues: VttCue[] } | null>(() =>
    file ? (() => { const c = freshFromCache(file); return c ? { file, cues: c } : null; })() : null
  );
  const [attempt, setAttempt] = useState(0);
  const [prevFile, setPrevFile] = useState(file);
  if (prevFile !== file) {
    // Adjust state during render on prop change (React-documented pattern)
    setPrevFile(file);
    setAttempt(0);
    const c = file ? freshFromCache(file) : null;
    setLoaded(c ? { file, cues: c } : null);
  }

  useEffect(() => {
    if (loaded?.file === file) return; // already fetched (cues may be empty = none exist)
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    fetch(`/api/subtitle/${movieId}?token=${token}&file=${encodeURIComponent(file)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => {
        const cues = parseVtt(raw);
        cueCache.set(file, { at: Date.now(), cues });
        setLoaded({ file, cues });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return; // unmounted / file switched — stay silent
        if (attempt + 1 < MAX_ATTEMPTS && isRetryable(err)) {
          timer = setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
        }
        // Otherwise: give up quietly (loaded stays null → renders nothing)
      });
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [movieId, token, file, attempt, loaded?.file]);

  const cue = loaded?.file === file ? loaded.cues.find((c) => currentTime >= c.start && currentTime <= c.end) ?? null : null;
  if (!cue) return null;

  return (
    <div
      className={`absolute left-0 right-0 z-[18] flex justify-center px-4 pointer-events-none transition-all duration-300 ${controlsVisible ? "bottom-24" : "bottom-8"}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <span
        className="whitespace-pre-line text-center max-w-[85%] bg-black/80 rounded-lg px-3.5 py-1.5 text-white text-sm sm:text-base leading-relaxed shadow-lg"
        style={{ fontFamily: '"Myanmar Angoun", "Noto Sans Myanmar", "Padauk", sans-serif' }}
      >
        {cue.text}
      </span>
    </div>
  );
}
