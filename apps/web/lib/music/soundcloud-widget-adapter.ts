// SoundCloud Widget API adapter (§3.1) — official HTML5 widget.
//
// https://developers.soundcloud.com/docs/api/html5-widget
//
// The widget script (`w.soundcloud.com/player/api.js`) is loaded exactly
// once, lazily, on the first `load()` call — never in the initial bundle.
// The official widget iframe is created inside a stable child of OUR host
// element (owned by `music-player-host.tsx`), so React can never remount it.
// Events (READY / PLAY / PAUSE / FINISH / PLAY_PROGRESS / ERROR) are
// mirrored into the normalized state machine; all listeners are unbound on
// teardown.

"use client";

import type {
  MusicCapabilities,
  MusicListener,
  MusicProviderAdapter,
  MusicRef,
  MusicSnapshot,
} from "./types";
import { parseMusicUrl } from "./url";

interface SCPlayProgress {
  currentPosition: number; // ms
  relativePosition: number; // 0..1
  loadProgress: number;
}

interface SCWidget {
  bind(event: string, cb: (payload?: SCPlayProgress) => void): void;
  unbind(event: string, cb?: (payload?: SCPlayProgress) => void): void;
  load(url: string, options?: Record<string, unknown>): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seekTo(ms: number): void;
  setVolume(volume: number): void; // 0..100
  getVolume(cb: (volume: number) => void): void;
  getDuration(cb: (duration: number) => void): void;
  getPosition(cb: (position: number) => void): void;
  getCurrentSound(
    cb: (sound: {
      title?: string;
      duration?: number;
      artwork_url?: string;
      user?: { username?: string };
    }) => void,
  ): void;
  next(): void;
  prev(): void;
}

interface SCNamespace {
  Widget: {
    (iframe: HTMLIFrameElement): SCWidget;
    Events: {
      READY: string;
      PLAY: string;
      PAUSE: string;
      FINISH: string;
      PLAY_PROGRESS: string;
      LOAD_PROGRESS: string;
      ERROR: string;
    };
  };
}

declare global {
  interface Window {
    SC?: SCNamespace;
  }
}

const SCRIPT_SRC = "https://w.soundcloud.com/player/api.js";
const EMBED_BASE = "https://w.soundcloud.com/player/";

let apiPromise: Promise<SCNamespace> | null = null;

function loadApi(): Promise<SCNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.SC?.Widget) {
      resolve(window.SC);
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.SC?.Widget) resolve(window.SC);
      else {
        apiPromise = null;
        reject(new Error("soundcloud-sdk-incomplete"));
      }
    };
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("soundcloud-sdk-blocked"));
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
  next: true, // set navigation
  previous: true,
};

export class SoundCloudWidgetAdapter implements MusicProviderAdapter {
  readonly provider = "soundcloud" as const;
  readonly capabilities = CAPABILITIES;

  private listeners = new Set<MusicListener>();
  private widget: SCWidget | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private host: HTMLElement | null = null;
  private snapshot: MusicSnapshot = { state: "idle", ref: null, track: null };
  private destroyed = false;
  private durationMs = 0;
  private handlers: [string, (payload?: SCPlayProgress) => void][] = [];

  canHandle(url: string): boolean {
    return parseMusicUrl(url)?.provider === "soundcloud";
  }

  normalize(url: string): MusicRef | null {
    const ref = parseMusicUrl(url);
    return ref?.provider === "soundcloud" ? ref : null;
  }

  attach(host: HTMLElement) {
    this.host = host;
  }

