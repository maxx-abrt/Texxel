"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, btnPrimary, btnOutline, btnGhost, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Calendar as CalIcon, ArrowLeft2, ArrowRight2, Add, Trash, Repeat, TaskSquare } from "iconsax-reactjs";
import { expandEvents } from "@/lib/recurrence";

const EVENT_COLORS = ["#fb5648", "#2f7ea6", "#2fbf9b", "#d98324", "#7c5cff"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_MS = 86_400_000;

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfWeek(d: Date) { const s = startOfDay(d); const off = (s.getDay() + 6) % 7; s.setDate(s.getDate() - off); return s; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); }
function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

type ViewMode = "month" | "week" | "day";
const RECUR_OPTIONS = ["none", "daily", "weekly", "monthly"] as const;

export function CalendarView() {
  const search = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const { activeWorkspaceId } = useWorkspace();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const events = useQuery(api.flux_events.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const create = useMutation(api.flux_events.create);
  const update = useMutation(api.flux_events.update);
  const remove = useMutation(api.flux_events.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [seedDate, setSeedDate] = useState<Date | null>(null);
  const [seedEnd, setSeedEnd] = useState<Date | null>(null);
  const [recurOpts, setRecurOpts] = useState<any | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskSeedDate, setTaskSeedDate] = useState<Date | null>(null);
  const detachOccurrence = useMutation(api.flux_events.detachOccurrence);
  const skipOccurrence = useMutation(api.flux_events.skipOccurrence);
  const createTask = useMutation(api.flux_tasks.create);

  const WEEKDAYS = [t("weekdays.mon"), t("weekdays.tue"), t("weekdays.wed"), t("weekdays.thu"), t("weekdays.fri"), t("weekdays.sat"), t("weekdays.sun")];
  const RECUR_LABEL: Record<string, string> = {
    none: t("recurrence.none"),
    daily: t("recurrence.daily"),
    weekly: t("recurrence.weekly"),
    monthly: t("recurrence.monthly"),
    biweekly: t("recurrence.biweekly"), // legacy read-only label
  };
  const VIEW_LABEL: Record<ViewMode, string> = { month: t("month"), week: t("week"), day: t("day") };
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  useEffect(() => { if (search.get("new") === "1") { setSeedDate(new Date()); setSeedEnd(null); setEditing(null); setDialogOpen(true); } }, [search]);

  // Visible range for the active view.
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (view === "day") { const s = startOfDay(cursor); return [s.getTime(), s.getTime() + DAY_MS]; }
    if (view === "week") { const s = startOfWeek(cursor); return [s.getTime(), s.getTime() + 7 * DAY_MS]; }
    const first = startOfMonth(cursor); const off = (first.getDay() + 6) % 7;
    const gridStart = new Date(first); gridStart.setDate(first.getDate() - off);
    return [gridStart.getTime(), gridStart.getTime() + 42 * DAY_MS];
  }, [view, cursor]);

  const expanded = useMemo(() => expandEvents(events ?? [], rangeStart, rangeEnd), [events, rangeStart, rangeEnd]);

  const openNew = (start: Date, end?: Date) => { setSeedDate(start); setSeedEnd(end ?? null); setEditing(null); setDialogOpen(true); };
  const openEdit = (e: any) => {
    if (e._recurring) { setRecurOpts(e); return; }
    setEditing(e); setSeedDate(null); setSeedEnd(null); setDialogOpen(true);
  };
  const openTaskCreate = (d: Date) => { setTaskSeedDate(d); setTaskDialogOpen(true); };

  const navigate = (dir: number) => {
    if (view === "day") setCursor(new Date(cursor.getTime() + dir * DAY_MS));
    else if (view === "week") setCursor(new Date(cursor.getTime() + dir * 7 * DAY_MS));
    else setCursor(addMonths(cursor, dir));
  };

  const headerLabel = view === "day"
    ? cursor.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : view === "week"
      ? t("weekOf", { date: startOfWeek(cursor).toLocaleDateString(locale, { month: "short", day: "numeric" }) })
      : cursor.toLocaleDateString(locale, { month: "long", year: "numeric" });

  return (
    <PageContainer className="max-w-[1280px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--flux-coral-soft)] text-primary"><CalIcon variant="Bulk" size={24} /></span>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl" data-testid="calendar-month-label">{headerLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-border bg-card p-0.5" data-testid="calendar-view-switch">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)} data-testid={`calendar-view-${v}`} className={cn("h-8 rounded-full px-3 text-sm", view === v ? "bg-muted font-medium" : "text-muted-foreground")}>{VIEW_LABEL[v]}</button>
            ))}
          </div>
          <div className="flex items-center rounded-full border border-border bg-card">
            <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-l-full hover:bg-muted" data-testid="calendar-prev"><ArrowLeft2 variant="Bulk" size={18} /></button>
            <button onClick={() => setCursor(new Date())} className="h-9 px-3 text-sm font-medium hover:bg-muted">{t("today")}</button>
            <button onClick={() => navigate(1)} className="flex h-9 w-9 items-center justify-center rounded-r-full hover:bg-muted" data-testid="calendar-next"><ArrowRight2 variant="Bulk" size={18} /></button>
          </div>
          <button onClick={() => openNew(new Date())} className={btnPrimary} data-testid="new-event-btn"><Add variant="Bulk" size={18} /> {t("newEvent")}</button>
        </div>
      </div>

      {view === "month" && <MonthView cursor={cursor} events={expanded} onDay={openNew} onEvent={openEdit} onTaskCreate={openTaskCreate} weekdays={WEEKDAYS} t={t} tc={tc} fmtTime={fmtTime} />}
      {view === "week" && <WeekTimeGrid days={7} startDate={startOfWeek(cursor)} events={expanded} onSlot={openNew} onEvent={openEdit} locale={locale} t={t} />}
      {view === "day" && <WeekTimeGrid days={1} startDate={startOfDay(cursor)} events={expanded} onSlot={openNew} onEvent={openEdit} locale={locale} t={t} />}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing}
        seedDate={seedDate}
        seedEnd={seedEnd}
        recurLabel={RECUR_LABEL}
        t={t}
        tc={tc}
        onSave={async (data: any) => {
          if (editing) { await update({ eventId: editing._id, ...data }); toast.success(t("eventUpdated")); }
          else { if (!activeWorkspaceId) return; await create({ workspaceId: activeWorkspaceId, ...data }); toast.success(t("eventCreated")); }
          setDialogOpen(false);
        }}
        onDelete={editing ? async () => { await remove({ eventId: editing._id }); toast.success(t("eventDeleted")); setDialogOpen(false); } : undefined}
      />

      {/* Recurring event occurrence options dialog */}
      <Dialog open={!!recurOpts} onOpenChange={(o) => !o && setRecurOpts(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>{t("editRecurring") ?? "Edit recurring event"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("editRecurringDesc") ?? "Which occurrences do you want to modify?"}</p>
          <div className="space-y-2">
            <button className={cn(btnOutline, "w-full justify-start")} onClick={() => {
              if (!recurOpts) return;
              detachOccurrence({ eventId: recurOpts._id, occurrenceStart: recurOpts._occurrenceStart })
                .then((newId: any) => { setRecurOpts(null); setEditing({ ...recurOpts, _id: newId, _recurring: false }); setSeedDate(null); setSeedEnd(null); setDialogOpen(true); })
                .catch(() => toast.error("Failed to detach occurrence"));
            }}>{t("editThisOccurrence") ?? "Edit this occurrence only"}</button>
            <button className={cn(btnOutline, "w-full justify-start")} onClick={() => {
              const e = recurOpts; setRecurOpts(null);
              setEditing(e); setSeedDate(null); setSeedEnd(null); setDialogOpen(true);
            }}>{t("editAllOccurrences") ?? "Edit all occurrences"}</button>
            <button className={cn(btnOutline, "w-full justify-start text-destructive border-destructive/40")} onClick={() => {
              if (!recurOpts) return;
              skipOccurrence({ eventId: recurOpts._id, occurrenceStart: recurOpts._occurrenceStart })
                .then(() => { toast.success(t("eventDeleted") ?? "Occurrence deleted"); setRecurOpts(null); })
                .catch(() => toast.error("Failed"));
            }}>{t("deleteThisOccurrence") ?? "Delete this occurrence only"}</button>
            <button className={cn(btnOutline, "w-full justify-start text-destructive border-destructive/40")} onClick={() => {
              if (!recurOpts) return;
              remove({ eventId: recurOpts._id })
                .then(() => { toast.success(t("eventDeleted") ?? "Event deleted"); setRecurOpts(null); })
                .catch(() => toast.error("Failed"));
            }}>{t("deleteAllOccurrences") ?? "Delete all occurrences"}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick task create from calendar day */}
      <QuickTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        seedDate={taskSeedDate}
        workspaceId={activeWorkspaceId}
        onCreate={createTask}
        t={t}
        tc={tc}
      />
    </PageContainer>
  );
}

