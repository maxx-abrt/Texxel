"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageContainer, btnPrimary, btnOutline, inputBase, EmptyState } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Data2, Add, ArrowLeft2, More, Trash, RowVertical, Element3, Kanban, Calendar as CalIcon,
  DocumentDownload, DocumentUpload,
} from "iconsax-reactjs";

type Col = { id: string; name: string; type: string; options?: string[] };
const TYPES = ["text", "number", "select", "date", "checkbox", "image"];
const VIEWS = [
  { key: "table", label: "Table", icon: RowVertical },
  { key: "gallery", label: "Gallery", icon: Element3 },
  { key: "kanban", label: "Kanban", icon: Kanban },
  { key: "calendar", label: "Calendar", icon: CalIcon },
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function download(text: string, name: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function DatabaseView({ databaseId }: { databaseId: Id<"flux_databases"> }) {
  const router = useRouter();
  const db = useQuery(api.flux_databases.get, { databaseId });
  const rows = useQuery(api.flux_databases.listRows, { databaseId });
  const updateDb = useMutation(api.flux_databases.update);
  const addRow = useMutation(api.flux_databases.addRow);
  const updateRow = useMutation(api.flux_databases.updateRow);
  const removeRow = useMutation(api.flux_databases.removeRow);
  const importRows = useMutation(api.flux_databases.importRows);

  const drafts = useRef<Record<string, any>>({});
  const timers = useRef<Record<string, any>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [colDialog, setColDialog] = useState(false);

  if (db === undefined) {
    return <div className="p-8"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="mt-6 h-64 w-full animate-pulse rounded-2xl bg-muted" /></div>;
  }
  if (db === null) {
    return <PageContainer><EmptyState icon={Data2} title="Database not found" action={<button onClick={() => router.push("/app/databases")} className={btnOutline}><ArrowLeft2 variant="Bulk" size={16} /> Back</button>} /></PageContainer>;
  }

  const columns: Col[] = JSON.parse(db.columns || "[]");
  const view = db.viewType ?? "table";
  const cfg = (() => { try { return JSON.parse(db.viewConfig || "{}"); } catch { return {}; } })();
  const selectCols = columns.filter((c) => c.type === "select");
  const dateCols = columns.filter((c) => c.type === "date");
  const groupBy = cfg.groupBy && columns.some((c) => c.id === cfg.groupBy) ? cfg.groupBy : selectCols[0]?.id;
  const dateField = cfg.dateField && columns.some((c) => c.id === cfg.dateField) ? cfg.dateField : dateCols[0]?.id;
  const titleCol = columns.find((c) => c.type === "text")?.id ?? columns[0]?.id;
  const imageCol = columns.find((c) => c.type === "image")?.id;

  const setView = (v: string) => updateDb({ databaseId, viewType: v });
  const setConfig = (patch: any) => updateDb({ databaseId, viewConfig: JSON.stringify({ ...cfg, ...patch }) });

  const saveCell = (row: any, colId: string, value: any) => {
    const base = drafts.current[row._id] ?? JSON.parse(row.cells || "{}");
    const next = { ...base, [colId]: value };
    drafts.current[row._id] = next;
    if (timers.current[row._id]) clearTimeout(timers.current[row._id]);
    timers.current[row._id] = setTimeout(() => { updateRow({ rowId: row._id, cells: JSON.stringify(next) }); }, 400);
  };
  const setCellNow = (row: any, colId: string, value: any) => {
    const base = JSON.parse(row.cells || "{}");
    updateRow({ rowId: row._id, cells: JSON.stringify({ ...base, [colId]: value }) });
  };

  const addColumn = async (name: string, type: string, options?: string[]) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Math.random().toString(36).slice(2, 5);
    await updateDb({ databaseId, columns: JSON.stringify([...columns, { id, name, type, ...(options ? { options } : {}) }]) });
  };
  const removeColumn = async (colId: string) => {
    await updateDb({ databaseId, columns: JSON.stringify(columns.filter((c) => c.id !== colId)) });
  };

  const exportCSV = () => {
    const header = columns.map((c) => csvEscape(c.name)).join(",");
    const body = (rows ?? []).map((r: any) => { const cells = JSON.parse(r.cells || "{}"); return columns.map((c) => csvEscape(cells[c.id])).join(","); });
    download([header, ...body].join("\n"), `${(db.title || "database").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`, "text/csv");
    toast.success("Exported CSV");
  };
  const exportJSON = () => {
    const data = (rows ?? []).map((r: any) => { const cells = JSON.parse(r.cells || "{}"); const o: any = {}; for (const c of columns) o[c.name] = cells[c.id] ?? null; return o; });
    download(JSON.stringify(data, null, 2), `${(db.title || "database").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`, "application/json");
    toast.success("Exported JSON");
  };
  const onImportFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 1) return toast.error("Empty CSV");
    const headers = parsed[0];
    // Map headers to existing columns (by name, case-insensitive) or create new text columns.
    const cols = [...columns];
    const headerColIds: string[] = headers.map((hname) => {
      const found = cols.find((c) => c.name.toLowerCase() === hname.trim().toLowerCase());
      if (found) return found.id;
      const id = hname.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Math.random().toString(36).slice(2, 5);
      cols.push({ id, name: hname.trim() || "Column", type: "text" });
      return id;
    });
    const rowStrings = parsed.slice(1).map((r) => {
      const cells: any = {};
      headerColIds.forEach((cid, i) => { cells[cid] = r[i] ?? ""; });
      return JSON.stringify(cells);
    });
    const n = await importRows({ databaseId, rows: rowStrings, columns: JSON.stringify(cols) });
    toast.success(`Imported ${n} row(s)`);
  };

  return (
    <PageContainer className="max-w-[1280px]">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => router.push("/app/databases")} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted"><ArrowLeft2 variant="Bulk" size={18} /></button>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--flux-coral-soft)] text-primary">{db.icon ? <span className="text-xl">{db.icon}</span> : <Data2 variant="Bulk" size={24} />}</span>
        <input defaultValue={db.title} onBlur={(e) => e.target.value.trim() && e.target.value !== db.title && updateDb({ databaseId, title: e.target.value.trim() })} className="flex-1 rounded-lg border border-transparent bg-transparent font-display text-2xl font-bold tracking-tight outline-none hover:border-border focus:border-border focus:px-2" data-testid="database-title" />
      </div>

      {/* Toolbar: view switcher + import/export */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center rounded-full border border-border bg-card p-0.5" data-testid="database-view-switch">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)} data-testid={`db-view-${v.key}`} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", view === v.key ? "bg-muted font-medium" : "text-muted-foreground")}>
              <v.icon variant="Bulk" size={15} /> {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === "kanban" && selectCols.length > 0 && (
            <Select value={groupBy} onValueChange={(v) => setConfig({ groupBy: v })}>
              <SelectTrigger className="h-8 w-40 text-xs" data-testid="kanban-groupby"><SelectValue placeholder="Group by" /></SelectTrigger>
              <SelectContent>{selectCols.map((c) => <SelectItem key={c.id} value={c.id}>Group: {c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {view === "calendar" && dateCols.length > 0 && (
            <Select value={dateField} onValueChange={(v) => setConfig({ dateField: v })}>
              <SelectTrigger className="h-8 w-40 text-xs" data-testid="calendar-datefield"><SelectValue placeholder="Date field" /></SelectTrigger>
              <SelectContent>{dateCols.map((c) => <SelectItem key={c.id} value={c.id}>Date: {c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { onImportFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="db-import-input" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className={cn(btnOutline, "h-8 text-xs")} data-testid="db-data-menu"><DocumentDownload variant="Bulk" size={15} /> Data</button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => fileRef.current?.click()} className="gap-2" data-testid="db-import-csv"><DocumentUpload variant="Bulk" size={15} /> Import CSV</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportCSV} className="gap-2" data-testid="db-export-csv"><DocumentDownload variant="Bulk" size={15} /> Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportJSON} className="gap-2" data-testid="db-export-json"><DocumentDownload variant="Bulk" size={15} /> Export JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {view === "table" && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full border-collapse text-sm" data-testid="database-table">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {columns.map((c) => (
                  <th key={c.id} className="min-w-[160px] px-3 py-2 text-left font-medium">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">{c.name}<span className="font-mono text-[10px] text-muted-foreground">{c.type}</span></span>
                      {columns.length > 1 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><button className="text-muted-foreground hover:text-foreground"><More variant="Bulk" size={15} /></button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => removeColumn(c.id)} className="text-destructive">Delete column</DropdownMenuItem></DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-12 px-2"><button onClick={() => setColDialog(true)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background" data-testid="add-column-btn"><Add variant="Bulk" size={16} /></button></th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((row: any) => {
                const cells = JSON.parse(row.cells || "{}");
                return (
                  <tr key={row._id} className="group border-b border-border last:border-0 hover:bg-muted/30" data-testid="database-row">
                    {columns.map((c) => (
                      <td key={c.id} className="border-r border-border px-1 py-0.5 last:border-0"><Cell type={c.type} options={c.options} defaultValue={cells[c.id]} onChange={(v) => saveCell(row, c.id, v)} /></td>
                    ))}
                    <td className="px-2"><button onClick={() => removeRow({ rowId: row._id })} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100"><Trash variant="Bulk" size={15} /></button></td>
                  </tr>
                );
              })}
              <tr><td colSpan={columns.length + 1} className="px-3 py-2"><button onClick={() => addRow({ databaseId })} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="add-row-btn"><Add variant="Bulk" size={16} /> New row</button></td></tr>
            </tbody>
          </table>
        </div>
      )}

      {view === "gallery" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="db-gallery">
          {(rows ?? []).map((row: any) => {
            const cells = JSON.parse(row.cells || "{}");
            const img = imageCol ? cells[imageCol] : null;
            return (
              <div key={row._id} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-md" data-testid="db-gallery-card">
                {img ? <img src={img} alt="" className="h-32 w-full object-cover" /> : <div className="flex h-24 items-center justify-center bg-muted/40 text-3xl">{db.icon ?? "🗂️"}</div>}
                <div className="p-3">
                  <p className="truncate font-semibold">{cells[titleCol!] || "Untitled"}</p>
                  <div className="mt-1.5 space-y-0.5">
                    {columns.filter((c) => c.id !== titleCol && c.id !== imageCol).slice(0, 3).map((c) => cells[c.id] != null && cells[c.id] !== "" && (
                      <p key={c.id} className="truncate text-xs text-muted-foreground"><span className="font-medium">{c.name}:</span> {String(cells[c.id])}</p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <button onClick={() => addRow({ databaseId })} className="flex min-h-[140px] items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/30" data-testid="gallery-add-row"><Add variant="Bulk" size={16} /> New</button>
        </div>
      )}

      {view === "kanban" && (
        groupBy ? (
          <KanbanDb columns={columns} rows={rows ?? []} groupBy={groupBy} titleCol={titleCol!} onSetGroup={(row: any, val: string) => setCellNow(row, groupBy, val)} onAdd={(val: string) => addRow({ databaseId }).then((rid: any) => updateRow({ rowId: rid, cells: JSON.stringify({ [groupBy]: val }) }))} />
        ) : <EmptyState icon={Kanban} title="No select column" description="Add a 'select' column to group cards into a Kanban board." />
      )}

      {view === "calendar" && (
        dateField ? (
          <CalendarDb rows={rows ?? []} dateField={dateField} titleCol={titleCol!} />
        ) : <EmptyState icon={CalIcon} title="No date column" description="Add a 'date' column to place rows on a calendar." />
      )}

      <AddColumnDialog open={colDialog} onOpenChange={setColDialog} onAdd={async (n: string, t: string, o?: string[]) => { await addColumn(n, t, o); setColDialog(false); }} />
    </PageContainer>
  );
}

function KanbanDb({ columns, rows, groupBy, titleCol, onSetGroup, onAdd }: any) {
  const col = columns.find((c: Col) => c.id === groupBy);
  const options: string[] = [...(col?.options ?? []), "—"];
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const o of options) map[o] = [];
    for (const r of rows) { const cells = JSON.parse(r.cells || "{}"); const v = cells[groupBy] || "—"; (map[v] ?? (map[v] = [])).push(r); }
    return map;
  }, [rows, options, groupBy]);
  return (
    <div className="flex gap-4 overflow-x-auto pb-2" data-testid="db-kanban">
      {options.map((opt) => (
        <div key={opt} className="flex w-[280px] shrink-0 flex-col rounded-2xl border border-border bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">{opt}<span className="text-muted-foreground">{(grouped[opt] ?? []).length}</span></div>
          <div className="space-y-2">
            {(grouped[opt] ?? []).map((r: any) => { const cells = JSON.parse(r.cells || "{}"); return (
              <div key={r._id} className="rounded-xl border border-border bg-card p-3 shadow-sm" data-testid="db-kanban-card">
                <p className="text-sm font-medium">{cells[titleCol] || "Untitled"}</p>
                <Select defaultValue={opt === "—" ? "" : opt} onValueChange={(v) => onSetGroup(r, v)}>
                  <SelectTrigger className="mt-2 h-7 text-xs"><SelectValue placeholder="Set" /></SelectTrigger>
                  <SelectContent>{(col?.options ?? []).map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ); })}
            {opt !== "—" && <button onClick={() => onAdd(opt)} className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-background"><Add variant="Bulk" size={13} /> Add</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarDb({ rows, dateField, titleCol }: any) {
  const [cursor, setCursor] = useState(() => new Date());
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const off = (first.getDay() + 6) % 7;
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - off);
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });
  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of rows) {
      const cells = JSON.parse(r.cells || "{}");
      const dv = cells[dateField];
      if (!dv) continue;
      const d = new Date(dv);
      if (isNaN(d.getTime())) continue;
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[k] ?? (map[k] = [])).push(r);
    }
    return map;
  }, [rows, dateField]);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="db-calendar">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-semibold">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <div className="flex gap-1">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-md px-2 py-1 text-sm hover:bg-muted">‹</button>
          <button onClick={() => setCursor(new Date())} className="rounded-md px-2 py-1 text-sm hover:bg-muted">Today</button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-md px-2 py-1 text-sm hover:bg-muted">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d} className="px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => { const k = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`; const items = byDay[k] ?? []; const inMonth = day.getMonth() === cursor.getMonth(); return (
          <div key={i} className={cn("min-h-[84px] border-b border-r border-border p-1.5", !inMonth && "bg-muted/20 text-muted-foreground", i % 7 === 6 && "border-r-0")}>
            <span className="text-xs">{day.getDate()}</span>
            <div className="mt-1 space-y-1">{items.slice(0, 3).map((r: any) => { const cells = JSON.parse(r.cells || "{}"); return <span key={r._id} className="block truncate rounded bg-[var(--flux-coral-soft)] px-1.5 py-0.5 text-[11px] font-medium text-primary">{cells[titleCol] || "Untitled"}</span>; })}</div>
          </div>
        ); })}
      </div>
    </div>
  );
}

function Cell({ type, options, defaultValue, onChange }: { type: string; options?: string[]; defaultValue: any; onChange: (v: any) => void }) {
  if (type === "checkbox") return <div className="flex items-center px-2 py-1.5"><input type="checkbox" defaultChecked={!!defaultValue} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--flux-coral)]" /></div>;
  if (type === "select") return (
    <Select defaultValue={defaultValue ?? ""} onValueChange={onChange}>
      <SelectTrigger className="h-8 border-0 bg-transparent shadow-none focus:ring-0"><SelectValue placeholder="—" /></SelectTrigger>
      <SelectContent>{(options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
  return <input type={type === "number" ? "number" : type === "date" ? "date" : "text"} defaultValue={defaultValue ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-background" />;
}

function AddColumnDialog({ open, onOpenChange, onAdd }: any) {
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="add-column-dialog">
        <DialogHeader><DialogTitle>Add column</DialogTitle><DialogDescription>Name the column and pick a field type.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Column name" className={inputBase} data-testid="column-name-input" />
          <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          {type === "select" && <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Options (comma separated)" className={inputBase} />}
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className={btnOutline}>Cancel</button>
          <button onClick={() => { if (!name.trim()) return toast.error("Add a name"); onAdd(name.trim(), type, type === "select" ? options.split(",").map((s) => s.trim()).filter(Boolean) : undefined); setName(""); setOptions(""); setType("text"); }} className={btnPrimary} data-testid="column-add-submit">Add</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
