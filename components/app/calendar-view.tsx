"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, btnPrimary, btnOutline, btnGhost, inputBase } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Calendar as CalIcon, ArrowLeft2, ArrowRight2, Add, Trash, Repeat, Location, Clock } from "iconsax-reactjs";

const EVENT_COLORS = ["#fb5648", "#2f7ea6", "#2fbf9b", "#d98324", "#7c5cff"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_MS = 86_400_000;

const RECUR_LABEL: Record<string, string> = {
  none: "Does not repeat", daily: "Daily", weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly",
};

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfWeek(d: Date) { const s = startOfDay(d); const off = (s.getDay() + 6) % 7; s.setDate(s.getDate() - off); return s; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); }
function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function fmtTime(ts: number) { return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }

/** Expand recurring events into concrete occurrences within [rangeStart, rangeEnd). */
function expandEvents(events: any[], rangeStart: number, rangeEnd: number): any[] {
  const out: any[] = [];
  for (const e of events) {
    const dur = (e.end ?? e.start) - e.start;
    const rec = e.recurrence && e.recurrence !== "none" ? e.recurrence : null;
    if (!rec) {
      if (e.start < rangeEnd && (e.end ?? e.start) >= rangeStart) out.push(e);
      continue;
    }
    const until = e.recurrenceUntil ?? rangeEnd;
    const base = new Date(e.start);
    let occ = new Date(e.start);
    let guard = 0;
    while (occ.getTime() < rangeEnd && occ.getTime() <= until && guard < 750) {
      guard++;
      const t = occ.getTime();
      if (t + dur >= rangeStart && t < rangeEnd) {
        out.push({ ...e, start: t, end: t + dur, _occId: `${e._id}_${t}`, _recurring: true });
      }
      if (rec === "daily") occ = new Date(occ.getTime() + DAY_MS);
      else if (rec === "weekly") occ = new Date(occ.getTime() + 7 * DAY_MS);
      else if (rec === "biweekly") occ = new Date(occ.getTime() + 14 * DAY_MS);
      else if (rec === "monthly") { occ = new Date(occ); occ.setMonth(occ.getMonth() + 1); }
      else break;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

type ViewMode = "month" | "week" | "day";

export function CalendarView() {
  const search = useSearchParams();
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

  useEffect(() => { if (search.get("new") === "1") { setSeedDate(new Date()); setEditing(null); setDialogOpen(true); } }, [search]);

  // Visible range for the active view.
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (view === "day") { const s = startOfDay(cursor); return [s.getTime(), s.getTime() + DAY_MS]; }
    if (view === "week") { const s = startOfWeek(cursor); return [s.getTime(), s.getTime() + 7 * DAY_MS]; }
    const first = startOfMonth(cursor); const off = (first.getDay() + 6) % 7;
    const gridStart = new Date(first); gridStart.setDate(first.getDate() - off);
    return [gridStart.getTime(), gridStart.getTime() + 42 * DAY_MS];
  }, [view, cursor]);

  const expanded = useMemo(() => expandEvents(events ?? [], rangeStart, rangeEnd), [events, rangeStart, rangeEnd]);

  const openNew = (d: Date) => { setSeedDate(d); setEditing(null); setDialogOpen(true); };
  const openEdit = (e: any) => { setEditing(e); setSeedDate(null); setDialogOpen(true); };

  const navigate = (dir: number) => {
    if (view === "day") setCursor(new Date(cursor.getTime() + dir * DAY_MS));
    else if (view === "week") setCursor(new Date(cursor.getTime() + dir * 7 * DAY_MS));
    else setCursor(addMonths(cursor, dir));
  };

  const headerLabel = view === "day"
    ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : view === "week"
      ? `Week of ${startOfWeek(cursor).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

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
              <button key={v} onClick={() => setView(v)} data-testid={`calendar-view-${v}`} className={cn("h-8 rounded-full px-3 text-sm capitalize", view === v ? "bg-muted font-medium" : "text-muted-foreground")}>{v}</button>
            ))}
          </div>
          <div className="flex items-center rounded-full border border-border bg-card">
            <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-l-full hover:bg-muted" data-testid="calendar-prev"><ArrowLeft2 variant="Bulk" size={18} /></button>
            <button onClick={() => setCursor(new Date())} className="h-9 px-3 text-sm font-medium hover:bg-muted">Today</button>
            <button onClick={() => navigate(1)} className="flex h-9 w-9 items-center justify-center rounded-r-full hover:bg-muted" data-testid="calendar-next"><ArrowRight2 variant="Bulk" size={18} /></button>
          </div>
          <button onClick={() => openNew(new Date())} className={btnPrimary} data-testid="new-event-btn"><Add variant="Bulk" size={18} /> New event</button>
        </div>
      </div>

      {view === "month" && <MonthView cursor={cursor} events={expanded} onDay={openNew} onEvent={openEdit} />}
      {view === "week" && <WeekTimeGrid days={7} startDate={startOfWeek(cursor)} events={expanded} onSlot={openNew} onEvent={openEdit} />}
      {view === "day" && <WeekTimeGrid days={1} startDate={startOfDay(cursor)} events={expanded} onSlot={openNew} onEvent={openEdit} />}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing}
        seedDate={seedDate}
        onSave={async (data: any) => {
          if (editing) { await update({ eventId: editing._id, ...data }); toast.success("Event updated"); }
          else { if (!activeWorkspaceId) return; await create({ workspaceId: activeWorkspaceId, ...data }); toast.success("Event created"); }
          setDialogOpen(false);
        }}
        onDelete={editing ? async () => { await remove({ eventId: editing._id }); toast.success("Event deleted"); setDialogOpen(false); } : undefined}
      />
    </PageContainer>
  );
}

/* ───────────────────────── Month view ───────────────────────── */
function MonthView({ cursor, events, onDay, onEvent }: any) {
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
        {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {weeks.map((day, idx) => {
          const dayEvents = byDay.get(dayKey(day)) ?? [];
          const isCurrentMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, today);
          return (
            <button key={idx} onClick={() => onDay(day)} data-testid="calendar-day"
              className={cn("min-h-[92px] border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-muted/40", !isCurrentMonth && "bg-muted/20 text-muted-foreground", idx % 7 === 6 && "border-r-0")}>
              <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", isToday && "bg-primary font-bold text-primary-foreground")}>{day.getDate()}</span>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((e: any) => (
                  <span key={e._occId ?? e._id} onClick={(ev) => { ev.stopPropagation(); onEvent(e); }}
                    className="flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: e.color ?? "var(--flux-coral)" }} data-testid="calendar-event">
                    {e._recurring && <Repeat size={9} />}{!e.allDay && <span className="opacity-80">{fmtTime(e.start)}</span>} {e.title}
                  </span>
                ))}
                {dayEvents.length > 3 && <span className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Week / Day time grid ───────────────────────── */
function WeekTimeGrid({ days, startDate, events, onSlot, onEvent }: any) {
  const today = new Date();
  const dayList = Array.from({ length: days }, (_, i) => new Date(startDate.getTime() + i * DAY_MS));
  const HOUR_H = 48; // px per hour

  const allDayByDay = (d: Date) => events.filter((e: any) => e.allDay && sameDay(new Date(e.start), d));
  const timedByDay = (d: Date) => events.filter((e: any) => !e.allDay && sameDay(new Date(e.start), d));

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid={days === 1 ? "calendar-day-view" : "calendar-week-view"}>
      {/* Header row */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `56px repeat(${days}, 1fr)` }}>
        <div className="border-r border-border" />
        {dayList.map((d, i) => (
          <div key={i} className={cn("border-r border-border px-2 py-2 text-center last:border-r-0", sameDay(d, today) && "bg-[var(--flux-coral-soft)]")}>
            <div className="text-xs text-muted-foreground">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
            <div className={cn("text-lg font-semibold", sameDay(d, today) && "text-primary")}>{d.getDate()}</div>
          </div>
        ))}
      </div>
      {/* All-day row */}
      <div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: `56px repeat(${days}, 1fr)` }}>
        <div className="border-r border-border px-1 py-1 text-right text-[10px] text-muted-foreground">all-day</div>
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
            {HOURS.map((h) => (
              <div key={h} onClick={() => { const nd = new Date(d); nd.setHours(h, 0, 0, 0); onSlot(nd); }} className="border-b border-border/60 hover:bg-muted/40" style={{ height: HOUR_H }} data-testid="calendar-slot" />
            ))}
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

/* ───────────────────────── Event dialog ───────────────────────── */
function EventDialog({ open, onOpenChange, event, seedDate, onSave, onDelete }: any) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [location, setLocation] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [recurUntil, setRecurUntil] = useState("");
  const [busy, setBusy] = useState(false);

  const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tstr = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  useEffect(() => {
    if (!open) return;
    const base = event ? new Date(event.start) : (seedDate ?? new Date());
    const endBase = event?.end ? new Date(event.end) : new Date(base.getTime() + 60 * 60000);
    setTitle(event?.title ?? "");
    setDate(dstr(base)); setTime(tstr(base));
    setEndDate(dstr(endBase)); setEndTime(tstr(endBase));
    setAllDay(event?.allDay ?? false);
    setColor(event?.color ?? EVENT_COLORS[0]);
    setLocation(event?.location ?? "");
    setRecurrence(event?.recurrence ?? "none");
    setRecurUntil(event?.recurrenceUntil ? dstr(new Date(event.recurrenceUntil)) : "");
  }, [open, event, seedDate]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Add an event title");
    if (!date) return toast.error("Pick a date");
    setBusy(true);
    try {
      const start = new Date(`${date}T${allDay ? "00:00" : time}`).getTime();
      let end: number | undefined;
      if (allDay) end = new Date(`${endDate || date}T23:59`).getTime();
      else if (endDate && endTime) end = new Date(`${endDate}T${endTime}`).getTime();
      if (end != null && end < start) end = start + 30 * 60000;
      await onSave({
        title: title.trim(), start, end, allDay, color,
        location: location.trim() || undefined,
        recurrence,
        recurrenceUntil: recurrence !== "none" && recurUntil ? new Date(`${recurUntil}T23:59`).getTime() : undefined,
      });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="event-dialog">
        <DialogHeader><DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className={inputBase} data-testid="event-title-input" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Starts</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputBase} data-testid="event-date-input" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Start time</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={allDay} className={cn(inputBase, allDay && "opacity-50")} data-testid="event-time-input" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Ends</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputBase} data-testid="event-end-date-input" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">End time</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={allDay} className={cn(inputBase, allDay && "opacity-50")} data-testid="event-end-time-input" /></div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <span className="text-sm font-medium">All day</span>
            <Switch checked={allDay} onCheckedChange={setAllDay} />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Repeat size={13} /> Repeat</label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger data-testid="event-recurrence-select"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RECUR_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
              {recurrence !== "none" && (
                <input type="date" value={recurUntil} onChange={(e) => setRecurUntil(e.target.value)} placeholder="Until" className={inputBase} data-testid="event-recur-until" title="Repeat until (optional)" />
              )}
            </div>
          </div>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" className={inputBase} />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={cn("h-7 w-7 rounded-full transition-transform", color === c && "ring-2 ring-ring ring-offset-2 ring-offset-background")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="items-center">
          {onDelete && <button onClick={onDelete} className={cn(btnGhost, "mr-auto text-destructive")}><Trash variant="Bulk" size={16} /> Delete</button>}
          <button onClick={() => onOpenChange(false)} className={btnOutline}>Cancel</button>
          <button onClick={submit} disabled={busy} className={btnPrimary} data-testid="event-save">{busy ? "Saving\u2026" : event ? "Save" : "Create"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
