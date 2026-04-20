"use client";

import { createReactInlineContentSpec, useBlockNoteEditor } from "@blocknote/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { JSX } from "react";
import {
  Palette, Calendar, Tag, BarChart2, MapPin, CheckCircle2, CalendarDays,
  Bell, ExternalLink, ListTodo, FolderKanban, UserIcon, CheckSquare
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Color utilities
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace("#", "");
  if (c.length !== 6) return null;
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0)
      : max === g ? (b - r) / d + 2
      : (r - g) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function parseColorInput(raw: string): string | null {
  const s = raw.trim();
  if (/^#([0-9a-f]{3}){1,2}$/i.test(s)) {
    if (s.length === 4) return "#" + s.slice(1).split("").map((c) => c + c).join("");
    return s.toLowerCase();
  }
  const rgb = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgb) return rgbToHex(+rgb[1], +rgb[2], +rgb[3]);
  const hsl = s.match(/^hsl\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)$/i);
  if (hsl) {
    const h = +hsl[1] / 360, sl = +hsl[2] / 100, l = +hsl[3] / 100;
    const q = l < 0.5 ? l * (1 + sl) : l + sl - l * sl;
    const p = 2 * l - q;
    const hue = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 0.5) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return rgbToHex(Math.round(hue(p, q, h + 1/3) * 255), Math.round(hue(p, q, h) * 255), Math.round(hue(p, q, h - 1/3) * 255));
  }
  return null;
}

function formatColorValue(hex: string, fmt: "hex" | "rgb" | "hsl"): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (fmt === "rgb") return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  if (fmt === "hsl") { const [h, s, l] = rgbToHsl(...rgb); return `hsl(${h}, ${s}%, ${l}%)`; }
  return hex;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date utilities
// ─────────────────────────────────────────────────────────────────────────────

const PARIS_TZ = "Europe/Paris";

function todayInParis(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: PARIS_TZ }).format(new Date());
}

function formatDate(dateStr: string, fmt: "relative" | "short" | "long", locale = "en"): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    if (fmt === "relative") {
      const todayStr = todayInParis();
      const todayD = new Date(todayStr + "T00:00:00");
      const diff = Math.round((d.getTime() - todayD.getTime()) / 86_400_000);
      try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        if (Math.abs(diff) < 30) return rtf.format(diff, "day");
        if (Math.abs(diff) < 365) return rtf.format(Math.round(diff / 7), "week");
        return rtf.format(Math.round(diff / 365), "year");
      } catch { return diff === 0 ? "Today" : diff > 0 ? `In ${diff}d` : `${Math.abs(diff)}d ago`; }
    }
    if (fmt === "short") return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(d);
    return new Intl.DateTimeFormat(locale, { weekday: "short", month: "long", day: "numeric", year: "numeric" }).format(d);
  } catch { return dateStr; }
}

function formatEventDate(dateStr: string, timeStr: string, locale = "en"): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + (timeStr ? `T${timeStr}:00` : "T00:00:00"));
    if (isNaN(d.getTime())) return dateStr;
    const opts: Intl.DateTimeFormatOptions = timeStr
      ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" };
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch { return dateStr; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unique chip ID
// ─────────────────────────────────────────────────────────────────────────────

export function genChipId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: update a chip's props by chipId via ProseMirror transaction
// ─────────────────────────────────────────────────────────────────────────────

function useUpdateChip() {
  const editor = useBlockNoteEditor<any, any, any>();
  return useCallback(
    (nodeType: string, chipId: string, newAttrs: Record<string, any>) => {
      const pm = (editor as any)._tiptapEditor;
      if (!pm) return;
      const { state } = pm;
      const tr = state.tr;
      let updated = false;
      state.doc.nodesBetween(0, state.doc.content.size, (node: any, pos: number) => {
        if (updated) return false;
        if (node.type.name === nodeType && node.attrs.chipId === chipId) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...newAttrs });
          updated = true;
          return false;
        }
      });
      if (updated) pm.view.dispatch(tr);
    },
    [editor],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal popover — renders at document.body to escape overflow constraints
// ─────────────────────────────────────────────────────────────────────────────


interface PopoverProps {
  anchor: HTMLElement | null;
  onClose: () => void;
  onApply?: () => void;
  children: React.ReactNode;
}

function ChipPopover({ anchor, onClose, onApply, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>(
    { top: -9999, left: -9999, ready: false },
  );

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect();
    const POP_W = 288;
    const POP_H = ref.current.offsetHeight || 340;
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const top = spaceBelow >= POP_H ? r.bottom + 6 : Math.max(8, r.top - POP_H - 6);
    const left = Math.max(8, Math.min(
      window.innerWidth - POP_W - 8,
      window.innerWidth - r.left > POP_W ? r.left : r.right - POP_W,
    ));
    setPos({ top, left, ready: true });
  }, [anchor]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchor && !anchor.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [anchor, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onApply) { e.preventDefault(); onApply(); }
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose, onApply]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
        opacity: pos.ready ? 1 : 0,
        pointerEvents: pos.ready ? "auto" : "none",
        transition: pos.ready ? "opacity 100ms ease" : "none",
      }}
      className="w-72 max-h-[82vh] overflow-y-auto rounded-xl border border-border bg-popover shadow-2xl text-sm"
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared popover action buttons
// ─────────────────────────────────────────────────────────────────────────────

