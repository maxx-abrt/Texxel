"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { parseNotionExport } from "@/lib/notion-import";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const router = useRouter();
  const createWithContent = useMutation(api.documents.createWithContent);
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFiles([]);
    setImporting(false);
    setImportedCount(0);
    setError(null);
    setDragOver(false);
  };

  const handleClose = () => {
    if (!importing) {
      reset();
      onClose();
    }
  };

  const handleFiles = (newFiles: FileList | File[]) => {
    const accepted = Array.from(newFiles).filter(
      (f) =>
        f.name.endsWith(".html") ||
        f.name.endsWith(".htm") ||
        f.type === "text/html",
    );
    if (accepted.length === 0) {
      setError("Please select HTML files (.html or .htm).");
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...accepted]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleImport = async () => {
    if (files.length === 0) return;
    setImporting(true);
    setImportedCount(0);
    setError(null);

    try {
      const pages = await parseNotionExport(files);
      let lastId: string | undefined;

      for (const page of pages) {
        const id = await createWithContent({
          title: page.title,
          content: page.content,
          icon: page.icon,
        });
        lastId = id;
        setImportedCount((c) => c + 1);
      }

      toast.success(`Imported ${pages.length} note${pages.length !== 1 ? "s" : ""}!`);

      if (lastId) {
        router.push(`/documents/${lastId}`);
      }

      reset();
      onClose();
    } catch (err) {
      console.error("[import] Error:", err);
      setError("Import failed. Please check your files and try again.");
    } finally {
      setImporting(false);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import HTML
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Import HTML pages — works with Notion, Confluence, any exported HTML.
            Tables, headings, lists, and code blocks are all preserved.
          </p>

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
            <Upload className={cn("h-8 w-8 mb-3", dragOver ? "text-primary" : "text-muted-foreground/50")} />
            <p className="text-sm font-medium">
              {dragOver ? "Drop files here" : "Drag & drop HTML files"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
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
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(file.size / 1024).toFixed(0)}KB
                  </span>
                  {!importing && (
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-xs text-muted-foreground hover:text-destructive shrink-0"
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing {importedCount + 1} of {files.length}...
            </div>
          )}

          {/* Success */}
          {!importing && importedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Successfully imported {importedCount} note{importedCount !== 1 ? "s" : ""}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={importing}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={files.length === 0 || importing}
              className="gap-1.5"
            >
              {importing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  {files.length > 1 ? `Import ${files.length} files` : "Import"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
