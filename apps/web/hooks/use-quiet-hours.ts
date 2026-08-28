"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";

// M5.5 (§6) — Quiet hours suppress browser push notifications; the inbox
// still fills because notifications are written to Convex regardless. This
// hook is the single integration point: any future push code calls
// `isQuietHours` and skips firing `new Notification(...)` when true.

export type QuietHours = {
  enabled: boolean;
  start: string; // "HH:MM" 24h, local
  end: string; // "HH:MM" 24h, local (may wrap overnight)
};

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: "22:00",
  end: "07:00",
};

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHM(s: string): number | null {
  const m = HH_MM.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// True when `nowMin` (minutes since midnight, local) falls inside the
// [start, end) window. Handles overnight wrap (e.g. 22:00 → 07:00).
export function isInQuietWindow(
  nowMin: number,
  start: string,
  end: string,
): boolean {
  const s = parseHM(start);
  const e = parseHM(end);
  if (s === null || e === null) return false;
  if (s === e) return false; // zero-length window
  if (s < e) return nowMin >= s && nowMin < e; // same-day window
  return nowMin >= s || nowMin < e; // overnight wrap
}

export function useQuietHours() {
  const prefs = useQuery(api.flux_userPrefs.get);
  const updatePrefs = useMutation(api.flux_userPrefs.update);

  const quietHours: QuietHours = useMemo(() => {
    const q = (prefs as any)?.quietHours;
    if (!q || typeof q !== "object") return DEFAULT_QUIET_HOURS;
    return {
      enabled: !!q.enabled,
      start: typeof q.start === "string" && HH_MM.test(q.start) ? q.start : DEFAULT_QUIET_HOURS.start,
      end: typeof q.end === "string" && HH_MM.test(q.end) ? q.end : DEFAULT_QUIET_HOURS.end,
    };
  }, [prefs]);

  const isQuietHours = useMemo(() => {
    if (!quietHours.enabled) return false;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return isInQuietWindow(nowMin, quietHours.start, quietHours.end);
  }, [quietHours]);

  const updateQuietHours = (next: Partial<QuietHours>) => {
    const merged: QuietHours = { ...quietHours, ...next };
    return updatePrefs({ quietHours: merged });
  };

  return { quietHours, isQuietHours, updateQuietHours };
}
