// YouTube IFrame Player API adapter (§3.1) — official YouTube player.
//
// https://developers.google.com/youtube/iframe_api_reference
//
// Compliance notes (§3.1): we never fake an audio-only YouTube player and
// never obscure required controls/branding. The host element is sized by
// `music-player-host.tsx` to at least 200×200 while media is loaded so the
// required visible viewport is preserved. "YouTube Music" links are played
// through this same official API — there is no separate first-party YT Music
// web playback SDK.
//
// The SDK script is loaded exactly once, lazily, on the first `load()` call.
// The global `onYouTubeIframeAPIReady` callback promise is deduplicated
// across adapter instances. Listeners are removed on teardown; the host
// element itself is owned by `music-player-host.tsx` and never removed here.

"use client";

import type {
  MusicCapabilities,
  MusicListener,
  MusicProviderAdapter,
  MusicRef,
  MusicSnapshot,
} from "./types";
import { parseMusicUrl } from "./url";

interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayer;
}

interface YouTubeVideoData {
  title?: string;
  author?: string;
  video_id?: string;
}

interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void; // 0..100
  getVolume(): number;
  mute(): void;
  unMute(): void;
  nextVideo(): void;
  previousVideo(): void;
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  loadPlaylist(options: { list: string; listType: "playlist" }): void;
  cuePlaylist(options: { list: string; listType: "playlist" }): void;
  getCurrentTime(): number; // seconds
  getDuration(): number; // seconds
  getPlayerState(): number;
  getVideoData(): YouTubeVideoData;
  getVideoUrl(): string;
  destroy(): void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: YouTubePlayerEvent) => void;
        onStateChange?: (e: YouTubePlayerEvent) => void;
        onError?: (e: { data: number; target: YouTubePlayer }) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_SRC = "https://www.youtube.com/iframe_api";

let apiPromise: Promise<YouTubeNamespace> | null = null;

