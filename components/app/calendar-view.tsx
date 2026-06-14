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
import { Calendar as CalIcon, ArrowLeft2, ArrowRight2, Add, Trash } from "iconsax-reactjs";

const EVENT_COLORS = ["#fb5648", "#2f7ea6", "#2fbf9b", "#d98324", "#7c5cff"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

export function CalendarView() {
  const search = useSearchParams();
  const { activeWorkspaceId } = useWorkspace();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const events = useQuery(api.flux_events.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const create = useMutation(api.flux_events.create);
  const update = useMutation(api.flux_events.update);
  const remove = useMutation(api.flux_events.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [seedDate, setSeedDate] = useState<Date | null>(null);

  useEffect(() => { if (search.get("new") === "1") { setSeedDate(new Date()); setEditing(null); setDialogOpen(true); } }, [search]);

  const weeks = useMemo(() => {
    const first = startOfMonth(cursor);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); days.push(d); }
    const out: Date[][] = [];
    for (let i = 0; i < 6; i++) out.push(days.slice(i * 7, i * 7 + 7));
    return out;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of events ?? []) {
      const d = new Date(e.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <PageContainer className="max-w-[1280px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--flux-coral-soft)] text-primary"><CalIcon variant="Bulk" size={24} /></span>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl" data-testid="calendar-month-label">{monthLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-border bg-card">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-l-full hover:bg-muted" data-testid="calendar-prev"><ArrowLeft2 variant="Bulk" size={18} /></button>
            <button onClick={() => setCursor(startOfMonth(new Date()))} className="h-9 px-3 text-sm font-medium hover:bg-muted">Today</button>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-r-full hover:bg-muted" data-testid="calendar-next"><ArrowRight2 variant="Bulk" size={18} /></button>
          </div>
          <button onClick={() => { setSeedDate(new Date()); setEditing(null); setDialogOpen(true); }} className={btnPrimary} data-testid="new-event-btn"><Add variant="Bulk" size={18} /> New event</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((day, idx) => {
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayEvents = eventsByDay.get(key) ?? [];
            const isCurrentMonth = day.getMonth() === cursor.getMonth();
            const isToday = sameDay(day, today);
            return (
              <button key={idx} onClick={() => { setSeedDate(day); setEditing(null); setDialogOpen(true); }} data-testid="calendar-day"
                className={cn("min-h-[92px] border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-muted/40", !isCurrentMonth && "bg-muted/20 text-muted-foreground", idx % 7 === 6 && "border-r-0")}>
                <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", isToday && "bg-primary font-bold text-primary-foreground")}>{day.getDate()}</span>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 3).map((e: any) => (
                    <span key={e._id} onClick={(ev) => { ev.stopPropagation(); setEditing(e); setSeedDate(null); setDialogOpen(true); }}
                      className="block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: e.color ?? "var(--flux-coral)" }} data-testid="calendar-event">
                      {e.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && <span className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

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

function EventDialog({ open, onOpenChange, event, seedDate, onSave, onDelete }: any) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = event ? new Date(event.start) : (seedDate ?? new Date());
    setTitle(event?.title ?? "");
    setDate(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`);
    setTime(`${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}`);
    setAllDay(event?.allDay ?? false);
    setColor(event?.color ?? EVENT_COLORS[0]);
    setLocation(event?.location ?? "");
  }, [open, event, seedDate]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Add an event title");
    if (!date) return toast.error("Pick a date");
    setBusy(true);
    try {
      const start = new Date(`${date}T${allDay ? "00:00" : time}`).getTime();
      await onSave({ title: title.trim(), start, allDay, color, location: location.trim() || undefined });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="event-dialog">
        <DialogHeader><DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className={inputBase} data-testid="event-title-input" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputBase} data-testid="event-date-input" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Time</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={allDay} className={cn(inputBase, allDay && "opacity-50")} /></div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <span className="text-sm font-medium">All day</span>
            <Switch checked={allDay} onCheckedChange={setAllDay} />
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