  async load(ref: MusicRef): Promise<void> {
    this.destroyed = false;
    this.emit({ state: "loading", ref, track: null, positionMs: 0 });
    let SC: SCNamespace;
    try {
      SC = await loadApi();
    } catch {
      this.emit({ state: "error", ref, track: null, reason: "sdk-blocked" });
      throw new Error("sdk-blocked");
    }
    if (this.destroyed || !this.host) return;

    if (this.widget) {
      // Reuse the live widget — never remount the iframe.
      try {
        this.widget.load(ref.url, { auto_play: false });
      } catch {
        this.emit({ state: "error", ref, track: null, reason: "load-failed" });
      }
      return;
    }

    // Build the official embed iframe ourselves (fixed embed URL — never
    // arbitrary user HTML, §3.1) and attach the Widget API to it.
    const iframe = document.createElement("iframe");
    const params = new URLSearchParams({
      url: ref.url,
      auto_play: "false",
      hide_related: "true",
      show_comments: "false",
      show_user: "true",
      show_reposts: "false",
      show_teaser: "false",
      visual: ref.collection ? "true" : "false",
    });
    iframe.src = `${EMBED_BASE}?${params.toString()}`;
    iframe.title = "SoundCloud player";
    iframe.width = "100%";
    iframe.height = ref.collection ? "300" : "166";
    iframe.allow = "autoplay";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.style.border = "0";
    iframe.style.display = "block";
    this.host.appendChild(iframe);
    this.iframe = iframe;

    this.widget = SC.Widget(iframe);
    const E = SC.Widget.Events;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.snapshot.state === "loading") {
          this.emit({ state: "blocked", ref, track: null, reason: "embed-timeout" });
          reject(new Error("embed-timeout"));
        }
      }, 15000);

      const onReady = () => {
        clearTimeout(timeout);
        if (this.destroyed || !this.widget) return;
        this.widget.getDuration((d) => {
          this.durationMs = d;
        });
        this.widget.getCurrentSound((sound) => {
          this.emit({
            state: "ready",
            ref,
            track: {
              title: sound?.title || undefined,
              creator: sound?.user?.username || undefined,
              artworkUrl: sound?.artwork_url
                ? // 100×100 provider-served artwork (https upgrade only).
                  sound.artwork_url.replace(/^http:/, "https:").replace("-large", "-t100x100")
                : undefined,
              durationMs: sound?.duration,
            },
            positionMs: 0,
          });
        });
        resolve();
      };
      const onPlay = () => this.emitState("playing");
      const onPause = () => this.emitState("paused");
      const onFinish = () =>
        this.emit({ state: "ended", ref: this.snapshot.ref, track: this.snapshot.track });
      const onProgress = (p?: SCPlayProgress) => {
        if (p && typeof p.currentPosition === "number") {
          this.emit({ state: this.snapshot.state, positionMs: p.currentPosition });
        }
        if (p && this.snapshot.state === "loading") {
          // LOAD/PLAY progress can arrive before READY on slow networks.
          this.emit({ state: "buffering" });
        }
      };
      const onError = () =>
        this.emit({ state: "error", ref: this.snapshot.ref, track: null, reason: "player-error" });

      this.bind(E.READY, onReady);
      this.bind(E.PLAY, onPlay);
      this.bind(E.PAUSE, onPause);
      this.bind(E.FINISH, onFinish);
      this.bind(E.PLAY_PROGRESS, onProgress);
      this.bind(E.ERROR, onError);
    });
  }

  private bind(event: string, cb: (payload?: SCPlayProgress) => void) {
    this.widget?.bind(event, cb);
    this.handlers.push([event, cb]);
  }

  private emitState(state: MusicSnapshot["state"]) {
    if (this.destroyed) return;
    this.widget?.getCurrentSound((sound) => {
      this.emit({
        state,
        ref: this.snapshot.ref,
        track: sound
          ? {
              title: sound.title || undefined,
              creator: sound.user?.username || undefined,
              durationMs: sound.duration,
            }
          : this.snapshot.track,
      });
    });
  }

  private emit(partial: Partial<MusicSnapshot> & { state: MusicSnapshot["state"] }) {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const l of this.listeners) l(this.snapshot);
  }

  play() {
    try {
      this.widget?.play();
    } catch {
      /* not ready */
    }
  }
  pause() {
    try {
      this.widget?.pause();
    } catch {
      /* not ready */
    }
  }
  seek(positionMs: number) {
    try {
      this.widget?.seekTo(positionMs);
    } catch {
      /* not ready */
    }
  }
  setVolume(volume: number) {
    try {
      this.widget?.setVolume(Math.round(volume * 100));
    } catch {
      /* not ready */
    }
  }
  next() {
    try {
      this.widget?.next();
    } catch {
      /* not ready */
    }
  }
  previous() {
    try {
      this.widget?.prev();
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
    if (this.widget) {
      for (const [event, cb] of this.handlers) {
        try {
          this.widget.unbind(event, cb);
        } catch {
          /* teardown must never throw */
        }
      }
    }
    this.handlers = [];
    // Removing the iframe stops playback — pause first, then drop the node.
    const widget = this.widget;
    this.widget = null;
    try {
      widget?.pause();
    } catch {
      /* no-op */
    }
    this.iframe?.remove();
    this.iframe = null;
  }
}

export function createSoundCloudWidgetAdapter(host: HTMLElement) {
  const adapter = new SoundCloudWidgetAdapter();
  adapter.attach(host);
  return adapter;
}