function PopActions({ onCancel, onApply }: { onCancel: () => void; onApply: () => void }) {
  const t = useTranslations("chips");
  return (
    <div className="flex gap-2 border-t border-border/50 px-3 py-2.5">
      <button
        onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
        className="flex-1 rounded-lg border border-border/60 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
      >{t("cancel")}</button>
      <button
        onMouseDown={(e) => { e.preventDefault(); onApply(); }}
        className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >{t("apply")} <span className="opacity-40 font-normal">⌘↵</span></button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR CHIP
// ─────────────────────────────────────────────────────────────────────────────

function ColorChipRenderer({ inlineContent }: {
  inlineContent: { props: { chipId: string; color: string; format: string } };
}) {
  const { chipId, color, format } = inlineContent.props as { chipId: string; color: string; format: "hex" | "rgb" | "hsl" };
  const update = useUpdateChip();
  const [open, setOpen] = useState(false);
  const [draftHex, setDraftHex] = useState(color);
  const [draftFmt, setDraftFmt] = useState<"hex" | "rgb" | "hsl">(format);
  const [inputVal, setInputVal] = useState(formatColorValue(color, format));
  const ref = useRef<HTMLSpanElement>(null);

  const openPop = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDraftHex(color); setDraftFmt(format); setInputVal(formatColorValue(color, format));
    setOpen(true);
  };
  const apply = () => { update("colorChip", chipId, { color: draftHex, format: draftFmt }); setOpen(false); };

  return (
    <>
      <span
        ref={ref}
        onMouseDown={openPop}
        className="relative inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-1.5 py-0.5 font-mono text-[0.78em] text-foreground/80 transition-all hover:border-border hover:bg-muted/60"
      >
        <span className="h-3 w-3 shrink-0 rounded-sm border border-black/10 shadow-sm" style={{ backgroundColor: color }} />
        {formatColorValue(color, format)}
      </span>
      {open && (
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)} onApply={apply}>
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <input
                type="color" value={draftHex}
                onChange={(e) => { setDraftHex(e.target.value); setInputVal(formatColorValue(e.target.value, draftFmt)); }}
                className="h-9 w-9 cursor-pointer rounded-lg border-0 p-0.5"
              />
              <input
                type="text" value={inputVal} placeholder="#3b82f6"
                onChange={(e) => { setInputVal(e.target.value); const p = parseColorInput(e.target.value); if (p) setDraftHex(p); }}
                className="flex-1 rounded-lg border px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(["hex", "rgb", "hsl"] as const).map((f) => (
                <button key={f} onMouseDown={(e) => { e.preventDefault(); setDraftFmt(f); setInputVal(formatColorValue(draftHex, f)); }}
                  className={cn("rounded-lg py-1 text-[10px] font-bold uppercase tracking-widest transition-colors",
                    draftFmt === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}>{f}</button>
              ))}
            </div>
            <div className="h-6 rounded-lg border border-border/30" style={{ backgroundColor: draftHex }} />
          </div>
          <PopActions onCancel={() => setOpen(false)} onApply={apply} />
        </ChipPopover>
      )}
    </>
  );
}

export const ColorChipSpec = createReactInlineContentSpec(
  { type: "colorChip" as const, propSchema: { chipId: { default: "0" }, color: { default: "#3b82f6" }, format: { default: "hex" } }, content: "none" } as const,
  { render: (p) => <ColorChipRenderer inlineContent={p.inlineContent as any} /> },
);

// ─────────────────────────────────────────────────────────────────────────────
// DATE CHIP
// ─────────────────────────────────────────────────────────────────────────────

function DateChipRenderer({ inlineContent }: {
  inlineContent: { props: { chipId: string; date: string; format: string } };
}) {
  const { chipId, date, format } = inlineContent.props as { chipId: string; date: string; format: "relative" | "short" | "long" };
  const locale = useLocale();
  const update = useUpdateChip();
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(date);
  const [draftFmt, setDraftFmt] = useState<"relative" | "short" | "long">(format);
  const ref = useRef<HTMLSpanElement>(null);

  const t = useTranslations("chips");
  const apply = () => { update("dateChip", chipId, { date: draftDate, format: draftFmt }); setOpen(false); };

  return (
    <>
      <span
        ref={ref}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDraftDate(date); setDraftFmt(format); setOpen(true); }}
        className="inline-flex cursor-pointer select-none items-center gap-1 rounded-full border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[0.75em] font-medium text-blue-700 transition-all hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
      >
        <Calendar size={10} className="shrink-0 opacity-80" />
        {formatDate(date, format, locale)}
      </span>
      {open && (
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)} onApply={apply}>
          <div className="space-y-2.5 p-3">
            <input
              type="date" value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
            <div className="grid grid-cols-3 gap-1">
              {(["relative", "short", "long"] as const).map((f) => (
                <button key={f} onMouseDown={(e) => { e.preventDefault(); setDraftFmt(f); }}
                  className={cn("rounded-lg py-1 text-[10px] font-semibold capitalize tracking-wide transition-colors",
                    draftFmt === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}>{t(`formats.${f}` as any)}</button>
              ))}
            </div>
            <p className="rounded-lg bg-muted/50 py-1.5 text-center text-[11px] text-muted-foreground font-medium">
              {formatDate(draftDate, draftFmt, locale)}
            </p>
          </div>
          <PopActions onCancel={() => setOpen(false)} onApply={apply} />
        </ChipPopover>
      )}
    </>
  );
}

export const DateChipSpec = createReactInlineContentSpec(
  { type: "dateChip" as const, propSchema: { chipId: { default: "0" }, date: { default: "2024-01-01" }, format: { default: "short" } }, content: "none" } as const,
  { render: (p) => <DateChipRenderer inlineContent={p.inlineContent as any} /> },
);

