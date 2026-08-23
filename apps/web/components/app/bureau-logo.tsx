"use client";

/**
 * Bureau wordmark logo.
 *
 * Single red puzzle mark on transparent background (rgb 225,75,62).
 * Reads well on both light and dark surfaces, so one asset serves all themes.
 * The `forceTheme` prop is kept for call-site compatibility but no longer
 * changes the rendered asset.
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
  /** Kept for backwards compatibility; no longer changes the asset. */
  forceTheme?: "light" | "dark";
}) {
  void forceTheme;
  return (
    <span className={className} style={{ width: size, height: size, display: "inline-flex" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/bureau-logo.svg"
        alt={alt}
        draggable={false}
        className="block select-none"
        style={{ width: size, height: size, maxWidth: "none", flexShrink: 0 }}
      />
    </span>
  );
}
