"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { History, RotateCcw, X, Clock, Save, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VersionHistoryPanelProps {
  documentId: Id<"documents">;
  onClose: () => void;
  onRestore?: () => void;
}

function formatRelativeTime(
  ts: number,
  tc: (key: string) => string,
): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return tc("justNow");
  if (m < 60) return `${m}${tc("minAgo")}`;
  if (h < 24) return `${h}${tc("hAgo")}`;
  if (d < 7) return `${d}${tc("dAgo")}`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VersionHistoryPanel({ documentId, onClose, onRestore }: VersionHistoryPanelProps) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const versions = useQuery(api.documents.getVersions, { documentId });
  const saveVersion = useMutation(api.documents.saveVersion);
  const restoreVersion = useMutation(api.documents.restoreVersion);

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveVersion({ documentId });
      toast.success(t("vhSaved"));
    } catch (err: any) {
      toast.error(err.message ?? t("vhSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async (versionId: Id<"documentVersions">) => {
    setRestoringId(versionId);
    try {
      await restoreVersion({ versionId });
      toast.success(t("vhRestored"));
      onRestore?.();
    } catch (err: any) {
      toast.error(err.message ?? t("vhRestoreFailed"));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-72 border-l bg-background shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-tight">{t("vhTitle")}</span>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("vhTitle")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Save current version */}
      <div className="px-3 py-2.5 border-b shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 gap-1.5 text-xs"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? t("vhSaving") : t("vhSave")}
        </Button>
        <p className="mt-1.5 text-[10px] text-muted-foreground text-center">
          {t("vhAutoHint")}
        </p>
      </div>

      {/* Versions list */}
      <div className="flex-1 overflow-y-auto">
        {versions === undefined && (
          <div className="flex flex-col gap-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {versions !== undefined && versions.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">{t("vhEmpty")}</p>
            <p className="text-xs text-muted-foreground/70">{t("vhEmptyDesc")}</p>
          </div>
        )}

        {versions !== undefined && versions.length > 0 && (
          <div className="p-2 space-y-1">
            {versions.map((v, idx) => {
              const isExpanded = expandedId === v._id;
              const isRestoring = restoringId === v._id;
              return (
                <div
                  key={v._id}
                  className={cn(
                    "group rounded-lg border bg-card/50 transition-colors hover:bg-accent/30",
                    isExpanded && "bg-accent/20",
                  )}
                >
                  <button
                    type="button"
                    className="w-full flex items-start gap-2.5 p-2.5 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : v._id)}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium truncate">
                          {v.label ?? (idx === 0 ? t("vhLatest") : t("vhVersion", { n: versions.length - idx }))}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatRelativeTime(v.savedAt, tc)}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDateTime(v.savedAt)}
                        {v.savedByName && ` · ${v.savedByName}`}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 pt-0">
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full h-7 gap-1.5 text-xs"
                        onClick={() => handleRestore(v._id as Id<"documentVersions">)}
                        disabled={isRestoring}
                      >
                        <RotateCcw className="h-3 w-3" />
                        {isRestoring ? t("vhRestoring") : t("vhRestore")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
