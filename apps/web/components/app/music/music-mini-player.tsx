"use client";

// Dynamic Island mini-player (§3.1 #4, M1.7.1b).
//
// A compact, rounded transport that appears whenever media is loaded. It is
// a PURE control surface over the shared Zustand store — it never mounts,
// moves or clones the provider iframe (the stable `MusicPlayerHost` slots in
// the shell remain the only host; the active YouTube slot IS the compliant
// ≥200×200 visible mini-card, and it never unmounts).
//
// Two placements, one component:
//   - Topbar pill (`placement="topbar"`) on wide screens, between search and
//     the right-hand controls. Collapses title before hiding transport.
//   - Mobile bottom pill (`placement="mobile"`) above the safe area.
//
// Interaction: idle shows artwork + title + provider + play/pause. Hover /
// focus-within / tap expands to reveal prev/next, a seek bar, volume,
// "Open widget", "Open in provider", a focus-pause preference toggle and
// "Dismiss". Expansion uses Framer Motion layout morphing (transform +
// opacity only, ≤250ms, --ease-standard); with `prefers-reduced-motion` it
// degrades to a short crossfade (no morph).
//
// Media Session: best-effort metadata + play/pause/previoustrack/nexttrack
// handlers, guarded — when an embedded player owns media-session behavior we
// simply don't register (graceful fallback, §3.1 #6).
//
// Focus timer preference: `Start Focus Timer` companion (opens the pomodoro
// widget) plus an opt-in "pause music on focus" toggle. Default is OFF and
// the UI never pauses music on its own initiative — §3.1 #7.

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ExternalLink,
  Maximize2,
  X,
  Timer,
  Music,
} from "lucide-react";
import { useMusicStore } from "@/lib/music/store";
import type { MusicRef } from "@/lib/music/types";
import { usePersistedState } from "@/hooks/use-sidebar-prefs";
import { cn } from "@/lib/utils";

const PROVIDER_BADGE: Record<MusicRef["provider"], string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
};

const SPRING = { duration: 0.22, ease: [0.16, 1, 0.3, 1] } as const;