// ─────────────────────────────────────────────────────────────────────────────
// BADGE CHIP — custom label + color (event / status / place / custom)
// ─────────────────────────────────────────────────────────────────────────────

const BADGE_STATUS_PRESETS = [
  { key: "todo",        color: "#6b7280" },
  { key: "in_progress", color: "#3b82f6" },
  { key: "in_review",   color: "#f97316" },
  { key: "done",        color: "#22c55e" },
  { key: "cancelled",   color: "#9ca3af" },
  { key: "blocked",     color: "#ef4444" },
  { key: "draft",       color: "#8b5cf6" },
  { key: "urgent",      color: "#dc2626" },
  { key: "approved",    color: "#059669" },
  { key: "warning",     color: "#d97706" },
  { key: "active",      color: "#0ea5e9" },
  { key: "review",      color: "#14b8a6" },
];

function BadgeChipRenderer({ inlineContent }: {
  inlineContent: { props: { chipId: string; text: string; bgColor: string; emoji: string } };
}) {
  const { chipId, text, bgColor, emoji } = inlineContent.props;
  const t = useTranslations("chips");
  const update = useUpdateChip();
  const [open, setOpen] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const [draftBg, setDraftBg] = useState(bgColor);
  const [draftEmoji, setDraftEmoji] = useState(emoji);
  const ref = useRef<HTMLSpanElement>(null);

  const apply = () => {
    update("badgeChip", chipId, { text: draftText.trim() || "Badge", bgColor: draftBg, emoji: draftEmoji });
    setOpen(false);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDraftText(text); setDraftBg(bgColor); setDraftEmoji(emoji); setOpen(true); }}
        className="relative inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.75em] font-semibold tracking-wide transition-all hover:opacity-80 active:scale-95"
        style={{
          border: `1px solid ${bgColor}55`,
          backgroundColor: bgColor + "20",
          color: bgColor,
        }}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: bgColor }} />
        <span>{text}</span>
      </span>
      {open && (
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)} onApply={apply}>
          <div className="p-3 pb-2">
            <div className="grid grid-cols-3 gap-1">
              {BADGE_STATUS_PRESETS.map((p) => (
                <button
                  key={p.key}
                  onMouseDown={(e) => { e.preventDefault(); setDraftText(t(`badge.presets.${p.key}` as any)); setDraftBg(p.color); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-all hover:opacity-90 active:scale-95 truncate",
                    draftText === t(`badge.presets.${p.key}` as any) && draftBg === p.color ? "ring-2 ring-offset-1" : ""
                  )}
                  style={{
                    border: `1px solid ${p.color}40`,
                    backgroundColor: p.color + "15",
                    color: p.color,
                  }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full flex-none" style={{ backgroundColor: p.color }} />
                  <span className="truncate">{t(`badge.presets.${p.key}` as any)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-border/40 px-3 py-2.5 space-y-2.5">
            <input
              type="text" value={draftText} onChange={(e) => setDraftText(e.target.value)}
              placeholder={t("badge.labelPlaceholder")}
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
            <div className="flex items-center gap-2.5">
              <input
                type="color" value={draftBg} onChange={(e) => setDraftBg(e.target.value)}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-border/50 p-0.5 bg-background"
              />
              <span
                className="flex h-7 flex-1 min-w-0 items-center gap-1.5 justify-center rounded-full px-3 text-[11px] font-semibold select-none"
                style={{
                  border: `1px solid ${draftBg}55`,
                  backgroundColor: draftBg + "18",
                  color: draftBg,
                }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: draftBg }} />
                <span className="truncate">{draftText || t("badge.preview")}</span>
              </span>
            </div>
          </div>
          <PopActions onCancel={() => setOpen(false)} onApply={apply} />
        </ChipPopover>
      )}
    </>
  );
}

export const BadgeChipSpec = createReactInlineContentSpec(
  { type: "badgeChip" as const, propSchema: { chipId: { default: "0" }, text: { default: "Badge" }, bgColor: { default: "#6366f1" }, emoji: { default: "" } }, content: "none" } as const,
  { render: (p) => <BadgeChipRenderer inlineContent={p.inlineContent as any} /> },
);

// ─────────────────────────────────────────────────────────────────────────────
// EVENT CHIP — title + date/time + colour, fully locale-aware
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_COLOR_PRESETS = [
  "#7c3aed", "#6366f1", "#3b82f6", "#0ea5e9",
  "#ec4899", "#ef4444", "#f97316", "#10b981",
];

const REMINDER_OPTION_KEYS = [
  { value: "",        key: "event.noReminder" },
  { value: "ontime",  key: "event.atTime" },
  { value: "10min",   key: "event.before10m" },
  { value: "30min",   key: "event.before30m" },
  { value: "1hour",   key: "event.before1h" },
  { value: "3hours",  key: "event.before3h" },
  { value: "1day",    key: "event.before1d" },
];

