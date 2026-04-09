"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  ArrowRight,
  Database,
  Plus,
  Search,
  Table2,
  Trash2,
} from "lucide-react";

export default function DatabasesPage() {
  const t = useTranslations("databases");
  const tc = useTranslations("common");
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const wsId = activeWorkspaceId as any;
  const databases = useQuery(api.databases.getMyDatabases, { workspaceId: wsId });
  const createDb = useMutation(api.databases.create);
  const removeDb = useMutation(api.databases.remove);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const filtered = (databases ?? []).filter((db) =>
    !search || db.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const id = await createDb({ title: t("untitledDb"), workspaceId: wsId });
      router.push(`/databases/${id}`);
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: Id<"databases">, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("confirmDelete"))) return;
    try {
      await removeDb({ id });
      toast.success(t("deleted"));
    } catch {
      toast.error(t("deleteFailed"));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center">
              <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={isCreating} size="sm" className="gap-2 h-9">
            <Plus className="h-3.5 w-3.5" /> {t("newDatabase")}
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tc("search")}
            className="pl-9 h-9"
          />
        </div>

        {/* Databases grid */}
        {databases === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Table2 className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-semibold mb-1">
              {search ? tc("noResults") : t("empty")}
            </h3>
            <p className="text-xs text-muted-foreground max-w-[280px] mb-4">
              {search ? t("tryDifferent") : t("emptyDesc")}
            </p>
            {!search && (
              <Button onClick={handleCreate} size="sm" variant="outline" className="gap-2">
                <Plus className="h-3 w-3" /> {t("newDatabase")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((db) => {
              let colCount = 0;
              try { colCount = JSON.parse(db.columns).length; } catch {}

              return (
                <div
                  key={db._id}
                  onClick={() => router.push(`/databases/${db._id}`)}
                  className="group relative rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-lg"
                        style={{ backgroundColor: (db.color ?? "#06b6d4") + "15" }}
                      >
                        {db.icon ?? "📊"}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">
                          {db.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          {colCount} {t("columns")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(db._id, e)}
                      className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {db.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{db.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(db.createdAt).toLocaleDateString()}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
