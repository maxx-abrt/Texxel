"use client";

import { Noise } from "@/components/ui/noise";

/**
 * Background for the auth pages — single radial spotlight + static canvas
 * grain, all pinned to the viewport so it doesn't shift with the form.
 */
export const AuthBackground = () => {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Solid base */}
      <div className="absolute inset-0 bg-[#0a0a0a]" />

      {/* Top spotlight (the Cronos-style "sun") */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle 620px at 50% -120px, rgba(247,108,94,0.55), rgba(247,108,94,0.0) 65%)",
        }}
      />
      {/* Subtle bottom warmth so the page never feels cut off */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle 700px at 50% 110%, rgba(247,108,94,0.10), transparent 65%)",
        }}
      />
      {/* Faint vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 60% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Static film-grain — sits on top of all gradients */}
      <div className="absolute inset-0" style={{ mixBlendMode: "overlay", opacity: 0.55 }}>
        <Noise patternSize={256} patternAlpha={20} />
      </div>
    </div>
  );
};
