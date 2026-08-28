"use client";

// Singleton music player host (§3.1 #5 — persistent playback).
//
// Mounted ONCE in `app/app/layout.tsx`, outside `renderWidget()`. It owns
// one stable DOM element per provider; adapters attach their official
// player iframe/SDK into those elements on first use. Because this host
// lives above the router, dock/float/route changes can NEVER remount the
// active player — the widget and (later) mini-player are pure control
// surfaces over the shared Zustand store.
//
// Visibility & provider compliance:
// - Spotify's embed renders its own visible 152px player iframe (attribution
//   + provider controls stay intact).
// - YouTube requires a visible ≥200×200 viewport while video plays (§3.1) —
//   the host enforces `min-height: 200px` on the YouTube slot. We never
//   shrink YouTube into an audio-only pill; Phase 3's compact mode either
//   shows a compliant mini-video card or pauses.
// - SoundCloud renders the official widget (166px tracks / 300px sets).
//
// Only the ACTIVE provider slot is shown (`empty:hidden` hides the rest);
// slots are never unmounted, so switching providers pauses but preserves
// each player for instant resume (single audio focus, §3.1 #6).

import { useEffect, useRef } from "react";
import { registerMusicAdapter, useMusicStore } from "@/lib/music/store";
import { createSpotifyEmbedAdapter } from "@/lib/music/spotify-embed-adapter";
import { createYouTubeIframeAdapter } from "@/lib/music/youtube-iframe-adapter";
import { createSoundCloudWidgetAdapter } from "@/lib/music/soundcloud-widget-adapter";
import { cn } from "@/lib/utils";

// ── Stable per-provider host elements ────────────────────────────────────
// The elements are created once, outside React's render lifecycle, so an
// adapter's iframe is never torn down by reconciliation.
const hostElements = new Map<string, HTMLElement>();

export function getMusicHostElement(provider: string): HTMLElement | null {
  return hostElements.get(provider) ?? null;
}

export function MusicPlayerHost() {
  const spotifyRef = useRef<HTMLDivElement>(null);
  const youtubeRef = useRef<HTMLDivElement>(null);
  const soundcloudRef = useRef<HTMLDivElement>(null);

  const currentProvider = useMusicStore((s) =>
    s.currentIndex >= 0 ? s.queue[s.currentIndex]?.ref.provider : null,
  );

  useEffect(() => {
    const spotify = spotifyRef.current;
    const youtube = youtubeRef.current;
    const soundcloud = soundcloudRef.current;
    if (!spotify || !youtube || !soundcloud) return;
    hostElements.set("spotify", spotify);
    hostElements.set("youtube", youtube);
    hostElements.set("soundcloud", soundcloud);
    // The adapter modules ship with the host bundle (small), but each remote
    // SDK <script> only loads inside its adapter on first `load()` — the
    // initial app bundle stays free of provider SDKs (§3.1).
    registerMusicAdapter("spotify", () => createSpotifyEmbedAdapter(spotify));
    registerMusicAdapter("youtube", () => createYouTubeIframeAdapter(youtube));
    registerMusicAdapter("soundcloud", () =>
      createSoundCloudWidgetAdapter(soundcloud),
    );
    return () => {
      hostElements.delete("spotify");
      hostElements.delete("youtube");
      hostElements.delete("soundcloud");
    };
  }, []);

  return (
    <div
      data-testid="music-player-host"
      className="pointer-events-none fixed bottom-4 left-4 z-40 w-[320px] max-w-[calc(100vw-2rem)]"
    >
      <div
        ref={spotifyRef}
        data-testid="music-host-spotify"
        data-active={currentProvider === "spotify" || undefined}
        className={cn(
          "pointer-events-auto overflow-hidden rounded-[var(--radius)] bg-card empty:hidden",
          currentProvider !== "spotify" && "[&:not(:empty)]:hidden",
        )}
      />
      <div
        ref={youtubeRef}
        data-testid="music-host-youtube"
        data-active={currentProvider === "youtube" || undefined}
        // YouTube: required visible viewport ≥200×200 while media is loaded.
        className={cn(
          "pointer-events-auto overflow-hidden rounded-[var(--radius)] bg-card empty:hidden [&:not(:empty)]:min-h-[200px] [&:not(:empty)]:w-full [&_iframe]:h-full [&_iframe]:min-h-[200px] [&_iframe]:w-full",
          currentProvider !== "youtube" && "[&:not(:empty)]:hidden",
        )}
      />
      <div
        ref={soundcloudRef}
        data-testid="music-host-soundcloud"
        data-active={currentProvider === "soundcloud" || undefined}
        className={cn(
          "pointer-events-auto overflow-hidden rounded-[var(--radius)] bg-card empty:hidden",
          currentProvider !== "soundcloud" && "[&:not(:empty)]:hidden",
        )}
      />
    </div>
  );
}