function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function MusicMiniPlayer({ placement }: { placement: "topbar" | "mobile" }) {
  const t = useTranslations("music");
  const reduceMotion = useReducedMotion();
  const {
    status,
    track,
    queue,
    currentIndex,
    volume,
    positionMs,
    togglePlay,
    seekTo,
    setVolume,
    nextTrack,
    previousTrack,
    dismiss,
  } = useMusicStore();

  const [focusPause, setFocusPause] = usePersistedState<boolean>(
    "bureau-music-pause-on-focus",
    false,
  );

  const current = currentIndex >= 0 ? queue[currentIndex] : null;
  const playable = status === "playing" || status === "buffering";
  const durationMs = track?.durationMs ?? 0;
  const canSeek = durationMs > 0;
  const hasMedia = current !== null && status !== "idle";
  const isYouTube = current?.ref.provider === "youtube";

  // ── Media Session (best-effort, §3.1 #6). Guard every call: embedded
  // players (esp. YouTube) may own hardware-key handling — when the API is
  // absent or throws we silently fall back to in-app transport only.
  useEffect(() => {
    if (!hasMedia || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track?.title ?? current.ref.id,
        artist: track?.creator ?? PROVIDER_BADGE[current.ref.provider],
        album: PROVIDER_BADGE[current.ref.provider],
        artwork: track?.artworkUrl ? [{ src: track.artworkUrl, sizes: "256x256", type: "image/jpeg" }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => togglePlay());
      navigator.mediaSession.setActionHandler("pause", () => togglePlay());
      navigator.mediaSession.setActionHandler("previoustrack", () => previousTrack());
      navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack());
    } catch {
      /* embedded player may own the session — fall back gracefully (§3.1) */
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMedia, current?.ref.url, track?.title, track?.creator, track?.artworkUrl]);

  // ── Focus-timer opt-in (§3.1 #7). Only ever pauses when the user enabled
  // the preference AND a focus timer actually starts. Default off: no
  // surprise pauses. The pomodoro widget dispatches this event when a focus
  // session begins; nothing else triggers it.
  const focusPauseRef = useRef(focusPause);
  focusPauseRef.current = focusPause;
  const pauseRef = useRef(playable);
  pauseRef.current = playable;
  useEffect(() => {
    const onFocusStart = () => {
      if (focusPauseRef.current && pauseRef.current) togglePlay();
    };
    window.addEventListener("bureau:pomodoro-focus-start", onFocusStart);
    return () => window.removeEventListener("bureau:pomodoro-focus-start", onFocusStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // YouTube compliance note (§3.1 #4): when YouTube is the active provider,
  // its ≥200×200 visible mini-card (the docked host slot) stays on-screen;
  // this island never pretends to be an audio-only YouTube player.

  const artwork = track?.artworkUrl;
  const title = track?.title ?? current?.ref.id ?? "";
  const provider = current ? PROVIDER_BADGE[current.ref.provider] : "";

  const openWidget = () => {
    window.dispatchEvent(new CustomEvent("bureau:open-widget:music"));
  };

  const island = (
    <motion.div
      layout={!reduceMotion}
      transition={reduceMotion ? { duration: 0.12 } : SPRING}
      data-testid={`music-mini-player-${placement}`}
      data-provider={current?.ref.provider}
      className={cn(
        "group pointer-events-auto flex flex-col overflow-hidden rounded-full border border-border bg-card text-card-foreground shadow-[var(--elev-3)]",
        placement === "mobile" && "w-[calc(100vw-2rem)] max-w-sm",
      )}
    >
      {/* Idle row — artwork, title, provider, play/pause (+ dismiss on hover). */}
      <div className="flex h-11 items-center gap-2 pl-1.5 pr-1.5">
        <button
          type="button"
          data-testid="music-mini-toggle-play"
          aria-label={playable ? t("pause") : t("play")}
          onClick={togglePlay}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {playable ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {artwork ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artwork} alt="" width={28} height={28} loading="lazy" className="size-full object-cover" aria-hidden />
          ) : (
            <Music size={14} className="text-muted-foreground" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium leading-tight text-foreground" data-testid="music-mini-title">
            {title}
          </p>
          <p className="truncate text-[10px] leading-tight text-muted-foreground" data-testid="music-mini-sub">
            {track?.creator ? `${track.creator} · ` : ""}
            <span className="tx-pill">{provider}</span>
            {isYouTube && ` · ${t("videoPlaying")}`}
          </p>
        </div>
        <button
          type="button"
          data-testid="music-mini-close"
          aria-label={t("dismiss")}
          title={t("dismiss")}
          onClick={dismiss}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      </div>

      {/* Expanded controls — revealed on hover / focus-within (desktop) and
          always present but clipped on mobile until tapped open. Rendered in
          the DOM so keyboard/SR users always reach them; visually clipped
          until the island expands. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]",
        )}
        data-testid="music-mini-expanded"
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-2 px-3 pb-2.5 pt-1">
            {canSeek && (
              <div className="flex items-center gap-2" data-testid="music-mini-progress">
                <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{fmt(positionMs)}</span>
                <input
                  type="range"
                  min={0}
                  max={durationMs}
                  step={1000}
                  value={Math.min(positionMs, durationMs)}
                  aria-label={t("seek")}
                  aria-valuemax={durationMs}
                  aria-valuenow={Math.round(positionMs)}
                  data-testid="music-mini-progress-slider"
                  onChange={(e) => seekTo(Number(e.target.value))}
                  className="h-1 min-w-0 flex-1 accent-primary"
                />
                <span className="w-8 shrink-0 text-[10px] tabular-nums text-muted-foreground">{fmt(durationMs)}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="music-mini-prev"
                aria-label={t("previous")}
                title={t("previous")}
                onClick={previousTrack}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
              >
                <SkipBack size={15} />
              </button>
              <button
                type="button"
                data-testid="music-mini-next"
                aria-label={t("next")}
                title={t("next")}
                onClick={nextTrack}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
              >
                <SkipForward size={15} />
              </button>
              <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5">
                {volume === 0 ? (
                  <VolumeX size={13} className="shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <Volume2 size={13} className="shrink-0 text-muted-foreground" aria-hidden />
                )}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  aria-label={t("volume")}
                  aria-valuetext={`${Math.round(volume * 100)}%`}
                  data-testid="music-mini-volume-slider"
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="h-1 min-w-0 flex-1 accent-primary"
                />
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="music-mini-focus-timer"
                aria-label={t("startFocusTimer")}
                title={t("startFocusTimer")}
                onClick={() => window.dispatchEvent(new CustomEvent("bureau:open-widget:pomodoro"))}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
              >
                <Timer size={15} />
              </button>
              <button
                type="button"
                data-testid="music-mini-focus-pause"
                aria-label={t("pauseOnFocus")}
                title={t("pauseOnFocus")}
                aria-pressed={focusPause}
                onClick={() => setFocusPause((v) => !v)}
                className={cn(
                  "flex h-8 items-center rounded-full px-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  focusPause ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t("pauseOnFocus")}
              </button>
              <span className="flex-1" />
              <button
                type="button"
                data-testid="music-mini-open-widget"
                aria-label={t("openWidget")}
                title={t("openWidget")}
                onClick={openWidget}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
              >
                <Maximize2 size={15} />
              </button>
              {current && (
                <a
                  href={current.ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="music-mini-open-provider"
                  aria-label={t("openInProvider")}
                  title={t("openInProvider")}
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
                >
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence initial={false}>
      {hasMedia && (
        <motion.div
          key="music-island"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: placement === "mobile" ? 16 : -8 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          transition={reduceMotion ? { duration: 0.12 } : SPRING}
          className={cn(
            placement === "mobile" &&
              "pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center pb-[env(safe-area-inset-bottom,0px)] md:hidden",
          )}
        >
          {island}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
