"use client";

import { useEffect, useRef } from "react";

interface NoiseProps {
  /** Render canvas size in pixels (per side). Higher = finer grain pattern, more memory. */
  patternSize?: number;
  /** 0–255 alpha applied to each grain pixel. */
  patternAlpha?: number;
  /** Optional className passed to the canvas element. */
  className?: string;
  /** Inline style passed to the canvas. */
  style?: React.CSSProperties;
}

/**
 * Static (one-shot) film-grain noise overlay.
 * Draws a single random-noise frame onto a fixed-size canvas, then stretches
 * it to fill its parent. No animation, no per-frame work — costs nothing
 * after the first paint and looks far cleaner than CSS/SVG fractal noise.
 *
 * Place inside a relatively-positioned parent. The canvas is absolutely
 * positioned and `pointer-events: none`, so it never blocks input.
 */
export const Noise = ({
  patternSize = 256,
  patternAlpha = 16,
  className,
  style,
}: NoiseProps) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = patternSize;
    canvas.height = patternSize;

    const imageData = ctx.createImageData(patternSize, patternSize);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const value = (Math.random() * 255) | 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = patternAlpha;
    }
    ctx.putImageData(imageData, 0, 0);
  }, [patternSize, patternAlpha]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ""}`}
      style={{ imageRendering: "pixelated", ...style }}
    />
  );
};
