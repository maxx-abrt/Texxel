"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageContainer, btnPrimary, btnOutline, inputBase, EmptyState } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Data2, Add, ArrowLeft2, More, Trash } from "iconsax-reactjs";

type Col = { id: string; name: string; type: string; options?: string[] };

const TYPES = ["text", "number", "select", "date", "checkbox"];

export function DatabaseView({ databaseId }: { databaseId: Id<"flux_databases"> }) {
  const router = useRouter();
  const db = useQuery(api.flux_databases.get, { databaseId });
  const rows = useQuery(api.flux_databases.listRows, { databaseId });
  const updateDb = useMutation(api.flux_databases.update);
  const addRow = useMutation(api.flux_databases.addRow);
  const updateRow = useMutation(api.flux_databases.updateRow);
  const removeRow = useMutation(api.flux_databases.removeRow);

  const drafts = useRef<Record<string, any>>({});
  const timers = useRef<Record<string, any>>({});
  const [colDialog, setColDialog] = useState(false);

  if (db === undefined) {
    return <div className="p-8"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="mt-6 h-64 w-full animate-pulse rounded-2xl bg-muted" /></div>;
  }
  if (db === null) {
    return <PageContainer><EmptyState icon={Data2} title="Database not found" action={<button onClick={() => router.push("/app/databases")} className={btnOutline}><ArrowLeft2 variant="Bulk" size={16} /> Back</button>} /></PageContainer>;
  }

  const columns: Col[] = JSON.parse(db.columns || "[]");

  const saveCell = (row: any, colId: string, value: any) => {
    const base = drafts.current[row._id] ?? JSON.parse(row.cells || "{}");
    const next = { ...base, [colId]: value };
    drafts.current[row._id] = next;
    if (timers.current[row._id]) clearTimeout(timers.current[row._id]);
    timers.current[row._id] = setTimeout(() => {
      updateRow({ rowId: row._id, cells: JSON.stringify(next) });
    }, 400);
  };

  const addColumn = async (name: string, type: string, options?: string[]) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Math.random().toString(36).slice(2, 5);
    const next = [...columns, { id, name, type, ...(options ? { options } : {}) }];
    await updateDb({ databaseId, columns: JSON.stringify(next) });
  };

  const removeColumn = async (colId: string) => {
    const next = columns.filter((c) => c.id !== colId);
    await updateDb({ databaseId, columns: JSON.stringify(next) });
  };

  return (
    <PageContainer className="max-w-[1280px]">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => router.push("/app/databases")} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted"><ArrowLeft2 variant="Bulk" size={18} /></button>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--flux-coral-soft)] text-primary">{db.icon ? <span className="text-xl">{db.icon}</span> : <Data2 variant="Bulk" size={24} />}</span>
        <input defaultValue={db.title} onBlur={(e) => e.target.value.trim() && e.target.value !== db.title && updateDb({ databaseId, title: e.target.value.trim() })} className="flex-1 rounded-lg border border-transparent bg-transparent font-display text-2xl font-bold tracking-tight outline-none hover:border-border focus:border-border focus:px-2" data-testid="database-title" />
      </div>

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
              <th className="w-12 px-2">
                <button onClick={() => setColDialog(true)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background" data-testid="add-column-btn"><Add variant="Bulk" size={16} /></button>
              </th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row: any) => {
              const cells = JSON.parse(row.cells || "{}");
              return (
                <tr key={row._id} className="group border-b border-border last:border-0 hover:bg-muted/30" data-testid="database-row">
                  {columns.map((c) => (
                    <td key={c.id} className="border-r border-border px-1 py-0.5 last:border-0">
                      <Cell type={c.type} options={c.options} defaultValue={cells[c.id]} onChange={(v) => saveCell(row, c.id, v)} />
                    </td>
                  ))}
                  <td className="px-2">
                    <button onClick={() => removeRow({ rowId: row._id })} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100"><Trash variant="Bulk" size={15} /></button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={columns.length + 1} className="px-3 py-2">
                <button onClick={() => addRow({ databaseId })} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="add-row-btn"><Add variant="Bulk" size={16} /> New row</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AddColumnDialog open={colDialog} onOpenChange={setColDialog} onAdd={async (n, t, o) => { await addColumn(n, t, o); setColDialog(false); }} />
    </PageContainer>
  );
}

function Cell({ type, options, defaultValue, onChange }: { type: string; options?: string[]; defaultValue: any; onChange: (v: any) => void }) {
  if (type === "checkbox") {
    return <div className="flex items-center px-2 py-1.5"><input type="checkbox" defaultChecked={!!defaultValue} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--flux-coral)]" /></div>;
  }
  if (type === "select") {
    return (
      <Select defaultValue={defaultValue ?? ""} onValueChange={onChange}>
        <SelectTrigger className="h-8 border-0 bg-transparent shadow-none focus:ring-0"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>{(options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  return (
    <input
      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
      defaultValue={defaultValue ?? ""}
      onChange={(e) => onChange(type === "number" ? e.target.value : e.target.value)}
      className="w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-background"
    />
  );
}

function AddColumnDialog({ open, onOpenChange, onAdd }: any) {
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="add-column-dialog">
        <DialogHeader><DialogTitle>Add column</DialogTitle></DialogHeader>
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