function EventChipRenderer({ inlineContent }: {
  inlineContent: { props: { chipId: string; title: string; date: string; time: string; color: string; reminder: string } };
}) {
  const { chipId, title, date, time, color, reminder } = inlineContent.props as {
    chipId: string; title: string; date: string; time: string; color: string; reminder: string;
  };
  const locale = useLocale();
  const t = useTranslations("chips");
  const update = useUpdateChip();
  const scheduleReminder = useMutation(api.notifications.createReminder);
  const [open, setOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDate, setDraftDate] = useState(date);
  const [draftTime, setDraftTime] = useState(time);
  const [draftColor, setDraftColor] = useState(color);
  const [draftReminder, setDraftReminder] = useState(reminder);
  const ref = useRef<HTMLSpanElement>(null);

  const reminderOptions = REMINDER_OPTION_KEYS.map(o => ({ value: o.value, label: t(o.key as any) }));

  const displayDate = date ? formatEventDate(date, time, locale) : "";

  const apply = async () => {
    update("eventChip", chipId, { title: draftTitle.trim() || "Event", date: draftDate, time: draftTime, color: draftColor, reminder: draftReminder });
    if (draftReminder && draftDate) {
      const reminderLabel = reminderOptions.find(o => o.value === draftReminder)?.label ?? "";
      const eventStr = formatEventDate(draftDate, draftTime, locale);
      try {
        await scheduleReminder({
          title: `${t("event.reminder")}: ${draftTitle || "Event"}`,
          body: `${reminderLabel}${eventStr ? " — " + eventStr : ""}`,
        });
      } catch { /* non-blocking */ }
    }
    setOpen(false);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDraftTitle(title); setDraftDate(date); setDraftTime(time); setDraftColor(color); setDraftReminder(reminder); setOpen(true); }}
        className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.75em] font-medium transition-all hover:opacity-80 active:scale-95"
        style={{ border: `1px solid ${color}55`, backgroundColor: color + "20", color }}
      >
        <CalendarDays size={10} className="shrink-0" />
        <span>{title}</span>
        {displayDate && (<><span className="opacity-40 select-none">·</span><span className="opacity-80">{displayDate}</span></>)}
        {reminder && <Bell size={9} className="ml-0.5 opacity-70" />}
      </span>
      {open && (
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)} onApply={apply}>
          <div className="space-y-2.5 p-3">
            <input type="text" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}
              placeholder={t("event.namePlaceholder")}
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)}
                className="rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
              <input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)}
                className="rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
            </div>
            <div className="flex items-center gap-1.5">
              {EVENT_COLOR_PRESETS.map((c) => (
                <button key={c} onMouseDown={(e) => { e.preventDefault(); setDraftColor(c); }}
                  className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: draftColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }} />
              ))}
              <input type="color" value={draftColor} onChange={(e) => setDraftColor(e.target.value)}
                className="ml-auto h-5 w-5 cursor-pointer rounded border-0 p-0" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/40 px-2.5 py-1.5">
              <Bell size={13} className="shrink-0 text-muted-foreground" />
              <select value={draftReminder} onChange={(e) => setDraftReminder(e.target.value)}
                className="flex-1 bg-transparent text-sm focus:outline-none">
                {reminderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ border: `1px solid ${draftColor}55`, backgroundColor: draftColor + "20", color: draftColor }}>
              <CalendarDays size={9} />
              <span>{draftTitle || t("event.namePlaceholder").replace("…", "")}</span>
              {draftDate && (<><span className="opacity-40">·</span><span className="opacity-80">{formatEventDate(draftDate, draftTime, locale)}</span></>)}
              {draftReminder && <Bell size={8} className="ml-0.5 opacity-70" />}
            </span>
          </div>
          <PopActions onCancel={() => setOpen(false)} onApply={apply} />
        </ChipPopover>
      )}
    </>
  );
}

export const EventChipSpec = createReactInlineContentSpec(
  {
    type: "eventChip" as const,
    propSchema: {
      chipId: { default: "0" }, title: { default: "Event" },
      date: { default: "" }, time: { default: "" }, color: { default: "#7c3aed" }, reminder: { default: "" },
    },
    content: "none",
  } as const,
  { render: (p) => <EventChipRenderer inlineContent={p.inlineContent as any} /> },
);

// ─────────────────────────────────────────────────────────────────────────────
// PLACE CHIP — name + subtitle (city/address) + colour
// ─────────────────────────────────────────────────────────────────────────────

const PLACE_COLOR_PRESETS = [
  "#0d9488", "#0ea5e9", "#10b981", "#6366f1",
  "#7c3aed", "#6b7280", "#f97316", "#ef4444",
];

function PlaceChipRenderer({ inlineContent }: {
  inlineContent: { props: { chipId: string; name: string; subtitle: string; color: string } };
}) {
  const { chipId, name, subtitle, color } = inlineContent.props as {
    chipId: string; name: string; subtitle: string; color: string;
  };
  const t = useTranslations("chips");
  const update = useUpdateChip();
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const [draftColor, setDraftColor] = useState(color);
  const ref = useRef<HTMLSpanElement>(null);

  const apply = () => {
    update("placeChip", chipId, { name: draftName.trim() || "Place", subtitle: draftSubtitle.trim(), color: draftColor });
    setOpen(false);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDraftName(name); setDraftSubtitle(subtitle); setDraftColor(color); setOpen(true); }}
        className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.75em] font-medium transition-all hover:opacity-80 active:scale-95"
        style={{ border: `1px solid ${color}55`, backgroundColor: color + "20", color }}
      >
        <MapPin size={10} className="shrink-0" />
        <span>{name}</span>
        {subtitle && (
          <><span className="opacity-40 select-none">·</span><span className="opacity-75">{subtitle}</span></>
        )}
      </span>
      {open && (
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)} onApply={apply}>
          <div className="space-y-2.5 p-3">
            <input
              type="text" value={draftName} onChange={(e) => setDraftName(e.target.value)}
              placeholder={t("place.namePlaceholder")}
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
            <input
              type="text" value={draftSubtitle} onChange={(e) => setDraftSubtitle(e.target.value)}
              placeholder={t("place.subtitlePlaceholder")}
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
            <div className="flex items-center gap-1.5">
              {PLACE_COLOR_PRESETS.map((c) => (
                <button key={c} onMouseDown={(e) => { e.preventDefault(); setDraftColor(c); }}
                  className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: draftColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                />
              ))}
              <input type="color" value={draftColor} onChange={(e) => setDraftColor(e.target.value)}
                className="ml-auto h-5 w-5 cursor-pointer rounded border-0 p-0" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ border: `1px solid ${draftColor}55`, backgroundColor: draftColor + "20", color: draftColor }}>
              <MapPin size={9} />
              <span>{draftName || t("place.namePlaceholder").replace("…", "")}</span>
              {draftSubtitle && <><span className="opacity-40">·</span><span className="opacity-75">{draftSubtitle}</span></>}
            </span>
          </div>
          <PopActions onCancel={() => setOpen(false)} onApply={apply} />
        </ChipPopover>
      )}
    </>
  );
}

