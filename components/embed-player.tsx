"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Play, X } from "lucide-react";
import { useFullscreen } from "@/components/player/use-fullscreen";

/**
 * External multi-server embed playback.
 * - Servers come from admin settings (max 4), resolved per-title by the view loader.
 * - Auto mode probes every provider in parallel FROM THE VIEWER'S BROWSER
 *   (server-side probes can't see the user's ISP blocks) and plays the first
 *   reachable one; the winner is cached ~10 min so replays open instantly.
 * - Isolated from movie-player.tsx on purpose: cross-origin iframes can't
 *   support our custom controls / progress / subtitles.
 * - No `sandbox` attribute on purpose: providers detect frameElement.sandbox
 *   ("Sandboxing is not allowed!") and refuse to play while sandboxed.
 * - Chrome (close, chips) auto-hides after 4s idle. Server chips are the
 *   recovery path when a provider serves a dead stream — tap another server.
 */

type NamedServer = { name: string; url: string };

const CACHE_KEY = "vionix-embed-server";
const CACHE_TTL_MS = 10 * 60 * 1000;
const PROBE_TIMEOUT_MS = 4000;
const CHROME_HIDE_MS = 4000;

function readCachedWinnerIndex(servers: NamedServer[]): number {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return -1;
    const c = JSON.parse(raw) as { url?: string; ts?: number };
    if (!c?.url || typeof c.ts !== "number" || Date.now() - c.ts > CACHE_TTL_MS) return -1;
    return servers.findIndex((s) => s.url === c.url);
  } catch {
    return -1;
  }
}