/* ───────────────────────── Month view ───────────────────────── */
function MonthView({ cursor, events, onDay, onEvent, onTaskCreate, weekdays, t, tc, fmtTime }: any) {
  const today = new Date();
  const weeks = useMemo(() => {
    const first = startOfMonth(cursor);
    const off = (first.getDay() + 6) % 7;
    const gridStart = new Date(first); gridStart.setDate(first.getDate() - off);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); days.push(d); }
    return days;
  }, [cursor]);
  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of events) { const k = dayKey(new Date(e.start)); (map.get(k) ?? map.set(k, []).get(k))!.push(e); }
    return map;
  }, [events]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {weekdays.map((d: string) => <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {weeks.map((day, idx) => {
          const dayEvents = byDay.get(dayKey(day)) ?? [];
          const isCurrentMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, today);
          return (
            <div key={idx} data-testid="calendar-day"
              className={cn("group relative min-h-[92px] border-b border-r border-border p-1.5 text-left align-top", !isCurrentMonth && "bg-muted/20 text-muted-foreground", idx % 7 === 6 && "border-r-0")}>
              <div className="flex items-center justify-between">
                <span onClick={() => onDay(day)} className={cn("inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-xs hover:bg-muted", isToday && "bg-primary font-bold text-primary-foreground hover:bg-primary")}>{day.getDate()}</span>
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => onDay(day)} title={t("newEvent")} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"><Add size={12} /></button>
                  <button onClick={(ev) => { ev.stopPropagation(); onTaskCreate(day); }} title="New task" className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"><TaskSquare variant="Bulk" size={12} /></button>
                </div>
              </div>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((e: any) => (
                  <span key={e._occId ?? e._id} onClick={() => onEvent(e)}
                    className="flex cursor-pointer items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: e.color ?? "var(--flux-coral)" }} data-testid="calendar-event">
                    {e._recurring && <Repeat size={9} />}{!e.allDay && <span className="opacity-80">{fmtTime(e.start)}</span>} {e.title}
                  </span>
                ))}
                {dayEvents.length > 3 && <span className="px-1 text-[10px] text-muted-foreground">{t("more", { count: dayEvents.length - 3 })}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Week / Day time grid ───────────────────────── */
function WeekTimeGrid({ days, startDate, events, onSlot, onEvent, locale, t }: any) {
  const today = new Date();
  const dayList = Array.from({ length: days }, (_, i) => new Date(startDate.getTime() + i * DAY_MS));
  const HOUR_H = 48; // px per hour
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const allDayByDay = (d: Date) => events.filter((e: any) => e.allDay && sameDay(new Date(e.start), d));
  const timedByDay = (d: Date) => events.filter((e: any) => !e.allDay && sameDay(new Date(e.start), d));

  // Drag-to-create state: { dayIndex, hour } for start and current hover
  const [dragStart, setDragStart] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ dayIndex: number; hour: number } | null>(null);
  const isDragging = dragStart !== null;

  const dragMin = dragStart && dragCurrent ? Math.min(dragStart.hour, dragCurrent.hour) : null;
  const dragMax = dragStart && dragCurrent ? Math.max(dragStart.hour, dragCurrent.hour) + 1 : null;

  const handleSlotMouseDown = (dayIndex: number, hour: number) => {
    setDragStart({ dayIndex, hour });
    setDragCurrent({ dayIndex, hour });
  };

  const handleSlotMouseEnter = (dayIndex: number, hour: number) => {
    if (isDragging) setDragCurrent({ dayIndex, hour });
  };

  const handleMouseUp = useCallback(() => {
    if (dragStart && dragCurrent) {
      const d = dayList[dragStart.dayIndex];
      const startH = Math.min(dragStart.hour, dragCurrent.hour);
      const endH = Math.max(dragStart.hour, dragCurrent.hour) + 1;
      const start = new Date(d); start.setHours(startH, 0, 0, 0);
      const end = new Date(d); end.setHours(endH, 0, 0, 0);
      if (dragStart.dayIndex === dragCurrent.dayIndex) {
        onSlot(start, end);
      } else {
        onSlot(start);
      }
    }
    setDragStart(null);
    setDragCurrent(null);
  }, [dragStart, dragCurrent, dayList, onSlot]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [isDragging, handleMouseUp]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid={days === 1 ? "calendar-day-view" : "calendar-week-view"}>
      {/* Header row */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `56px repeat(${days}, 1fr)` }}>
        <div className="border-r border-border" />
        {dayList.map((d, i) => (
          <div key={i} className={cn("border-r border-border px-2 py-2 text-center last:border-r-0", sameDay(d, today) && "bg-[var(--flux-coral-soft)]")}>
            <div className="text-xs text-muted-foreground">{d.toLocaleDateString(locale, { weekday: "short" })}</div>
            <div className={cn("text-lg font-semibold", sameDay(d, today) && "text-primary")}>{d.getDate()}</div>
          </div>
        ))}
      </div>
      {/* All-day row */}
      <div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: `56px repeat(${days}, 1fr)` }}>
        <div className="border-r border-border px-1 py-1 text-right text-[10px] text-muted-foreground">{t("allDay")}</div>
        {dayList.map((d, i) => (
          <div key={i} className="min-h-[28px] space-y-0.5 border-r border-border p-1 last:border-r-0">
            {allDayByDay(d).map((e: any) => (
              <span key={e._occId ?? e._id} onClick={() => onEvent(e)} className="flex cursor-pointer items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: e.color ?? "var(--flux-coral)" }} data-testid="calendar-event">
                {e._recurring && <Repeat size={9} />}{e.title}
              </span>
            ))}
          </div>
        ))}
      </div>
      {/* Time grid */}
      <div className="grid max-h-[560px] overflow-y-auto" style={{ gridTemplateColumns: `56px repeat(${days}, 1fr)` }}>
        {/* Hour labels */}
        <div className="border-r border-border">
          {HOURS.map((h) => <div key={h} className="relative border-b border-border/60 text-right" style={{ height: HOUR_H }}><span className="absolute -top-2 right-1 text-[10px] text-muted-foreground">{h === 0 ? "" : `${h}:00`}</span></div>)}
        </div>
        {dayList.map((d, di) => (
          <div key={di} className="relative border-r border-border last:border-r-0">
            {HOURS.map((h) => {
              const isInDrag = isDragging && dragStart!.dayIndex === di && dragMin !== null && dragMax !== null && h >= dragMin && h < dragMax;
              return (
                <div
                  key={h}
                  onMouseDown={() => handleSlotMouseDown(di, h)}
                  onMouseEnter={() => handleSlotMouseEnter(di, h)}
                  className={cn("select-none border-b border-border/60 hover:bg-muted/40 cursor-crosshair", isInDrag && "bg-primary/15")}
                  style={{ height: HOUR_H }}
                  data-testid="calendar-slot"
                />
              );
            })}
            {/* Drag preview */}
            {isDragging && dragStart!.dayIndex === di && dragMin !== null && dragMax !== null && (
              <div
                className="pointer-events-none absolute left-1 right-1 rounded-md border-2 border-primary bg-primary/20"
                style={{ top: dragMin * HOUR_H, height: (dragMax - dragMin) * HOUR_H - 2 }}
              />
            )}
            {timedByDay(d).map((e: any) => {
              const s = new Date(e.start);
              const top = (s.getHours() + s.getMinutes() / 60) * HOUR_H;
              const dur = Math.max(0.5, ((e.end ?? e.start + 30 * 60000) - e.start) / 3600000);
              const height = Math.max(20, dur * HOUR_H - 2);
              return (
                <div key={e._occId ?? e._id} onClick={() => onEvent(e)} className="absolute left-1 right-1 cursor-pointer overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm" style={{ top, height, backgroundColor: e.color ?? "var(--flux-coral)" }} data-testid="calendar-event">
                  <div className="flex items-center gap-1 truncate">{e._recurring && <Repeat size={9} />}{e.title}</div>
                  <div className="truncate opacity-80">{fmtTime(e.start)}{e.end ? ` – ${fmtTime(e.end)}` : ""}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Quick task from calendar ───────────────────────── */
function QuickTaskDialog({ open, onOpenChange, seedDate, workspaceId, onCreate, t, tc }: any) {
  const [title, setTitle] = useState("");
  const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [dueDate, setDueDate] = useState("");

  useEffect(() => { if (open && seedDate) setDueDate(dstr(seedDate)); }, [open, seedDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle><TaskSquare variant="Bulk" size={18} className="mr-2 inline text-primary" />New task</DialogTitle></DialogHeader>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title…" className={inputBase} onKeyDown={(e) => e.key === "Enter" && title.trim() && onCreate({ workspaceId, title: title.trim(), status: "todo", dueDate: dueDate ? new Date(dueDate).getTime() : undefined }).then(() => { setTitle(""); onOpenChange(false); })} />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputBase} />
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className={btnOutline}>{tc("cancel")}</button>
          <button onClick={() => { if (!title.trim()) return; onCreate({ workspaceId, title: title.trim(), status: "todo", dueDate: dueDate ? new Date(dueDate).getTime() : undefined }).then(() => { setTitle(""); onOpenChange(false); }); }} className={btnPrimary}>{tc("create") ?? "Create"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Event dialog ───────────────────────── */
function EventDialog({ open, onOpenChange, event, seedDate, seedEnd, recurLabel, t, tc, onSave, onDelete }: any) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [location, setLocation] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([]);
  const [recurrenceMonthlyPosition, setRecurrenceMonthlyPosition] = useState("same_day");
  const [endType, setEndType] = useState<"never" | "until" | "after">("never");
  const [recurUntil, setRecurUntil] = useState("");
  const [endAfter, setEndAfter] = useState(10);
  const [busy, setBusy] = useState(false);

  const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tstr = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const WEEKDAYS = [t("weekdays.mon"), t("weekdays.tue"), t("weekdays.wed"), t("weekdays.thu"), t("weekdays.fri"), t("weekdays.sat"), t("weekdays.sun")];
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const monthWeekday = (date ? new Date(`${date}T00:00`) : new Date()).getDay();
  const monthWeekdayLabel = WEEKDAYS[(monthWeekday + 6) % 7];
  const MONTHLY_POSITIONS = ["same_day", "first", "second", "third", "fourth", "last"] as const;

  useEffect(() => {
    if (!open) return;
    const base = event ? new Date(event.start) : (seedDate ?? new Date());
    const endBase = event?.end ? new Date(event.end) : seedEnd ? seedEnd : new Date(base.getTime() + 60 * 60000);
    setTitle(event?.title ?? "");
    setDate(dstr(base)); setTime(tstr(base));
    setEndDate(dstr(endBase)); setEndTime(tstr(endBase));
    setAllDay(event?.allDay ?? false);
    setColor(event?.color ?? EVENT_COLORS[0]);
    setLocation(event?.location ?? "");

    const legacyFreq = event?.recurrence ?? "none";
    const isLegacy = !event?.recurrenceFreq;
    let freq = event?.recurrenceFreq ?? legacyFreq;
    let interval = event?.recurrenceInterval ?? 1;
    let days = event?.recurrenceDaysOfWeek ?? [];
    let monthPos = event?.recurrenceMonthlyPosition ?? "same_day";
    let end: "never" | "until" | "after" = "never";
    let until = "";
    let after = 10;
    if (isLegacy && legacyFreq === "biweekly") {
      freq = "weekly";
      interval = 2;
    }
    if (event?.recurrenceEndAfter) {
      end = "after";
      after = event.recurrenceEndAfter;
    } else if (event?.recurrenceUntil) {
      end = "until";
      until = dstr(new Date(event.recurrenceUntil));
    }
    if (!RECUR_OPTIONS.includes(freq)) freq = "none";
    setRecurrence(freq);
    setRecurrenceInterval(interval);
    setRecurrenceDaysOfWeek(days);
    setRecurrenceMonthlyPosition(MONTHLY_POSITIONS.includes(monthPos) ? monthPos : "same_day");
    setEndType(end);
    setRecurUntil(until);
    setEndAfter(after);
  }, [open, event, seedDate, seedEnd, t]);

  const submit = async () => {
    if (!title.trim()) return toast.error(t("addEventTitle"));
    if (!date) return toast.error(t("pickDate"));
    setBusy(true);
    try {
      const start = new Date(`${date}T${allDay ? "00:00" : time}`).getTime();
      let end: number | undefined;
      if (allDay) end = new Date(`${endDate || date}T23:59`).getTime();
      else if (endDate && endTime) end = new Date(`${endDate}T${endTime}`).getTime();
      if (end != null && end < start) end = start + 30 * 60000;
      const payload: any = {
        title: title.trim(), start, end, allDay, color,
        location: location.trim() || undefined,
      };
      if (recurrence !== "none") {
        payload.recurrence = recurrence;
        payload.recurrenceFreq = recurrence;
        payload.recurrenceInterval = recurrenceInterval;
        if (recurrence === "weekly") {
          payload.recurrenceDaysOfWeek = recurrenceDaysOfWeek.length ? recurrenceDaysOfWeek : [new Date(start).getDay()];
        }
        if (recurrence === "monthly") {
          payload.recurrenceMonthlyPosition = recurrenceMonthlyPosition;
        }
        if (endType === "after") payload.recurrenceEndAfter = Number(endAfter);
        if (endType === "until" && recurUntil) payload.recurrenceUntil = new Date(`${recurUntil}T23:59`).getTime();
      } else {
        payload.recurrence = "none";
        payload.recurrenceFreq = "none";
      }
      await onSave(payload);
    } finally { setBusy(false); }
  };

  const toggleWeekday = (day: number) => {
    setRecurrenceDaysOfWeek((prev: number[]) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="event-dialog">
        <DialogHeader><DialogTitle>{event ? t("editEvent") : t("newEvent")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("eventTitle")} className={inputBase} data-testid="event-title-input" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">{t("starts")}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputBase} data-testid="event-date-input" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">{t("startTime")}</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={allDay} className={cn(inputBase, allDay && "opacity-50")} data-testid="event-time-input" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">{t("ends")}</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputBase} data-testid="event-end-date-input" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">{t("endTime")}</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={allDay} className={cn(inputBase, allDay && "opacity-50")} data-testid="event-end-time-input" /></div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <span className="text-sm font-medium">{t("allDay")}</span>
            <Switch checked={allDay} onCheckedChange={setAllDay} />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Repeat size={13} /> {t("repeat")}</label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger data-testid="event-recurrence-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECUR_OPTIONS.map((k) => (
                      <SelectItem key={k} value={k}>{recurLabel[k] ?? k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {recurrence !== "none" && (
                  <div className="flex items-center gap-2 rounded-lg border border-border px-2">
                    <span className="text-xs text-muted-foreground">{t("recurrence.every")}</span>
                    <input
                      type="number"
                      min={1}
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Math.max(1, Number(e.target.value)))}
                      className="w-12 bg-transparent text-center text-sm outline-none"
                    />
                    <span className="text-xs text-muted-foreground">{t(`recurrence.${recurrence}Unit`)}</span>
                  </div>
                )}
              </div>

              {recurrence === "weekly" && (
                <div className="flex flex-wrap gap-1">
                  {WEEKDAY_ORDER.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleWeekday(day)}
                      className={cn(
                        "h-8 w-8 rounded-full text-xs font-medium transition",
                        recurrenceDaysOfWeek.includes(day)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                    >
                      {WEEKDAYS[(day + 6) % 7].charAt(0)}
                    </button>
                  ))}
                </div>
              )}

              {recurrence === "monthly" && (
                <Select value={recurrenceMonthlyPosition} onValueChange={setRecurrenceMonthlyPosition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHLY_POSITIONS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`recurrence.monthlyPositions.${k}`, { weekday: monthWeekdayLabel })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {recurrence !== "none" && (
                <div className="space-y-2">
                  <Select value={endType} onValueChange={(v) => setEndType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">{t("recurrence.endNever")}</SelectItem>
                      <SelectItem value="until">{t("recurrence.endUntil")}</SelectItem>
                      <SelectItem value="after">{t("recurrence.endAfter")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {endType === "until" && (
                    <input type="date" value={recurUntil} onChange={(e) => setRecurUntil(e.target.value)} className={inputBase} />
                  )}
                  {endType === "after" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={endAfter}
                        onChange={(e) => setEndAfter(Math.max(1, Number(e.target.value)))}
                        className={cn(inputBase, "w-20")}
                      />
                      <span className="text-xs text-muted-foreground">{t("recurrence.occurrences")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("locationPlaceholder")} className={inputBase} />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("color")}</label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={cn("h-7 w-7 rounded-full transition-transform", color === c && "ring-2 ring-ring ring-offset-2 ring-offset-background")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="items-center">
          {onDelete && <button onClick={onDelete} className={cn(btnGhost, "mr-auto text-destructive")}><Trash variant="Bulk" size={16} /> {tc("delete")}</button>}
          <button onClick={() => onOpenChange(false)} className={btnOutline}>{tc("cancel")}</button>
          <button onClick={submit} disabled={busy} className={btnPrimary} data-testid="event-save">{busy ? tc("saving") : event ? tc("save") : t("createEvent")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
