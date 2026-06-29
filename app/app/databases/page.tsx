"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, PageHeader, EmptyState, btnPrimary, btnOutline, inputBase, timeAgo } from "@/components/app/common";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Data2, Add, Grid2 } from "iconsax-reactjs";

export default function DatabasesPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { activeWorkspaceId } = useWorkspace();
  const dbs = useQuery(api.flux_databases.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const create = useMutation(api.flux_databases.create);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useTranslations("databases");
  const tc = useTranslations("common");

  useEffect(() => { if (search.get("new") === "1") setOpen(true); }, [search]);

  const submit = async () => {
    if (!title.trim() || !activeWorkspaceId) return toast.error(t("nameRequired"));
    setBusy(true);
    try {
      const id = await create({ workspaceId: activeWorkspaceId, title: title.trim() });
      setOpen(false); setTitle("");
      router.push(`/app/databases/${id}`);
    } finally { setBusy(false); }
  };

  return (
    <PageContainer>
      <PageHeader title={t("title")} subtitle={t("subtitle")} icon={Data2} testId="databases-header"
        actions={<button onClick={() => setOpen(true)} className={btnPrimary} data-testid="new-database-btn"><Add variant="Bulk" size={18} /> {t("newDatabase")}</button>} />

      {dbs === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : dbs.length === 0 ? (
        <EmptyState icon={Data2} title={t("empty")} description={t("emptyDesc")} testId="databases-empty"
          action={<button onClick={() => setOpen(true)} className={btnPrimary}><Add variant="Bulk" size={18} /> {t("newDatabase")}</button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="databases-grid">
          {dbs.map((d: any) => (
            <Link key={d._id} href={`/app/databases/${d._id}`} data-testid="database-card" className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--flux-coral-soft)] text-primary">{d.icon ? <span className="text-xl">{d.icon}</span> : <Grid2 variant="Bulk" size={22} />}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold group-hover:text-primary">{d.title}</p>
                <p className="text-xs text-muted-foreground">{tc("updated")} {timeAgo(d.updatedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="database-create-dialog">
          <DialogHeader><DialogTitle>{t("newDatabaseTitle")}</DialogTitle><DialogDescription>{t("newDatabaseDesc")}</DialogDescription></DialogHeader>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={t("namePlaceholder")} className={inputBase} data-testid="database-name-input" />
          <DialogFooter>
            <button onClick={() => setOpen(false)} className={btnOutline}>{tc("cancel")}</button>
            <button onClick={submit} disabled={busy} className={btnPrimary} data-testid="database-create-submit">{busy ? t("creating") : tc("create")}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
