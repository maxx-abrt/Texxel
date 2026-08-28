// Music provider contract (§3.1 technical architecture).
//
// A `MusicProviderAdapter` is a thin wrapper over ONE official provider
// player (Spotify Embed iFrame API, YouTube IFrame API, SoundCloud Widget
// API, …). All provider-specific code lives behind this contract so the
// widget / mini-player / host never branch on provider names.
//
// Normalized state machine:
//   idle → loading → ready → playing ⇄ paused
//                    ↓         ↓
//                 buffering   ended
//   Any state may fall to `blocked` (autoplay denied / cookies off / SDK
//   blocked) or `error` (private/unavailable/geo/deleted/network).

export type MusicProviderId = "spotify" | "youtube" | "soundcloud";

export type MusicPlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "blocked"
  | "error";

/** Optional transport/volume capabilities a provider can expose. The widget
 * renders controls only for capabilities that are `true` (§3.1: unsupported
 * actions are omitted, never disabled without explanation). */
export interface MusicCapabilities {
  play: boolean;
  pause: boolean;
  seek: boolean;
  volume: boolean;
  next: boolean;
  previous: boolean;
}

/** A normalized, provider-owned reference to a playable item. We never
 * scrape track lists: a playlist/album stays a single `collection` ref the
 * provider player navigates internally. */
export interface MusicRef {
  provider: MusicProviderId;
  /** e.g. "track" | "album" | "playlist" | "show" | "episode"
   *  | "video" | "set" — free-form per provider, `collection` flag marks
   *  any multi-item kind. */
  kind: string;
  /** Provider-native id (Spotify id, YouTube video/playlist id, SC url). */
  id: string;
  /** Canonical HTTPS url on the provider, for "Open in provider". */
  url: string;
  /** True when the ref points at a provider-owned collection. */
  collection: boolean;
}

export interface MusicTrackInfo {
  title?: string;
  creator?: string;
  artworkUrl?: string;
  /** Total duration in ms when the provider reports it. */
  durationMs?: number;
}

export interface MusicSnapshot {
  state: MusicPlaybackState;
  ref: MusicRef | null;
  track: MusicTrackInfo | null;
  /** ms into the current item, when known. */
  positionMs?: number;
  /** 0..1 */
  volume?: number;
  /** Machine-readable error/blocked reason, surfaced to the UI. */
  reason?: string;
}

export type MusicListener = (snapshot: MusicSnapshot) => void;

export interface MusicProviderAdapter {
  readonly provider: MusicProviderId;
  readonly capabilities: MusicCapabilities;
  canHandle(url: string): boolean;
  /** Normalize a user-pasted URL into a MusicRef, or null when the URL is
   * not a supported https URL for this provider (§3.1: specific errors beat
   * generic failure — returning null lets the caller try the next adapter). */
  normalize(url: string): MusicRef | null;
  /** Mount the provider player (loading its SDK once, lazily) and start
   * loading `ref`. Resolves when the player reports ready/playing/blocked
   * via the subscription. Must be safe to call again with a different ref. */
  load(ref: MusicRef): Promise<void>;
  play(): void;
  pause(): void;
  seek?(positionMs: number): void;
  setVolume?(volume: number): void;
  next?(): void;
  previous?(): void;
  subscribe(listener: MusicListener): () => void;
  /** Remove listeners and free the player. The host element is owned by the
   * caller (music-player-host) and must NOT be removed here. */
  destroy(): void;
}
