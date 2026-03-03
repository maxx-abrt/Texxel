"use client";

import { createReactInlineContentSpec, useBlockNoteEditor } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

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

function contrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#fff";
  const lum = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return (0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2]) > 0.179 ? "#111827" : "#ffffff";
}

// ─────────────────────────────────────────────────────────────────────────────
// Date utilities
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, fmt: "relative" | "short" | "long"): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (fmt === "relative") {
      const diff = Math.round((d.getTime() - Date.now()) / 86_400_000);
      if (diff === 0) return "Today";
      if (diff === 1) return "Tomorrow";
      if (diff === -1) return "Yesterday";
      if (diff > 1 && diff < 8) return `In ${diff} days`;
      if (diff < -1 && diff > -8) return `${Math.abs(diff)} days ago`;
    }
    if (fmt === "short") return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return d.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
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
      if (updated) pm.dispatch(tr);
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
  children: React.ReactNode;
}

function ChipPopover({ anchor, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const POP_H = 260, POP_W = 240;
    setPos({
      top: window.innerHeight - r.bottom > POP_H ? r.bottom + 4 : r.top - POP_H - 4,
      left: window.innerWidth - r.left > POP_W ? r.left : r.right - POP_W,
    });
  }, [anchor]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchor && !anchor.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [anchor, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
      className="w-60 rounded-xl border border-border bg-popover shadow-2xl text-sm"
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
  return (
    <div className="flex gap-2 px-3 pb-3">
      <button
        onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
        className="flex-1 rounded-lg border py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
      >Cancel</button>
      <button
        onMouseDown={(e) => { e.preventDefault(); onApply(); }}
        className="flex-1 rounded-lg bg-primary py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
      >Apply</button>
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
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)}>
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
  const update = useUpdateChip();
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(date);
  const [draftFmt, setDraftFmt] = useState<"relative" | "short" | "long">(format);
  const ref = useRef<HTMLSpanElement>(null);

  const apply = () => { update("dateChip", chipId, { date: draftDate, format: draftFmt }); setOpen(false); };

  return (
    <>
      <span
        ref={ref}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDraftDate(date); setDraftFmt(format); setOpen(true); }}
        className="relative inline-flex cursor-pointer select-none items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[0.8em] font-medium text-blue-700 transition-all hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
      >
        <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 7h12M5 1v4M11 1v4" />
        </svg>
        {formatDate(date, format)}
      </span>
      {open && (
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)}>
          <div className="space-y-3 p-3">
            <input
              type="date" value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="grid grid-cols-3 gap-1">
              {(["relative", "short", "long"] as const).map((f) => (
                <button key={f} onMouseDown={(e) => { e.preventDefault(); setDraftFmt(f); }}
                  className={cn("rounded-lg py-1 text-[10px] font-bold capitalize tracking-wide transition-colors",
                    draftFmt === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}>{f}</button>
              ))}
            </div>
            <p className="rounded-lg bg-muted/50 py-1 text-center text-[11px] text-muted-foreground">
              {formatDate(draftDate, draftFmt)}
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

const BADGE_PRESETS = [
  { bg: "#ef4444", emoji: "🚨", text: "Urgent" },
  { bg: "#f97316", emoji: "⚡", text: "Active" },
  { bg: "#22c55e", emoji: "✅", text: "Done" },
  { bg: "#3b82f6", emoji: "💡", text: "Idea" },
  { bg: "#8b5cf6", emoji: "📝", text: "Draft" },
  { bg: "#ec4899", emoji: "❤️", text: "Important" },
  { bg: "#14b8a6", emoji: "🔄", text: "Review" },
  { bg: "#6b7280", emoji: "🔒", text: "Private" },
  { bg: "#0d9488", emoji: "📍", text: "Place" },
  { bg: "#7c3aed", emoji: "🎉", text: "Event" },
  { bg: "#d97706", emoji: "⚠️", text: "Warning" },
  { bg: "#065f46", emoji: "✔️", text: "Approved" },
];

function BadgeChipRenderer({ inlineContent }: {
  inlineContent: { props: { chipId: string; text: string; bgColor: string; emoji: string } };
}) {
  const { chipId, text, bgColor, emoji } = inlineContent.props;
  const update = useUpdateChip();
  const [open, setOpen] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const [draftBg, setDraftBg] = useState(bgColor);
  const [draftEmoji, setDraftEmoji] = useState(emoji);
  const ref = useRef<HTMLSpanElement>(null);

  const textColor = contrastColor(bgColor);
  const apply = () => {
    update("badgeChip", chipId, { text: draftText.trim() || "Badge", bgColor: draftBg, emoji: draftEmoji });
    setOpen(false);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDraftText(text); setDraftBg(bgColor); setDraftEmoji(emoji); setOpen(true); }}
        className="relative inline-flex cursor-pointer select-none items-center gap-1 rounded-full px-2 py-0.5 text-[0.75em] font-semibold transition-all hover:opacity-90 active:scale-95"
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        {emoji && <span className="leading-none">{emoji}</span>}
        <span>{text}</span>
      </span>
      {open && (
        <ChipPopover anchor={ref.current} onClose={() => setOpen(false)}>
          {/* Preset grid */}
          <div className="grid grid-cols-3 gap-1 p-3 pb-2">
            {BADGE_PRESETS.map((p) => (
              <button
                key={p.bg + p.text}
                onMouseDown={(e) => { e.preventDefault(); setDraftEmoji(p.emoji); setDraftText(p.text); setDraftBg(p.bg); }}
                className="truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-transform hover:scale-105"
                style={{ backgroundColor: p.bg, color: contrastColor(p.bg) }}
                title={`${p.emoji} ${p.text}`}
              >{p.emoji} {p.text}</button>
            ))}
          </div>

          <div className="border-t border-border/50 px-3 py-2 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text" value={draftEmoji} onChange={(e) => setDraftEmoji(e.target.value)}
                placeholder="😀" maxLength={2}
                className="w-10 rounded-lg border px-1.5 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text" value={draftText} onChange={(e) => setDraftText(e.target.value)}
                placeholder="Label…"
                className="flex-1 rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color" value={draftBg} onChange={(e) => setDraftBg(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded-lg border-0 p-0.5"
              />
              <div
                className="flex h-7 flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: draftBg, color: contrastColor(draftBg) }}
              >
                {draftEmoji && <span>{draftEmoji}</span>}
                <span>{draftText || "Preview"}</span>
              </div>
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
// Suggestion menu items builder (called inside SuggestionMenuController)
// ─────────────────────────────────────────────────────────────────────────────

export function buildChipMenuItems(editor: any, query: string) {
  const today = new Date().toISOString().split("T")[0];

  const all = [
    {
      title: "Color",
      subtext: "HEX · RGB · HSL color swatch",
      icon: "🎨",
      group: "Smart chips",
      aliases: ["color", "hex", "rgb", "hsl", "swatch"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "colorChip", props: { chipId: genChipId(), color: "#3b82f6", format: "hex" } }, " "]),
    },
    {
      title: "Date",
      subtext: "Formatted date — relative, short or long",
      icon: "📅",
      group: "Smart chips",
      aliases: ["date", "time", "calendar", "day", "when"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "dateChip", props: { chipId: genChipId(), date: today, format: "short" } }, " "]),
    },
    {
      title: "Badge",
      subtext: "Custom label with colour",
      icon: "🏷️",
      group: "Smart chips",
      aliases: ["badge", "label", "tag", "status", "chip"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "badgeChip", props: { chipId: genChipId(), text: "Badge", bgColor: "#6366f1", emoji: "" } }, " "]),
    },
    {
      title: "Event",
      subtext: "Event or meeting label",
      icon: "🎉",
      group: "Smart chips",
      aliases: ["event", "meeting", "appointment"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "badgeChip", props: { chipId: genChipId(), text: "Event", bgColor: "#7c3aed", emoji: "🎉" } }, " "]),
    },
    {
      title: "Place",
      subtext: "Location or place chip",
      icon: "📍",
      group: "Smart chips",
      aliases: ["place", "location", "city", "address"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "badgeChip", props: { chipId: genChipId(), text: "Place", bgColor: "#0d9488", emoji: "📍" } }, " "]),
    },
    {
      title: "Status",
      subtext: "Todo · In Progress · Done · Blocked",
      icon: "📊",
      group: "Smart chips",
      aliases: ["status", "todo", "done", "progress", "blocked", "state"],
      onItemClick: () =>
        editor.insertInlineContent([{ type: "badgeChip", props: { chipId: genChipId(), text: "Todo", bgColor: "#6b7280", emoji: "⬜" } }, " "]),
    },
  ];

  const q = query.toLowerCase();
  return all.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      (item.aliases ?? []).some((a) => a.includes(q)),
  );
}
