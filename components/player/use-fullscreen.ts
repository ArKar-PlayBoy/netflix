"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

/**
 * Fullscreen for player containers, one implementation for every player.
 * - Native Fullscreen API with webkit fallbacks (older Safari / iPadOS)
 * - iOS iPhone lacks element fullscreen entirely → "fake" mode: the container
 *   is styled fixed inset-0 by the caller using the returned fakeFs flag
 * - State stays in sync when the user exits via Esc / gestures
 */
export function useFullscreen(getEl: () => HTMLElement | null) {
  const [isNativeFs, setIsNativeFs] = useState(false);
  const [fakeFs, setFakeFs] = useState(false);
  const getElRef = useRef(getEl);
  useEffect(() => {
    getElRef.current = getEl;
  });

  const isActive = isNativeFs || fakeFs;

  useEffect(() => {
    const sync = () => {
      const doc = document as FullscreenDocument;
      setIsNativeFs(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const doc = document as FullscreenDocument;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
      else doc.webkitExitFullscreen?.();
      return;
    }
    if (fakeFs) {
      setFakeFs(false);
      return;
    }
    const el = getElRef.current();
    if (!el) return;
    const fe = el as FullscreenElement;
    const request = fe.requestFullscreen?.bind(el) ?? fe.webkitRequestFullscreen?.bind(el);
    if (request) request().catch(() => setFakeFs(true));
    else setFakeFs(true);
  }, [fakeFs]);

  /** Always-safe exit — used when closing the player mid-fullscreen */
  const exit = useCallback(() => {
    const doc = document as FullscreenDocument;
    if (fakeFs) {
      setFakeFs(false);
      return;
    }
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
      else doc.webkitExitFullscreen?.();
    }
  }, [fakeFs]);

  return { isActive, fakeFs, toggle, exit };
}