function loadApi(): Promise<YouTubeNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error("youtube-sdk-incomplete"));
    };
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("youtube-sdk-blocked"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

const CAPABILITIES: MusicCapabilities = {
  play: true,
  pause: true,
  seek: true,
  volume: true,
  next: true, // playlist navigation
  previous: true,
};

/** YouTube requires a visible player viewport of at least 200×200 when
 * video is shown (§3.1). The host element is sized to match. */
export const YOUTUBE_MIN_HOST_SIZE = { width: 320, height: 200 } as const;

export class YouTubeIframeAdapter implements MusicProviderAdapter {
  readonly provider = "youtube" as const;
  readonly capabilities = CAPABILITIES;

  private listeners = new Set<MusicListener>();
  private player: YouTubePlayer | null = null;
  private host: HTMLElement | null = null;
  private mountEl: HTMLElement | null = null;
  private snapshot: MusicSnapshot = { state: "idle", ref: null, track: null };
  private destroyed = false;
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  canHandle(url: string): boolean {
    return parseMusicUrl(url)?.provider === "youtube";
  }

  normalize(url: string): MusicRef | null {
    const ref = parseMusicUrl(url);
    return ref?.provider === "youtube" ? ref : null;
  }

  attach(host: HTMLElement) {
    this.host = host;
  }

  async load(ref: MusicRef): Promise<void> {
    this.destroyed = false;
    this.emit({ state: "loading", ref, track: null, positionMs: 0 });
    let YT: YouTubeNamespace;
    try {
      YT = await loadApi();
    } catch {
      this.emit({ state: "error", ref, track: null, reason: "sdk-blocked" });
      throw new Error("sdk-blocked");
    }
    if (this.destroyed || !this.host) return;

    if (this.player) {
      // Reuse the live player instance — never remount the iframe.
      try {
        if (ref.kind === "playlist") {
          this.player.loadPlaylist({ list: ref.id, listType: "playlist" });
        } else {
          this.player.loadVideoById(ref.id);
        }
      } catch {
        this.emit({ state: "error", ref, track: null, reason: "load-failed" });
      }
      return;
    }

    // Wrap in a stable child so the SDK's iframe swap never removes OUR host.
    if (!this.mountEl) {
      this.mountEl = document.createElement("div");
      this.host.appendChild(this.mountEl);
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.snapshot.state === "loading") {
          this.emit({ state: "blocked", ref, track: null, reason: "embed-timeout" });
          reject(new Error("embed-timeout"));
        }
      }, 15000);

      const playerVars: Record<string, string | number> = {
        rel: 0,
        playsinline: 1,
        // No autoplay — §3.1 requires an explicit user gesture to start.
        autoplay: 0,
      };
      const options: ConstructorParameters<YouTubeNamespace["Player"]>[1] = {
        width: "100%",
        height: "100%",
        playerVars,
        events: {
          onReady: () => {
            clearTimeout(timeout);
            if (this.destroyed) return;
            this.emit({ state: "ready", ref, track: this.readTrack(), positionMs: 0 });
            resolve();
          },
          onStateChange: (e) => this.onStateChange(e),
          onError: (e) => {
            clearTimeout(timeout);
            // 100/101/150 = not found / embedding disabled.
            const reason =
              e.data === 101 || e.data === 150
                ? "embedding-disabled"
                : e.data === 100
                  ? "not-found"
                  : "player-error";
            this.emit({ state: "error", ref, track: null, reason });
            reject(new Error(reason));
          },
        },
      };
      if (ref.kind === "playlist") {
        playerVars.listType = "playlist";
        playerVars.list = ref.id;
      } else {
        options.videoId = ref.id;
      }
      this.player = new YT.Player(this.mountEl as HTMLElement, options);
    });
  }

  private readTrack() {
    if (!this.player) return null;
    try {
      const data = this.player.getVideoData();
      const duration = this.player.getDuration();
      return {
        title: data?.title || undefined,
        creator: data?.author || undefined,
        // YouTube exposes no artwork URL via the IFrame API; the standard
        // thumbnail endpoint is public and provider-served (not scraped).
        artworkUrl: data?.video_id
          ? `https://i.ytimg.com/vi/${data.video_id}/default.jpg`
          : undefined,
        durationMs: duration > 0 ? Math.round(duration * 1000) : undefined,
      };
    } catch {
      return null;
    }
  }

  private onStateChange(e: YouTubePlayerEvent) {
    if (this.destroyed) return;
    const YT = window.YT;
    if (!YT) return;
    const S = YT.PlayerState;
    let state: MusicSnapshot["state"];
    switch (e.data) {
      case S.PLAYING:
        state = "playing";
        break;
      case S.PAUSED:
        state = "paused";
        break;
      case S.BUFFERING:
        state = "buffering";
        break;
      case S.ENDED:
        state = "ended";
        break;
      case S.CUED:
      case S.UNSTARTED:
      default:
        state = "ready";
        break;
    }
    this.emit({
      state,
      ref: this.snapshot.ref,
      track: this.readTrack() ?? this.snapshot.track,
      positionMs: state === "ended" ? this.snapshot.track?.durationMs : undefined,
    });
    this.syncProgressTimer(state);
  }

  /** Provider events don't stream position; interpolate at a modest cadence
   *  while playing only (§3.1: avoid permanent polling). */
  private syncProgressTimer(state: MusicSnapshot["state"]) {
    if (state === "playing" && !this.progressTimer) {
      this.progressTimer = setInterval(() => {
        if (!this.player || this.destroyed) return;
        try {
          this.emit({
            state: this.snapshot.state,
            ref: this.snapshot.ref,
            track: this.snapshot.track,
            positionMs: Math.round(this.player.getCurrentTime() * 1000),
          });
        } catch {
          /* player mid-teardown */
        }
      }, 1000);
    } else if (state !== "playing" && this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private emit(partial: Partial<MusicSnapshot> & { state: MusicSnapshot["state"] }) {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const l of this.listeners) l(this.snapshot);
  }

  play() {
    try {
      this.player?.playVideo();
    } catch {
      /* not ready */
    }
  }
  pause() {
    try {
      this.player?.pauseVideo();
    } catch {
      /* not ready */
    }
  }
  seek(positionMs: number) {
    try {
      this.player?.seekTo(positionMs / 1000, true);
    } catch {
      /* not ready */
    }
  }
  setVolume(volume: number) {
    try {
      this.player?.setVolume(Math.round(volume * 100));
    } catch {
      /* not ready */
    }
  }
  next() {
    try {
      this.player?.nextVideo();
    } catch {
      /* not ready */
    }
  }
  previous() {
    try {
      this.player?.previousVideo();
    } catch {
      /* not ready */
    }
  }

  subscribe(listener: MusicListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    try {
      this.player?.destroy();
    } catch {
      /* teardown must never throw */
    }
    this.player = null;
  }
}

export function createYouTubeIframeAdapter(host: HTMLElement) {
  const adapter = new YouTubeIframeAdapter();
  adapter.attach(host);
  return adapter;
}
