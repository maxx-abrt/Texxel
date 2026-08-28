// Spotify Embed adapter (§3.1) — official Spotify iFrame API.
//
// https://developer.spotify.com/documentation/embeds/references/iframe-api
//
// The SDK script is loaded exactly once, lazily, on the first `load()` call
// (never in the initial bundle). The global `onSpotifyIframeApiReady`
// callback promise is deduplicated across adapter instances. All embed
// capability choices (play/pause availability, previews, login,
// attribution) remain Spotify-controlled — we render the official player
// and mirror its events into the normalized contract.

"use client";

import type {
  MusicCapabilities,
  MusicListener,
  MusicProviderAdapter,
  MusicRef,
  MusicSnapshot,
} from "./types";
import { parseMusicUrl } from "./url";

interface SpotifyEmbedController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  setVolume?(volume: number): void;
  addListener(
    event: "ready" | "playback_update" | "playback_started",
    cb: (e: {
      data: {
        isPaused: boolean;
        isBuffering: boolean;
        duration: number;
        position: number;
        isBlocked?: boolean;
        playbackRestrictions?: string[];
        metadata?: {
          title?: string;
          artists?: { name?: string }[];
          images?: { url?: string }[];
        };
      };
    }) => void,
  ): void;
  removeListener?(event: string, cb?: (...args: unknown[]) => void): void;
  destroy(): void;
  iframeElement?: HTMLIFrameElement | null;
}

interface SpotifyIframeApi {
  createController(
    element: HTMLElement,
    options: { uri: string; width: string; height: string },
    callback: (controller: SpotifyEmbedController) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  }
}

const SCRIPT_SRC = "https://open.spotify.com/embed/iframe-api/v1";

let apiPromise: Promise<SpotifyIframeApi> | null = null;

function loadApi(): Promise<SpotifyIframeApi> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      previous?.(api);
      resolve(api);
    };
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("spotify-sdk-blocked"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

const CAPABILITIES: MusicCapabilities = {
  play: true,
  pause: true,
  seek: false, // not exposed by the Embed API
  volume: true,
  next: true, // embed navigates inside collections
  previous: true,
};

export class SpotifyEmbedAdapter implements MusicProviderAdapter {
  readonly provider = "spotify" as const;
  readonly capabilities = CAPABILITIES;

  private listeners = new Set<MusicListener>();
  private controller: SpotifyEmbedController | null = null;
  private host: HTMLElement | null = null;
  private snapshot: MusicSnapshot = { state: "idle", ref: null, track: null };
  private destroyed = false;
  private pendingUri: string | null = null;

  canHandle(url: string): boolean {
    return parseMusicUrl(url)?.provider === "spotify";
  }

  normalize(url: string): MusicRef | null {
    const ref = parseMusicUrl(url);
    return ref?.provider === "spotify" ? ref : null;
  }

  /** The host element is owned by `music-player-host.tsx`; we only attach. */
  attach(host: HTMLElement) {
    this.host = host;
  }

  async load(ref: MusicRef): Promise<void> {
    this.destroyed = false;
    const uri = `spotify:${ref.kind}:${ref.id}`;
    this.emit({ state: "loading", ref, track: null });
    let api: SpotifyIframeApi;
    try {
      api = await loadApi();
    } catch {
      this.emit({ state: "error", ref, track: null, reason: "sdk-blocked" });
      throw new Error("sdk-blocked");
    }
    if (this.destroyed || !this.host) return;
    if (this.controller) {
      this.pendingUri = null;
      this.controller.loadUri(uri);
      return;
    }
    this.pendingUri = uri;
    // The controller replaces the element passed in with the iframe in some
    // SDK versions — wrap the host in a stable child to keep OUR host node.
    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "152px";
    this.host.appendChild(mount);
    await new Promise<void>((resolve, reject) => {
      api.createController(
        mount,
        { uri, width: "100%", height: "152" },
        (controller) => {
          if (this.destroyed) {
            controller.destroy();
            return;
          }
          this.controller = controller;
          controller.addListener("ready", () => resolve());
          controller.addListener("playback_update", (e) => this.onUpdate(e));
          controller.addListener(
            "playback_started",
            (e) => e.data.playbackRestrictions && this.onUpdate(e),
          );
        },
      );
      // Ready never fires when the SDK/cookies are blocked inside the frame.
      setTimeout(() => {
        if (this.snapshot.state === "loading") {
          this.emit({
            state: "blocked",
            ref,
            track: null,
            reason: "embed-timeout",
          });
          reject(new Error("embed-timeout"));
        }
      }, 15000);
    });
  }

  private onUpdate(e: {
    data: {
      isPaused: boolean;
      isBuffering: boolean;
      duration: number;
      position: number;
      isBlocked?: boolean;
      metadata?: {
        title?: string;
        artists?: { name?: string }[];
        images?: { url?: string }[];
      };
    };
  }) {
    const d = e.data;
    const track = {
      title: d.metadata?.title,
      creator: d.metadata?.artists?.map((a) => a?.name).filter(Boolean).join(", "),
      artworkUrl: d.metadata?.images?.[0]?.url,
      durationMs: d.duration > 0 ? d.duration : undefined,
    };
    let state: MusicSnapshot["state"];
    if (d.isBlocked) state = "blocked";
    else if (d.isBuffering) state = "buffering";
    else if (d.isPaused) {
      state = d.position === 0 && this.snapshot.state === "loading" ? "ready" : "paused";
      if (d.duration > 0 && d.position > 0 && Math.abs(d.position - d.duration) < 750)
        state = "ended";
    } else state = "playing";
    this.emit({
      state,
      ref: this.snapshot.ref,
      track,
      positionMs: d.position,
      reason: d.isBlocked ? "autoplay-denied" : undefined,
    });
  }

  private emit(partial: Partial<MusicSnapshot> & { state: MusicSnapshot["state"] }) {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const l of this.listeners) l(this.snapshot);
  }

  play() {
    this.controller?.play();
  }
  pause() {
    this.controller?.pause();
  }
  setVolume(volume: number) {
    this.controller?.setVolume?.(volume);
  }
  next() {
    // The Spotify Embed owns in-collection navigation UI; there is no
    // programmatic next/previous in the Embed API — capabilities expose the
    // embed's own controls, so we omit store-level no-ops here.
  }
  previous() {}

  subscribe(listener: MusicListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
    try {
      this.controller?.destroy();
    } catch {
      /* teardown must never throw */
    }
    this.controller = null;
  }
}

export function createSpotifyEmbedAdapter(host: HTMLElement) {
  const adapter = new SpotifyEmbedAdapter();
  adapter.attach(host);
  return adapter;
}
