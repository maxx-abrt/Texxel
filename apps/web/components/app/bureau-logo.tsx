"use client";

/**
 * Theme-aware Bureau wordmark logo.
 *
 * The two assets are the puzzle-piece mark provided by the user:
 *  - bureau-logo-light.png: dark puzzle on transparent, for light mode.
 *  - bureau-logo-dark.png: light puzzle on transparent, for dark mode.
 */
export function BureauLogo({
  size = 22,
  alt = "Bureau",
  className = "",
  forceTheme,
}: {
  size?: number;
  alt?: string;
  className?: string;
  /** Force the logo asset for a given surface, ignoring page theme. */
  forceTheme?: "light" | "dark";
}) {
  if (forceTheme === "dark") {
    return (
      <span className={className} style={{ width: size, height: size, display: "inline-flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/bureau-logo-dark-512.png"
          alt={alt}
          draggable={false}
          className="block select-none"
          style={{ width: size, height: size, maxWidth: "none", flexShrink: 0 }}
        />
      </span>
    );
  }
  if (forceTheme === "light") {
    return (
      <span className={className} style={{ width: size, height: size, display: "inline-flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/bureau-logo-light-512.png"
          alt={alt}
          draggable={false}
          className="block select-none"
          style={{ width: size, height: size, maxWidth: "none", flexShrink: 0 }}
        />
      </span>
    );
  }
  return (
    <span className={className} style={{ width: size, height: size, display: "inline-flex" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/bureau-logo-light-512.png"
        alt={alt}
        draggable={false}
        className="block select-none dark:hidden"
        style={{ width: size, height: size, maxWidth: "none", flexShrink: 0 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/bureau-logo-dark-512.png"
        alt={alt}
        draggable={false}
        className="hidden select-none dark:block"
        style={{ width: size, height: size, maxWidth: "none", flexShrink: 0 }}
      />
    </span>
  );
}
