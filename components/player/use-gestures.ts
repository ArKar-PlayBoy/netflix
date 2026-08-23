"use client";

import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * Mobile/desktop playback gestures: hold-for-2x speed, double-tap side seek
 * with ripple, single-tap control toggling. Extracted verbatim from
 * movie-player.tsx (mechanical move, same behavior).
 */
export function usePlayerGestures(opts: {
  videoRef: RefObject<HTMLVideoElement | null>;
  seekBy: (delta: number) => void;
  togglePlay: () => void;
  showControls: () => void;
  hideControls: () => void;
  controlsVisible: boolean;
  speed: number;
}) {
  const { videoRef, seekBy, togglePlay, showControls, hideControls, controlsVisible, speed } = opts;

  const [longPress2x, setLongPress2x] = useState(false);
  const [seekRipple, setSeekRipple] = useState<{ side: "l" | "r"; id: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActiveRef = useRef(false);
  const suppressTapRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const startLongPress = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };
      longPressTimerRef.current = setTimeout(() => {
        const v = videoRef.current;
        if (v && !v.paused) {
          v.playbackRate = 2;
          longPressActiveRef.current = true;
          setLongPress2x(true);
        }
      }, 450);
    },
    [videoRef]
  );

  const cancelLongPress = useCallback((e?: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Moved finger = not a hold
    if (e && touchStartRef.current) {
      const t = e.touches[0];
      if (Math.abs(t.clientX - touchStartRef.current.x) > 12 || Math.abs(t.clientY - touchStartRef.current.y) > 12) {
        if (!longPressActiveRef.current) {
          longPressTimerRef.current = null;
        }
      }
    }
  }, []);

  const endLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressActiveRef.current) {
      const v = videoRef.current;
      if (v) v.playbackRate = speed;
      longPressActiveRef.current = false;
      setLongPress2x(false);
      suppressTapRef.current = true;
      setTimeout(() => {
        suppressTapRef.current = false;
      }, 350);
    }
  }, [videoRef, speed]);

  const handleSurfaceTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
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
            // Mobile pattern: tap toggles control visibility.
            // Desktop keeps click = play/pause.
            const canHover =
              typeof window !== "undefined" &&
              window.matchMedia("(hover: hover)").matches;

            if (!controlsVisible) {
              showControls();
            } else if (canHover) {
              togglePlay();
            } else {
              hideControls();
            }
            lastTapRef.current = null;
          }
        }, 300);
      }
    },
    [controlsVisible, seekBy, showControls, hideControls, togglePlay]
  );

  /** True when the just-finished long press should swallow the following click/tap */
  const consumeSuppressedTap = useCallback((): boolean => suppressTapRef.current, []);

  /** Pointer-down cancels any pending double-tap window */
  const resetDoubleTap = useCallback(() => {
    lastTapRef.current = null;
  }, []);

  return { longPress2x, seekRipple, startLongPress, cancelLongPress, endLongPress, handleSurfaceTap, consumeSuppressedTap, resetDoubleTap };
}