export const PlaceChipSpec = createReactInlineContentSpec(
  {
    type: "placeChip" as const,
    propSchema: {
      chipId: { default: "0" }, name: { default: "Place" },
      subtitle: { default: "" }, color: { default: "#0d9488" },
    },
    content: "none",
  } as const,
  { render: (p) => <PlaceChipRenderer inlineContent={p.inlineContent as any} /> },
);

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS CHIP — bar | ring style, custom colour, unit, locale-aware
// ─────────────────────────────────────────────────────────────────────────────

const PROGRESS_COLOR_PRESETS = [
  "",        // auto
  "#3b82f6", "#6366f1", "#8b5cf6",
  "#10b981", "#22c55e", "#f97316", "#ef4444",
];

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 7, circ = 2 * Math.PI * r;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border/30" />
      <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round" transform="rotate(-90 9 9)"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}

function ProgressChipRenderer({ inlineContent }: {
  inlineContent: { props: { chipId: string; value: number; total: number; label: string; color: string; unit: string; style: string } };
}) {
  const { chipId, value, total, label, color: colorProp, unit, style } = inlineContent.props as {
    chipId: string; value: number; total: number; label: string; color: string; unit: string; style: string;
  };
  const locale = useLocale();
  const t = useTranslations("chips");
  const update = useUpdateChip();
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [draftTotal, setDraftTotal] = useState(total);
  const [draftLabel, setDraftLabel] = useState(label);
  const [draftColor, setDraftColor] = useState(colorProp);
  const [draftUnit, setDraftUnit] = useState(unit);
  const [draftStyle, setDraftStyle] = useState<"bar" | "ring">(style as "bar" | "ring" || "bar");
  const ref = useRef<HTMLSpanElement>(null);

  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const autoColor = pct >= 100 ? "#22c55e" : pct >= 60 ? "#3b82f6" : pct >= 30 ? "#f97316" : "#6b7280";
  const resolvedColor = colorProp || autoColor;
  const displayVal = unit
    ? `${new Intl.NumberFormat(locale).format(value)}\u202f${unit}`
    : `${pct}%`;

  const apply = () => {
    update("progressChip", chipId, {
      value: Math.min(draftValue, draftTotal), total: draftTotal,
      label: draftLabel.trim(), color: draftColor, unit: draftUnit, style: draftStyle,
    });
    setOpen(false);
  };

  const draftPct = draftTotal > 0 ? Math.round((Math.min(draftValue, draftTotal) / draftTotal) * 100) : 0;
  const draftAutoColor = draftPct >= 100 ? "#22c55e" : draftPct >= 60 ? "#3b82f6" : draftPct >= 30 ? "#f97316" : "#6b7280";
  const draftResolvedColor = draftColor || draftAutoColor;

  return (
    <>
      <span
        ref={ref}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDraftValue(value); setDraftTotal(total); setDraftLabel(label); setDraftColor(colorProp); setDraftUnit(unit); setDraftStyle(style as "bar" | "ring" || "bar"); setOpen(true); }}
        className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[0.75em] text-foreground/70 transition-colors hover:border-border/60 hover:bg-muted/50"
      >
        {label && <span className="font-medium text-foreground/60 mr-0.5">{label}</span>}
        {(style || "bar") === "ring" ? (
          <ProgressRing pct={pct} color={resolvedColor} />
        ) : (
          <span className="relative h-1 w-16 rounded-full bg-border/50 overflow-hidden">
            <span className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${pct}%`, backgroundColor: resolvedColor, transition: "width 0.4s ease" }} />
          </span>
        )}
        <span className="font-mono tabular-nums text-[0.95em]" style={{ color: resolvedColor }}>{displayVal}</span>
      </span>
      {open && (
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)} onApply={apply}>
          <div className="space-y-2.5 p-3">
            <input type="text" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)}
              placeholder={t("progress.label")} maxLength={20}
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{t("progress.value")}</p>
                <input type="number" value={draftValue} min={0} max={draftTotal}
                  onChange={(e) => setDraftValue(Math.max(0, Math.min(Number(e.target.value), draftTotal)))}
                  className="w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{t("progress.total")}</p>
                <input type="number" value={draftTotal} min={1}
                  onChange={(e) => setDraftTotal(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
              </div>
            </div>
            <input type="text" value={draftUnit} onChange={(e) => setDraftUnit(e.target.value)}
              placeholder={t("progress.unit")}
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
            <div className="flex flex-wrap items-center gap-1.5">
              {PROGRESS_COLOR_PRESETS.map((c, i) => (
                <button key={i} onMouseDown={(e) => { e.preventDefault(); setDraftColor(c); }}
                  className="h-5 w-5 shrink-0 rounded-full border border-border/40 transition-transform hover:scale-110"
                  style={{ backgroundColor: c || draftAutoColor, outline: draftColor === c ? `2px solid ${c || draftAutoColor}` : "none", outlineOffset: "2px" }}
                  title={c || "Auto"} />
              ))}
              <input type="color" value={draftColor || draftAutoColor} onChange={(e) => setDraftColor(e.target.value)}
                className="h-5 w-5 shrink-0 cursor-pointer rounded border-0 p-0" />
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(["bar", "ring"] as const).map((s) => (
                <button key={s} onMouseDown={(e) => { e.preventDefault(); setDraftStyle(s); }}
                  className={cn("rounded-lg py-1.5 text-[11px] font-semibold capitalize transition-colors",
                    draftStyle === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                  {t(`progress.${s}` as any)}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px]">
              <span className="text-muted-foreground">{draftLabel || t("progress.label")}</span>
              <div className="flex items-center gap-1.5">
                {draftStyle === "ring" ? <ProgressRing pct={draftPct} color={draftResolvedColor} /> : (
                  <span className="relative h-1 w-14 rounded-full bg-border/50 overflow-hidden">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${draftPct}%`, backgroundColor: draftResolvedColor }} />
                  </span>
                )}
                <span className="font-mono tabular-nums" style={{ color: draftResolvedColor }}>
                  {draftUnit ? `${draftValue}\u202f${draftUnit}` : `${draftPct}%`}
                </span>
              </div>
            </div>
          </div>
          <PopActions onCancel={() => setOpen(false)} onApply={apply} />
        </ChipPopover>
      )}
    </>
  );
}