/** Resolves true when the URL is reachable from this browser; opaque responses count */
function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      ctl.abort();
      resolve(false);
    }, PROBE_TIMEOUT_MS);
    fetch(url, { mode: "no-cors", signal: ctl.signal })
      .then(() => {
        clearTimeout(timer);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

export default function EmbedPlayer({
  servers,
  title,
}: {
  servers: NamedServer[];
  title: string;
}) {
  const [showModal, setShowModal] = useState(false);
  // -1 = probing / auto pending; >=0 = active server index
  const [activeIdx, setActiveIdx] = useState(-1);
  const [probing, setProbing] = useState(false);
  const [allDead, setAllDead] = useState(false);
  const [manualPick, setManualPick] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(() => containerRef.current);

  const runAutoSelect = useCallback(async () => {
    setProbing(true);
    setAllDead(false);
    const results = await Promise.all(servers.map((s) => probe(s.url)));
    const winner = results.findIndex((ok) => ok);
    if (winner >= 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ url: servers[winner].url, ts: Date.now() }));
      } catch {}
      setActiveIdx(winner);
    } else {
      setAllDead(true);
      setActiveIdx(0);
    }
    setProbing(false);
  }, [servers]);

  const openModal = useCallback(() => {
    setShowModal(true);
    setChromeVisible(true);
    document.body.style.overflow = "hidden";
    if (activeIdx < 0 && !probing && !allDead) {
      const cached = readCachedWinnerIndex(servers);
      if (cached >= 0) setActiveIdx(cached);
      else runAutoSelect();
    }
  }, [activeIdx, probing, allDead, servers, runAutoSelect]);

  const closeModal = useCallback(() => {
    fs.exit();
    setShowModal(false);
    document.body.style.overflow = "";
  }, [fs]);

  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (!showModal || document.fullscreenElement) return;
      if (e.key === "Escape") {
        if (fs.fakeFs) fs.exit();
        else closeModal();
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [showModal, closeModal, fs]);

  // Chrome auto-hide: only while playback is up and there's no status message
  const statusVisible = probing || allDead;
  useEffect(() => {
    if (!showModal) return;
    if (chromeVisible && activeIdx >= 0 && !statusVisible) {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS);
    }
    return () => {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    };
  }, [showModal, chromeVisible, activeIdx, statusVisible]);

  const bumpChrome = useCallback(() => {
    setChromeVisible(true);
  }, []);

  const pickServer = (i: number) => {
    setManualPick(true);
    setActiveIdx(i);
    setReloadNonce((n) => n + 1);
    bumpChrome();
  };

  const activeServer = activeIdx >= 0 ? servers[activeIdx] : null;
  const chromeCls = `transition-opacity duration-300 ${chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`;

  return (
    <>
      <button
        onClick={openModal}
        className="group inline-flex items-center gap-2.5 px-7 py-3 bg-netflix hover:bg-netflix-hover text-white rounded-xl font-semibold transition-all duration-200 text-base shadow-lg shadow-netflix/25 hover:shadow-netflix/40 active:scale-[0.98]"
      >
        <Play className="h-5 w-5 fill-current group-hover:scale-110 transition-transform" />
        Watch Now
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-[200] bg-black sm:bg-black/95 sm:flex sm:items-center sm:justify-center sm:p-4"
          onClick={closeModal}
          onMouseMove={bumpChrome}
          onPointerDown={bumpChrome}
          onTouchStart={bumpChrome}
        >
          <div
            ref={containerRef}
            className={
              fs.isActive
                ? "fixed inset-0 z-[300] bg-black"
                : "relative w-full aspect-video h-full sm:h-auto sm:max-w-5xl bg-black sm:rounded-lg overflow-hidden shadow-2xl"
            }
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar — close only (provider owns fullscreen, below) */}
            <div
              className={`absolute top-0 right-0 z-30 flex items-center gap-2 p-3 transition-opacity duration-300 ${chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <button onClick={closeModal} className="p-1.5 bg-white/20 rounded-full text-white hover:bg-white/30 transition pointer-events-auto">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Server chips — centered, clear of notch */}
            <div
              className={`absolute left-0 right-0 z-20 flex items-center justify-center gap-1.5 flex-wrap px-4 ${chromeCls}`}
              style={{ top: "calc(3rem + env(safe-area-inset-top))" }}
            >
              {!manualPick && !allDead && activeIdx >= 0 && (
                <button
                  onClick={() => { setManualPick(false); runAutoSelect(); }}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-netflix text-white pointer-events-auto"
                >
                  Auto
                </button>
              )}
              {servers.map((s, i) => (
                <button
                  key={s.url}
                  onClick={() => pickServer(i)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-sm border transition pointer-events-auto ${
                    i === activeIdx && (manualPick || allDead)
                      ? "bg-netflix text-white border-netflix"
                      : "bg-black/50 text-white/80 border-white/10 hover:bg-black/80"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {/* Probing state */}
            {probing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-netflix animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
                <p className="text-white/70 text-sm">Finding the fastest server…</p>
              </div>
            )}

            {/* Player */}
            {!probing && activeServer && (
              <iframe
                key={`${activeIdx}-${reloadNonce}`}
                src={activeServer.url}
                title={title}
                className="w-full h-full"
                referrerPolicy="no-referrer"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            )}

            {/*
              Fullscreen click-forwarder: the provider's own fullscreen icon
              (bottom-right of their control bar) is dead — cross-origin frames
              can't fullscreen the top page and we can't patch their code.
              This INVISIBLE overlay sits over that icon and forwards taps to
              our fullscreen (which fullscreens our container). Result: one
              visible icon (theirs), and it works. If they redesign their
              control bar, adjust this single div.
            */}
            {!probing && activeServer && (
              <div
                onClick={fs.toggle}
                title="Fullscreen"
                aria-label="Fullscreen"
                className="absolute bottom-0 right-0 w-16 h-12 cursor-pointer pointer-events-auto z-10"
              />
            )}

            {/* All providers unreachable from this network */}
            {!probing && allDead && (
              <div className="absolute bottom-16 left-0 right-0 z-20 flex justify-center px-4">
                <div className="px-4 py-2 rounded-lg bg-black/80 border border-white/10 text-white/90 text-xs backdrop-blur-sm text-center">
                  All servers unreachable from your connection ·{" "}
                  <button onClick={() => runAutoSelect()} className="underline hover:text-white">Retry</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
