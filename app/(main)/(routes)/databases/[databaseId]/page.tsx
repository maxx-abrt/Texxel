"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  Database,
  GripVertical,
  Hash,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  Settings2,
  Tag,
  Text,
  Trash2,
  Type,
  Calendar,
  User,
  X,
} from "lucide-react";

interface Column {
  id: string;
  name: string;
  type: "text" | "number" | "select" | "multiSelect" | "date" | "checkbox" | "url" | "person";
  options?: string[];
  width?: number;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  number: Hash,
  select: Tag,
  multiSelect: ListChecks,
  date: Calendar,
  checkbox: Check,
  url: Link2,
  person: User,
};

const SELECT_COLORS = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-red-500/15 text-red-700 dark:text-red-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "bg-slate-500/15 text-slate-700 dark:text-slate-300",
];

function getSelectColor(value: string, options: string[] = []) {
  const idx = options.indexOf(value);
  return SELECT_COLORS[idx >= 0 ? idx % SELECT_COLORS.length : Math.abs(value.charCodeAt(0)) % SELECT_COLORS.length];
}

// ─── Cell renderer ───────────────────────────────────────────────────────────

function CellEditor({
  col,
  value,
  onChange,
}: {
  col: Column;
  value: any;
  onChange: (val: any) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (col.type === "checkbox") {
    return (
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "h-4 w-4 rounded border flex items-center justify-center transition-colors",
          value ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary/50",
        )}
      >
        {value && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
      </button>
    );
  }

  if (col.type === "select" && col.options) {
    return (
      <div className="flex flex-wrap gap-1">
        {col.options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(value === opt ? "" : opt)}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium transition-all",
              value === opt
                ? getSelectColor(opt, col.options)
                : "bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (col.type === "multiSelect" && col.options) {
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-1">
        {col.options.map((opt) => {
          const isActive = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => {
                const next = isActive ? selected.filter((s) => s !== opt) : [...selected, opt];
                onChange(next);
              }}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium transition-all",
                isActive
                  ? getSelectColor(opt, col.options)
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  // Default: inline text/number/date/url editing
  if (editing) {
    return (
      <input
        autoFocus
        type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
        defaultValue={value ?? ""}
        onBlur={(e) => { onChange(col.type === "number" ? Number(e.target.value) : e.target.value); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full bg-transparent text-xs outline-none border-b border-primary/30 py-0.5"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-left text-xs truncate text-foreground/80 hover:text-foreground py-0.5 min-h-[20px]"
    >
      {col.type === "url" && value ? (
        <span className="text-primary underline">{value}</span>
      ) : (
        value ?? <span className="text-muted-foreground/30">—</span>
      )}
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DatabaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("databases");
  const tc = useTranslations("common");
  const databaseId = params.databaseId as Id<"databases">;

  const database = useQuery(api.databases.getById, { id: databaseId });
  const rows = useQuery(api.databases.getRows, { databaseId });
  const updateDb = useMutation(api.databases.update);
  const addRow = useMutation(api.databases.addRow);
  const updateRow = useMutation(api.databases.updateRow);
  const deleteRow = useMutation(api.databases.deleteRow);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<Column["type"]>("text");

  const columns: Column[] = (() => {
    try { return database ? JSON.parse(database.columns) : []; }
    catch { return []; }
  })();

  const handleCellChange = useCallback(
    async (rowId: Id<"databaseRows">, colId: string, value: any, currentCells: Record<string, any>) => {
      const next = { ...currentCells, [colId]: value };
      try {
        await updateRow({ id: rowId, cells: JSON.stringify(next) });
      } catch {
        toast.error(t("updateFailed"));
      }
    },
    [updateRow, t],
  );

  const handleAddRow = async () => {
    try {
      await addRow({ databaseId });
    } catch {
      toast.error(t("createFailed"));
    }
  };

  const handleAddColumn = async () => {
    if (!newColName.trim()) return;
    const id = `col_${Date.now()}`;
    const newCol: Column = {
      id,
      name: newColName.trim(),
      type: newColType,
      ...(newColType === "select" || newColType === "multiSelect"
        ? { options: ["Option 1", "Option 2", "Option 3"] }
        : {}),
    };
    const updated = [...columns, newCol];
    try {
      await updateDb({ id: databaseId, columns: JSON.stringify(updated) });
      setNewColName("");
      setShowAddCol(false);
    } catch {
      toast.error(t("updateFailed"));
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    const updated = columns.filter((c) => c.id !== colId);
    try {
      await updateDb({ id: databaseId, columns: JSON.stringify(updated) });
    } catch {
      toast.error(t("updateFailed"));
    }
  };

  const handleSaveTitle = async () => {
    if (title.trim() && title.trim() !== database?.title) {
      await updateDb({ id: databaseId, title: title.trim() });
    }
    setEditingTitle(false);
  };

  if (database === undefined) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!database) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Database className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">{t("notFound")}</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/databases")} className="mt-3 gap-2">
            <ArrowLeft className="h-3 w-3" /> {t("backToList")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 md:px-10">
        <button
          onClick={() => router.push("/databases")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> {t("backToList")}
        </button>

        <div className="flex items-center gap-3">
          <span className="text-2xl">{database.icon ?? "📊"}</span>
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="text-2xl font-bold bg-transparent outline-none border-b-2 border-primary/30"
            />
          ) : (
            <h1
              onClick={() => { setTitle(database.title); setEditingTitle(true); }}
              className="text-2xl font-bold tracking-tight cursor-pointer hover:text-primary/80 transition-colors"
            >
              {database.title}
            </h1>
          )}
        </div>
        {database.description && (
          <p className="text-sm text-muted-foreground mt-1 ml-10">{database.description}</p>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6 md:px-10">
        <div className="rounded-xl border overflow-hidden min-w-fit">
          {/* Column headers */}
          <div className="flex bg-muted/40 border-b sticky top-0 z-10">
            <div className="w-10 shrink-0 border-r flex items-center justify-center text-muted-foreground/30">
              <Hash className="h-3 w-3" />
            </div>
            {columns.map((col) => {
              const Icon = TYPE_ICONS[col.type] ?? Text;
              return (
                <div
                  key={col.id}
                  className="group flex items-center gap-1.5 px-3 py-2 border-r text-xs font-semibold text-muted-foreground shrink-0"
                  style={{ width: col.width ?? 180 }}
                >
                  <Icon className="h-3 w-3 shrink-0 opacity-50" />
                  <span className="truncate flex-1">{col.name}</span>
                  <button
                    onClick={() => handleDeleteColumn(col.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
            {/* Add column button */}
            <div className="flex items-center px-2 shrink-0">
              {showAddCol ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") setShowAddCol(false); }}
                    placeholder={t("columnName")}
                    className="h-6 w-24 text-[11px]"
                  />
                  <select
                    value={newColType}
                    onChange={(e) => setNewColType(e.target.value as any)}
                    className="h-6 rounded border text-[10px] bg-background px-1"
                  >
                    {["text", "number", "select", "multiSelect", "date", "checkbox", "url"].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <button onClick={handleAddColumn} className="text-primary hover:text-primary/80">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setShowAddCol(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddCol(true)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-accent"
                >
                  <Plus className="h-3 w-3" /> {t("addColumn")}
                </button>
              )}
            </div>
          </div>

          {/* Rows */}
          {(rows ?? []).map((row, i) => {
            let cells: Record<string, any> = {};
            try { cells = JSON.parse(row.cells); } catch {}

            return (
              <div key={row._id} className="flex border-b hover:bg-accent/20 transition-colors group/row">
                <div className="w-10 shrink-0 border-r flex items-center justify-center text-[10px] text-muted-foreground/40 relative">
                  <span className="group-hover/row:hidden">{i + 1}</span>
                  <button
                    onClick={() => deleteRow({ id: row._id })}
                    className="hidden group-hover/row:flex h-full w-full items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-500/5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {columns.map((col) => (
                  <div
                    key={col.id}
                    className="px-3 py-1.5 border-r shrink-0 flex items-center"
                    style={{ width: col.width ?? 180 }}
                  >
                    <CellEditor
                      col={col}
                      value={cells[col.id]}
                      onChange={(val) => handleCellChange(row._id, col.id, val, cells)}
                    />
                  </div>
                ))}
              </div>
            );
          })}

          {/* Add row */}
          <button
            onClick={handleAddRow}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-accent/30 transition-colors"
          >
            <Plus className="h-3 w-3" /> {t("addRow")}
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
          <span>{(rows ?? []).length} {t("rows")}</span>
          <span>{columns.length} {t("columns")}</span>
        </div>
      </div>
    </div>
  );
}