export const ProgressChipSpec = createReactInlineContentSpec(
  {
    type: "progressChip" as const,
    propSchema: {
      chipId: { default: "0" }, value: { default: 0 }, total: { default: 10 },
      label: { default: "" }, color: { default: "" }, unit: { default: "" }, style: { default: "bar" },
    },
    content: "none",
  } as const,
  { render: (p) => <ProgressChipRenderer inlineContent={p.inlineContent as any} /> },
);

// ─────────────────────────────────────────────────────────────────────────────
// CHECKBOX CHIP — simple inline checkbox for table cells and inline use
// ─────────────────────────────────────────────────────────────────────────────

function CheckboxChipRenderer({ inlineContent }: {
  inlineContent: { props: { chipId: string; checked: boolean } };
}) {
  const { chipId, checked } = inlineContent.props as { chipId: string; checked: boolean };
  const update = useUpdateChip();
  const [isChecked, setIsChecked] = useState(checked);

  // Sync local state when props change
  useEffect(() => {
    setIsChecked(checked);
  }, [checked]);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newChecked = !isChecked;
    setIsChecked(newChecked);
    update("checkboxChip", chipId, { checked: newChecked });
  }, [isChecked, chipId, update]);

  return (
    <span
      onMouseDown={toggle}
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center rounded transition-all duration-150 ease-out",
        "h-4 w-4 shrink-0 border",
        isChecked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-transparent hover:border-primary/50"
      )}
      role="checkbox"
      aria-checked={isChecked}
    >
      <Check size={10} strokeWidth={3} />
    </span>
  );
}

export const CheckboxChipSpec = createReactInlineContentSpec(
  {
    type: "checkboxChip" as const,
    propSchema: {
      chipId: { default: "0" },
      checked: { default: false },
    },
    content: "none",
  } as const,
  { render: (p) => <CheckboxChipRenderer inlineContent={p.inlineContent as any} /> },
);

// ─────────────────────────────────────────────────────────────────────────────
// REFERENCE CHIP — links a task or project from the user's workspace inline
// ─────────────────────────────────────────────────────────────────────────────

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "#6b7280", in_progress: "#3b82f6", in_review: "#f97316",
  done: "#22c55e", cancelled: "#9ca3af",
};

function getTaskStatusColor(status: string) {
  return TASK_STATUS_COLORS[status] ?? "#6b7280";
}

interface RefItem { type: "task" | "project"; id: string; title: string; status: string; color: string; dueDate?: string; assignee?: string; priority?: string }

