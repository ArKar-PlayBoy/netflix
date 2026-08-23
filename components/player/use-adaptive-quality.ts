"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export const QUALITY_LADDER = ["480p", "720p", "1080p", "4K"];

/**
 * Adaptive quality (Auto mode only): watches buffer health every 5s.
 * Struggling (<6s buffered ahead) → drop a level; healthy (>25s ahead twice
 * in a row) → try upgrading. Never flaps faster than once per 8s.
 * Extracted verbatim from movie-player.tsx (mechanical move, same behavior).
 */
export function useAdaptiveQuality(opts: {
  /** showModal && hasLocalVideo */
  active: boolean;
  /** true while currentQuality === "auto" */
  autoMode: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** resolved auto tier, e.g. "1080p" */
  autoQuality: string;
  /** component-side: performs the switch, keeps currentQuality at "auto" */
  onAutoSwitch: (next: string) => void;
}) {
  const lastSwitchRef = useRef(0);
  const stableChecksRef = useRef(0);

  useEffect(() => {
    if (!opts.active || !opts.autoMode) return;

    const id = setInterval(() => {
      const v = opts.videoRef.current;
      if (!v || v.paused || !v.duration) return;

      let ahead = 0;
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) >= v.currentTime) {
          ahead = v.buffered.end(i) - v.currentTime;
          break;
        }
      }

      const now = Date.now();
      if (now - lastSwitchRef.current < 8000) return; // no flapping

      const idx = QUALITY_LADDER.indexOf(opts.autoQuality);
      if (idx === -1) return;

      // Struggling: less than 6s ahead → drop a level
      if (ahead < 6 && idx > 0) {
        opts.onAutoSwitch(QUALITY_LADDER[idx - 1]);
        lastSwitchRef.current = now;
        stableChecksRef.current = 0;
        return;
      }

      // Healthy: 25s+ ahead twice in a row → try upgrading
      if (ahead > 25 && idx < QUALITY_LADDER.length - 1) {
        stableChecksRef.current++;
        if (stableChecksRef.current >= 2) {
          opts.onAutoSwitch(QUALITY_LADDER[idx + 1]);
          lastSwitchRef.current = now;
          stableChecksRef.current = 0;
        }
      } else {
        stableChecksRef.current = 0;
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.active, opts.autoMode, opts.autoQuality]);
}
