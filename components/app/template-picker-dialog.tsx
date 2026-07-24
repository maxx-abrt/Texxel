"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { getBuiltinTemplates, DocTemplate } from "@/lib/doc-templates";
import { parseNotionExport } from "@/lib/notion-import";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, Upload, FileText } from "lucide-react";
import { DocumentText, SearchNormal1, Trash } from "iconsax-reactjs";

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: Id<"flux_documents">;
  onSelect: (opts: { title: string; content?: string; icon?: string; parentId?: Id<"flux_documents"> }) => void;
  initialTab?: "templates" | "import";
}

export function TemplatePickerDialog({ open, onOpenChange, parentId, onSelect, initialTab = "templates" }: TemplatePickerDialogProps) {
  const locale = useLocale();
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const { activeWorkspaceId } = useWorkspace();
  const router = useRouter();
  const [tab, setTab] = useState<"templates" | "import">(initialTab);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const builtin = getBuiltinTemplates(locale);
  const saved = useQuery(
    api.flux_docTemplates.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const removeTemplate = useMutation(api.flux_docTemplates.remove);
  const createDoc = useMutation(api.flux_documents.create);

  // ── Import state ──
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleBlank = () => {
    onSelect({ title: tc("untitled"), parentId });
    onOpenChange(false);
  };

  const handleTemplate = (tpl: DocTemplate | any, isSaved = false) => {
    const content = isSaved ? tpl.content : JSON.stringify(tpl.blocks);
    onSelect({
      title: isSaved ? tpl.title : tpl.title,
      content,
      icon: tpl.icon,
      parentId,
    });
    onOpenChange(false);
  };

  // ── Import handlers ──
  const resetImport = () => {
    setFiles([]);
    setImporting(false);
    setImportedCount(0);
    setImportError(null);
    setDragOver(false);
  };

  const handleFiles = (newFiles: FileList | File[]) => {
    const accepted = Array.from(newFiles).filter(
      (f) => f.name.endsWith(".html") || f.name.endsWith(".htm") || f.type === "text/html",
    );
    if (accepted.length === 0) {
      setImportError(t("importFileHint"));
      return;
    }
    setImportError(null);
    setFiles((prev) => [...prev, ...accepted]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleImport = async () => {
    if (files.length === 0 || !activeWorkspaceId) return;
    setImporting(true);
    setImportedCount(0);
    setImportError(null);
    try {
      const pages = await parseNotionExport(files);
      let lastId: string | undefined;
      for (const page of pages) {
        const id = await createDoc({
          workspaceId: activeWorkspaceId,
          title: page.title,
          content: page.content,
          icon: page.icon,
          parentId,
        });
        lastId = id as string;
        setImportedCount((c) => c + 1);
      }
      toast.success(t("importSuccess", { count: pages.length }));
      resetImport();
      onOpenChange(false);
      if (lastId) router.push(`/app/documents/${lastId}`);
    } catch {
      setImportError(t("importFailed"));
    } finally {
      setImporting(false);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Filtered templates ──
  const filteredBuiltin = search.trim()
    ? builtin.filter((tpl) =>
        tpl.title.toLowerCase().includes(search.toLowerCase()) ||
        tpl.description.toLowerCase().includes(search.toLowerCase()) ||
        tpl.category.toLowerCase().includes(search.toLowerCase()),
      )
    : builtin;
  const categories = Array.from(new Set(filteredBuiltin.map((t) => t.category)));
  const filteredSaved = (saved ?? []).filter((tpl: any) =>
    !search.trim() || (tpl.title ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetImport(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden" data-testid="template-picker">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-base font-semibold">{t("templateDialogTitle")}</DialogTitle>
          <DialogDescription>{t("templateDialogDesc")}</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          <button
            onClick={() => setTab("templates")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === "templates"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-testid="tab-templates"
          >
            <DocumentText variant="Bulk" size={16} /> {t("templatesTab")}
          </button>
          <button
            onClick={() => setTab("import")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === "import"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-testid="tab-import"
          >
            <Upload variant="Bulk" size={16} /> {t("importTab")}
          </button>
        </div>

        {/* Tab content */}
        {tab === "templates" ? (
          <div className="px-6 pb-6 pt-4">
            {/* Search */}
            <div className="relative mb-4">
              <SearchNormal1 variant="Bulk" size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchTemplates")}
                className="w-full rounded-lg border border-border bg-muted/30 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background"
              />
            </div>

            <div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1">
              {/* Blank option */}
              {!search.trim() && (
                <button
                  onClick={handleBlank}
                  onMouseEnter={() => setHoveredId("blank")}
                  onMouseLeave={() => setHoveredId(null)}
                  data-testid="template-blank"
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-all hover:shadow-sm",
                    hoveredId === "blank" ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-2xl">📄</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t("blankDocument")}</p>
                    <p className="text-xs text-muted-foreground">{t("startFromScratch")}</p>
                  </div>
                </button>
              )}

              {/* Built-in templates grouped by category */}
              {categories.length > 0 ? (
                categories.map((cat) => (
                  <div key={cat}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{cat}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredBuiltin.filter((tpl) => tpl.category === cat).map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => handleTemplate(tpl)}
                          onMouseEnter={() => setHoveredId(tpl.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          data-testid={`template-${tpl.id}`}
                          className={cn(
                            "flex flex-col gap-2 rounded-xl border border-border p-3 text-left transition-all hover:shadow-sm",
                            hoveredId === tpl.id ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">{tpl.icon}</span>
                            <p className="truncate text-sm font-semibold">{tpl.title}</p>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{tpl.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <DocumentText variant="Bulk" size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">{t("noTemplatesFound")}</p>
                </div>
              )}

              {/* Saved workspace templates */}
              {!search.trim() && filteredSaved.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("savedTemplates")}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredSaved.map((tpl: any) => (
                      <div
                        key={tpl._id}
                        className={cn(
                          "group flex flex-col gap-2 rounded-xl border border-border p-3 transition-all hover:shadow-sm",
                          hoveredId === tpl._id ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40",
                        )}
                        onMouseEnter={() => setHoveredId(tpl._id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <button
                          onClick={() => handleTemplate(tpl, true)}
                          className="flex items-center gap-2 text-left"
                          data-testid="template-saved"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">{tpl.icon ?? "📄"}</span>
                          <p className="truncate text-sm font-semibold">{tpl.title}</p>
                        </button>
                        <div className="flex items-center justify-between">
                          <p className="truncate text-xs text-muted-foreground">{tpl.category ?? ""}</p>
                          <button
                            onClick={() => removeTemplate({ templateId: tpl._id })}
                            className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                          >
                            <Trash variant="Bulk" size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Import tab */
          <div className="px-6 pb-6 pt-4">
            <p className="mb-4 text-sm text-muted-foreground">{t("importDesc")}</p>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40",
              )}
            >
              <Upload variant="Bulk" size={32} className={cn("mb-3", dragOver ? "text-primary" : "text-muted-foreground/50")} />
              <p className="text-sm font-medium">
                {dragOver ? t("importDragDrop") : t("importDragDrop")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("importClickBrowse")}</p>
              <input
                type="file"
                accept=".html,.htm"
                multiple
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
                {files.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <FileText size={16} className="shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)}KB
                    </span>
                    {!importing && (
                      <button
                        onClick={() => removeFile(idx)}
                        className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Import progress */}
            {importing && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("importing")} {importedCount + 1} / {files.length}...
              </div>
            )}

            {/* Success */}
            {!importing && importedCount > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                {t("importSuccess", { count: importedCount })}
              </div>
            )}

            {/* Error */}
            {importError && (
              <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {importError}
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { resetImport(); onOpenChange(false); }} disabled={importing}>
                {tc("cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={files.length === 0 || importing}
                className="gap-1.5"
                data-testid="import-confirm"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("importing")}
                  </>
                ) : (
                  <>
                    <Upload variant="Bulk" size={16} />
                    {files.length > 1 ? `${t("importCta")} (${files.length})` : t("importCta")}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