function RefChipPicker({ onSelect }: { onSelect: (item: RefItem) => void }) {
  const tc = useTranslations("chips");
  const tt = useTranslations("tasks");
  const [tab, setTab] = useState<"task" | "project">("task");
  const [q, setQ] = useState("");
  const tasks = useQuery(api.tasks.getMyTasks, {}) ?? [];
  const projects = useQuery(api.projects.getMyProjects, {}) ?? [];

  const filtered = (tab === "task" ? tasks : projects).filter((item: any) => {
    const name = tab === "task" ? item.title : item.name;
    return name?.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(["task", "project"] as const).map((tp) => (
          <button key={tp} onMouseDown={(e) => { e.preventDefault(); setTab(tp); setQ(""); }}
            className={cn("flex-1 rounded-md py-1 text-xs font-semibold transition-colors",
              tab === tp ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}>{tp === "task" ? tc("ref.tasks") : tc("ref.projects")}</button>
        ))}
      </div>
      <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={tc("search")}
        className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
      <div className="max-h-36 overflow-y-auto space-y-0.5 rounded-lg border border-border/40 p-1">
        {(filtered as any[]).slice(0, 8).map((item) => {
          const label = tab === "task" ? item.title : item.name;
          const itemColor = tab === "task" ? getTaskStatusColor(item.status) : (item.color ?? "#6366f1");
          const dueDate = tab === "task" && item.dueDate
            ? new Date(item.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : undefined;
          const isPast = tab === "task" && item.dueDate && item.dueDate < Date.now() && item.status !== "done";
          return (
            <button key={item._id}
              onMouseDown={(e) => { e.preventDefault(); onSelect({ type: tab, id: item._id, title: label, status: item.status ?? "", color: itemColor, dueDate: item.dueDate ? String(item.dueDate) : undefined, assignee: item.assigneeName ?? undefined, priority: item.priority ?? undefined }); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: itemColor }} />
              <div className="flex-1 min-w-0">
                <span className="block truncate text-[13px] font-medium">{label}</span>
                {(item.assigneeName || dueDate) && (
                  <span className="flex items-center gap-1.5 mt-0.5">
                    {item.assigneeName && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[12ch]">{item.assigneeName}</span>
                    )}
                    {dueDate && (
                      <span className={cn("text-[10px] font-medium tabular-nums", isPast ? "text-red-500" : "text-muted-foreground")}>
                        {dueDate}
                      </span>
                    )}
                  </span>
                )}
              </div>
              {tab === "task" && item.status && (
                <span
                  className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold"
                  style={{ backgroundColor: itemColor + "20", color: itemColor }}
                >
                  {(() => { try { return tt(`statuses.${item.status}` as any); } catch { return item.status.replace(/_/g, " "); } })()}
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-3 text-center text-xs text-muted-foreground">
            {tasks === undefined || projects === undefined ? tc("loading") : tc("noResults")}
          </p>
        )}
      </div>
    </div>
  );
}

function RefChipRenderer({ inlineContent }: {
  inlineContent: { props: { chipId: string; refType: string; refId: string; refTitle: string; refStatus: string; refColor: string } };
}) {
  const { chipId, refType, refId, refTitle, refStatus, refColor } = inlineContent.props as {
    chipId: string; refType: string; refId: string; refTitle: string; refStatus: string; refColor: string;
  };
  const tc = useTranslations("chips");
  const tt = useTranslations("tasks");
  const update = useUpdateChip();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const statusLabel = refStatus
    ? (() => { try { return tt(`statuses.${refStatus}` as any); } catch { return refStatus.replace(/_/g, " "); } })()
    : null;

  const handleSelect = (item: RefItem) => {
    update("refChip", chipId, { refType: item.type, refId: item.id, refTitle: item.title, refStatus: item.status, refColor: item.color, refDueDate: item.dueDate ?? "", refAssignee: item.assignee ?? "", refPriority: item.priority ?? "" });
    setOpen(false);
  };

  const navigate = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (refId) router.push(`/${refType === "task" ? "tasks" : "projects"}/${refId}`);
  };

  const { refDueDate, refAssignee, refPriority } = inlineContent.props as any;
  const dotColor = refColor || "#6b7280";
  const dueDateNum = refDueDate ? Number(refDueDate) : null;
  const isPastDue = dueDateNum && dueDateNum < Date.now() && refStatus !== "done";
  const dueDateLabel = dueDateNum
    ? new Date(dueDateNum).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <>
      <span
        ref={ref}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="inline-flex cursor-pointer select-none items-center gap-1 rounded-md border border-border/40 bg-muted/20 px-1.5 py-0.5 text-[0.75em] font-medium text-foreground/80 transition-all hover:border-border/70 hover:bg-muted/50"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
        {refType === "task"
          ? <ListTodo size={10} className="shrink-0 text-muted-foreground/60" />
          : <FolderKanban size={10} className="shrink-0 text-muted-foreground/60" />}
        <span className="max-w-[14ch] truncate">{refTitle || (refType === "task" ? tc("ref.task") : tc("ref.project"))}</span>
        {statusLabel && (
          <span
            className="shrink-0 rounded-full px-1.5 py-px text-[0.8em] font-semibold"
            style={{ backgroundColor: dotColor + "20", color: dotColor }}
          >{statusLabel}</span>
        )}
        {dueDateLabel && (
          <span className={cn("shrink-0 text-[0.75em] font-medium", isPastDue ? "text-red-500" : "text-muted-foreground/60")}>
            {dueDateLabel}
          </span>
        )}
      </span>
      {open && (
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)} onApply={() => setOpen(false)}>
          <div className="p-3 space-y-2.5">
            {refId && (
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                  <span className="flex-1 text-[12px] font-semibold truncate">{refTitle}</span>
                  {statusLabel && (
                    <span className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold" style={{ backgroundColor: dotColor + "20", color: dotColor }}>{statusLabel}</span>
                  )}
                </div>
                {(refAssignee || dueDateLabel) && (
                  <div className="flex items-center gap-3 pl-4">
                    {refAssignee && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <UserIcon size={8} className="shrink-0" />{refAssignee}
                      </span>
                    )}
                    {dueDateLabel && (
                      <span className={cn("text-[10px] font-medium tabular-nums", isPastDue ? "text-red-500" : "text-muted-foreground")}>
                        {dueDateLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            <RefChipPicker onSelect={handleSelect} />
            {refId && (
              <button onMouseDown={navigate}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/40 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                <ExternalLink size={11} />
                {tc("ref.open", { type: refType === "task" ? tc("ref.task") : tc("ref.project") })}
              </button>
            )}
          </div>
        </ChipPopover>
      )}
    </>
  );
}

export const RefChipSpec = createReactInlineContentSpec(
  {
    type: "refChip" as const,
    propSchema: {
      chipId: { default: "0" }, refType: { default: "task" },
      refId: { default: "" }, refTitle: { default: "" },
      refStatus: { default: "" }, refColor: { default: "" },
    },
    content: "none",
  } as const,
  { render: (p) => <RefChipRenderer inlineContent={p.inlineContent as any} /> },
);

// ─────────────────────────────────────────────────────────────────────────────
// Slash menu items (for the / menu) — returns DefaultReactSuggestionItem shape
// ─────────────────────────────────────────────────────────────────────────────

function ChipMenuIcon({ children }: { color?: string; children: React.ReactNode }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-foreground">
      {children}
    </span>
  );
}

export function buildChipSlashMenuItems(editor: any, t?: (key: string) => string): Array<{
  title: string;
  subtext: string;
  icon: JSX.Element;
  group: string;
  aliases: string[];
  onItemClick: () => void;
}> {
  const today = todayInParis();
  const tr = (key: string, fallback: string) => t ? t(key) : fallback;
  return [
    {
      title: tr("menu.color", "Color"),
      subtext: tr("menu.colorSubtext", "Inline color swatch — HEX, RGB or HSL"),
      icon: <ChipMenuIcon><Palette size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["color", "hex", "rgb", "hsl", "swatch", "chip"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "colorChip", props: { chipId: genChipId(), color: "#3b82f6", format: "hex" } }, " "]),
    },
    {
      title: tr("menu.date", "Date"),
      subtext: tr("menu.dateSubtext", "Smart date — relative, short or long"),
      icon: <ChipMenuIcon><Calendar size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["date", "time", "calendar", "day", "when", "chip"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "dateChip", props: { chipId: genChipId(), date: today, format: "short" } }, " "]),
    },
    {
      title: tr("menu.badge", "Badge"),
      subtext: tr("menu.badgeSubtext", "Colored label — status, tag, category"),
      icon: <ChipMenuIcon><Tag size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["badge", "label", "tag", "status", "chip", "pill"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "badgeChip", props: { chipId: genChipId(), text: "In Progress", bgColor: "#3b82f6", emoji: "" } }, " "]),
    },
    {
      title: tr("menu.progress", "Progress"),
      subtext: tr("menu.progressSubtext", "Inline progress bar with percentage"),
      icon: <ChipMenuIcon><BarChart2 size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["progress", "tracker", "counter", "bar", "chip", "percent"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "progressChip", props: { chipId: genChipId(), value: 0, total: 10, label: "", color: "", unit: "", style: "bar" } }, " "]),
    },
    {
      title: tr("menu.status", "Status"),
      subtext: tr("menu.statusSubtext", "Todo · In Progress · Done · Blocked"),
      icon: <ChipMenuIcon><CheckCircle2 size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["status", "todo", "done", "blocked", "state", "chip"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "badgeChip", props: { chipId: genChipId(), text: "Todo", bgColor: "#6b7280", emoji: "" } }, " "]),
    },
    {
      title: tr("menu.checkbox", "Checkbox"),
      subtext: tr("menu.checkboxSubtext", "Inline checkbox — works in tables & text"),
      icon: <ChipMenuIcon><CheckSquare size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["checkbox", "check", "tick", "box", "table", "cell"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "checkboxChip", props: { chipId: genChipId(), checked: false } }, " "]),
    },
    {
      title: tr("menu.event", "Event"),
      subtext: tr("menu.eventSubtext", "Event or meeting — title, date, time & colour"),
      icon: <ChipMenuIcon><CalendarDays size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["event", "meeting", "appointment", "calendar", "chip"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "eventChip", props: { chipId: genChipId(), title: "Event", date: today, time: "", color: "#7c3aed", reminder: "" } }, " "]),
    },
    {
      title: tr("menu.place", "Place"),
      subtext: tr("menu.placeSubtext", "Location — name, city or address"),
      icon: <ChipMenuIcon><MapPin size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["place", "location", "city", "address", "map", "chip"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "placeChip", props: { chipId: genChipId(), name: "Place", subtitle: "", color: "#0d9488" } }, " "]),
    },
    {
      title: tr("menu.taskRef", "Task ref"),
      subtext: tr("menu.taskRefSubtext", "Link to one of your tasks inline"),
      icon: <ChipMenuIcon><ListTodo size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["task", "ref", "reference", "link", "chip"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "refChip", props: { chipId: genChipId(), refType: "task", refId: "", refTitle: "Task", refStatus: "todo", refColor: "#6b7280" } }, " "]),
    },
    {
      title: tr("menu.projectRef", "Project ref"),
      subtext: tr("menu.projectRefSubtext", "Link to one of your projects inline"),
      icon: <ChipMenuIcon><FolderKanban size={13} /></ChipMenuIcon>,
      group: tr("menu.group", "Smart Chips"),
      aliases: ["project", "ref", "reference", "link", "chip"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "refChip", props: { chipId: genChipId(), refType: "project", refId: "", refTitle: "Project", refStatus: "", refColor: "#6366f1" } }, " "]),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy ~ trigger menu builder (kept for backwards compat)
// ─────────────────────────────────────────────────────────────────────────────

export function buildChipMenuItems(editor: any, query: string) {
  const items = buildChipSlashMenuItems(editor);
  const q = query.toLowerCase();
  return items
    .filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.aliases ?? []).some((a) => a.includes(q)),
    )
    .map((item) => ({ ...item, group: "Smart Chips" }));
}
