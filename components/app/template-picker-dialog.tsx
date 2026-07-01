"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { getBuiltinTemplates, DocTemplate } from "@/lib/doc-templates";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: Id<"flux_documents">;
  onSelect: (opts: { title: string; content?: string; icon?: string; parentId?: Id<"flux_documents"> }) => void;
}

export function TemplatePickerDialog({ open, onOpenChange, parentId, onSelect }: TemplatePickerDialogProps) {
  const locale = useLocale();
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const { activeWorkspaceId } = useWorkspace();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const builtin = getBuiltinTemplates(locale);
  const saved = useQuery(
    api.flux_docTemplates.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

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

  const categories = Array.from(new Set(builtin.map((t) => t.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="template-picker">
        <DialogHeader>
          <DialogTitle>{t("templateDialogTitle")}</DialogTitle>
          <p className="text-sm text-muted-foreground">{t("templateDialogDesc")}</p>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-5 pr-1">
          {/* Blank option */}
          <div>
            <button
              onClick={handleBlank}
              onMouseEnter={() => setHoveredId("blank")}
              onMouseLeave={() => setHoveredId(null)}
              data-testid="template-blank"
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/60",
                hoveredId === "blank" && "border-primary bg-muted/60",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">📄</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t("blankDocument")}</p>
                <p className="text-xs text-muted-foreground">{t("startFromScratch")}</p>
              </div>
            </button>
          </div>

          {/* Built-in templates grouped by category */}
          {categories.map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{cat}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {builtin.filter((tpl) => tpl.category === cat).map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleTemplate(tpl)}
                    onMouseEnter={() => setHoveredId(tpl.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    data-testid={`template-${tpl.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/60",
                      hoveredId === tpl.id && "border-primary bg-muted/60",
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">{tpl.icon}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{tpl.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{tpl.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Saved workspace templates */}
          {saved && saved.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("savedTemplates")}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {saved.map((tpl: any) => (
                  <button
                    key={tpl._id}
                    onClick={() => handleTemplate(tpl, true)}
                    onMouseEnter={() => setHoveredId(tpl._id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/60",
                      hoveredId === tpl._id && "border-primary bg-muted/60",
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">{tpl.icon ?? "📄"}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{tpl.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{tpl.category ?? ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
