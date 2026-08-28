// URL normalization + allowlists for the music experience (§3.1).
//
// Parse with `URL`, explicit HTTPS hostname allowlists, and provider-specific
// id validation. We never inject arbitrary embed HTML — only normalized
// provider refs reach the adapters, and only the official players touch the
// network. Unknown URLs return null so the caller can link out safely.

import type { MusicProviderId, MusicRef } from "./types";

/** Exact hostname allowlist per provider (https only). Subdomains are
 * matched explicitly — no wildcards. */
const ALLOWED_HOSTS: Record<MusicProviderId, string[]> = {
  spotify: ["open.spotify.com"],
  youtube: [
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtube-nocookie.com",
  ],
  soundcloud: ["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com"],
};

/** Provider id character whitelist (no path traversal / injection chars). */
const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/;
const YOUTUBE_VIDEO_ID = /^[0-9A-Za-z_-]{11}$/;
const YOUTUBE_PLAYLIST_ID = /^[0-9A-Za-z_-]{10,}$/;
const SOUNDCLOUD_PATH = /^[a-z0-9-]+(\/(sets\/)?[a-z0-9-]+)?$/;

const SPOTIFY_KINDS = new Set([
  "track",
  "album",
  "playlist",
  "show",
  "episode",
]);

export function parseMusicUrl(raw: string): MusicRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    // Bare domains ("open.spotify.com/track/…") get an https scheme.
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS.spotify.includes(host)) return parseSpotify(url);
  if (ALLOWED_HOSTS.youtube.includes(host)) return parseYouTube(url, host);
  if (ALLOWED_HOSTS.soundcloud.includes(host)) return parseSoundCloud(url);
  return null;
}

function parseSpotify(url: URL): MusicRef | null {
  // /track/:id, /album/:id, /playlist/:id, /show/:id, /episode/:id
  // Optional locale prefix (/intl-en/track/:id) is tolerated.
  const segments = url.pathname.split("/").filter(Boolean);
  const offset = segments[0]?.startsWith("intl-") ? 1 : 0;
  const kind = segments[offset];
  const id = segments[offset + 1]?.split("?")[0];
  if (!kind || !id || !SPOTIFY_KINDS.has(kind) || !SPOTIFY_ID.test(id)) {
    return null;
  }
  return {
    provider: "spotify",
    kind,
    id,
    url: `https://open.spotify.com/${kind}/${id}`,
    collection: kind === "album" || kind === "playlist" || kind === "show",
  };
}

function parseYouTube(url: URL, host: string): MusicRef | null {
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!YOUTUBE_VIDEO_ID.test(id)) return null;
    return youtubeVideo(id);
  }
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    if (YOUTUBE_VIDEO_ID.test(id)) return youtubeVideo(id);
    return null;
  }
  if (url.pathname === "/playlist") {
    const id = url.searchParams.get("list") ?? "";
    if (!YOUTUBE_PLAYLIST_ID.test(id)) return null;
    return {
      provider: "youtube",
      kind: "playlist",
      id,
      url: `https://www.youtube.com/playlist?list=${id}`,
      collection: true,
    };
  }
  // /shorts/:id and /embed/:id
  const sections = url.pathname.split("/").filter(Boolean);
  if ((sections[0] === "shorts" || sections[0] === "embed") && sections[1]) {
    if (YOUTUBE_VIDEO_ID.test(sections[1])) return youtubeVideo(sections[1]);
  }
  return null;
}

function youtubeVideo(id: string): MusicRef {
  return {
    provider: "youtube",
    kind: "video",
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    collection: false,
  };
}

function parseSoundCloud(url: URL): MusicRef | null {
  const path = url.pathname.replace(/^\/+|\/+$/g, "");
  if (!path || !SOUNDCLOUD_PATH.test(path)) return null;
  const collection = path.includes("/sets/");
  if (collection && !path.split("/")[2]) return null; // "/user/sets/" bare
  return {
    provider: "soundcloud",
    kind: collection ? "set" : "track",
    id: path,
    url: `https://soundcloud.com/${path}`,
    collection,
  };
}
