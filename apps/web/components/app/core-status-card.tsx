"use client";

import * as React from "react";
import { useCoreAuthState } from "@a2e/core";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";
import { useCoreWorkspaceLink } from "@/hooks/use-core-workspace-link";
import { useCoreMigration } from "@/hooks/use-core-migration";
import { A2E_CORE_URL, A2E_CORE_URL_FROM_ENV } from "@/lib/core-config";
import { coreFlags, isCoreDegraded, resetCoreModules } from "@/lib/core-flags";
import { btnOutline } from "@/components/app/common";
import { cn } from "@/lib/utils";
import { TickCircle, CloseCircle, Refresh2, Link21, ImportSquare } from "iconsax-reactjs";

/**
 * Observability for the shared A2E Core layer.
 *
 * The suite's data sharing is otherwise invisible: when something is off (token
 * not trusted by core, workspace not linked yet, core module degraded after an
 * error) the app silently falls back to local data. This card makes each link in
 * the chain explicit so the state can be diagnosed in one glance — and lets an
 * owner link an unlinked workspace to the shared core on the spot.
 */
export function CoreStatusCard() {
  const t = useTranslations("settings.coreStatus");
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const { isAuthenticated, isLoading: isAuthLoading } = useCoreAuthState();
  const coreWsId = useCoreWorkspaceId();
  const { linkNewWorkspace } = useCoreWorkspaceLink();
  const migration = useCoreMigration();
  const [linking, setLinking] = React.useState(false);

  const linkedId = activeWorkspace?.coreId ?? null;
  const degraded = isCoreDegraded();
  const isOwner = activeWorkspace?.role === "owner";

  const activeModules = (
    ["notifications", "events", "tasks", "presence", "prefs", "search", "quotas", "roles", "activities", "contacts", "drive"] as const
  ).filter((m) => coreFlags[m]);

  const host = React.useMemo(() => {
    try {
      return new URL(A2E_CORE_URL).host;
    } catch {
      return A2E_CORE_URL;
    }
  }, []);

  const link = async () => {
    if (!activeWorkspaceId || !activeWorkspace?.name) return;
    setLinking(true);
    const id = await linkNewWorkspace(activeWorkspaceId, {
      name: activeWorkspace.name,
      type: (activeWorkspace as { type?: string }).type,
    });
    setLinking(false);
    if (id) toast.success(t("linkSuccess"));
    else toast.error(t("linkFailed"));
  };

  return (
    <div className="space-y-3" data-testid="core-status-card">
      <p className="text-xs text-muted-foreground">{t("hint")}</p>

      <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40 text-sm">
        <Row label={t("deployment")}>
          <span className="font-mono text-xs" data-testid="core-status-host">
            {host}
          </span>
          {!A2E_CORE_URL_FROM_ENV && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
              {t("fallbackUrl")}
            </span>
          )}
        </Row>

        <Row label={t("session")}>
          <Badge ok={isAuthenticated} pending={isAuthLoading} testId="core-status-session">
            {isAuthLoading ? t("checking") : isAuthenticated ? t("connected") : t("notConnected")}
          </Badge>
        </Row>

        <Row label={t("sharedWorkspace")}>
          {linkedId ? (
            <span className="font-mono text-xs" data-testid="core-status-linked-id">
              {linkedId}
            </span>
          ) : (
            <Badge ok={false} testId="core-status-linked-id">
              {t("notLinked")}
            </Badge>
          )}
        </Row>

        <Row label={t("membership")}>
          <Badge ok={!!coreWsId} pending={!!linkedId && !coreWsId} testId="core-status-membership">
            {coreWsId ? t("verified") : linkedId ? t("pending") : t("unavailable")}
          </Badge>
        </Row>

        <Row label={t("modules")}>
          <span className="text-xs text-muted-foreground" data-testid="core-status-modules">
            {degraded ? t("degraded") : activeModules.length ? activeModules.join(" · ") : t("allLocal")}
          </span>
        </Row>
      </dl>

      {coreWsId && migration.ready && (migration.remaining > 0 || migration.progress.step === "finished") && (
        <div className="rounded-2xl border border-border bg-card/40 p-3" data-testid="core-migration-block">
          <p className="text-sm font-medium">{t("migrationTitle")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground" data-testid="core-migration-counts">
            {migration.remaining > 0
              ? t("migrationCounts", { tasks: migration.counts.tasks, events: migration.counts.events })
              : t("migrationDone")}
          </p>

          {migration.progress.running && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.round((migration.progress.done / Math.max(migration.progress.total, 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("migrationProgress", { done: migration.progress.done, total: migration.progress.total })}
              </p>
            </div>
          )}

          {migration.progress.errors.length > 0 && (
            <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto text-[11px] text-destructive" data-testid="core-migration-errors">
              {migration.progress.errors.slice(0, 6).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}

          {migration.remaining > 0 && (
            <button
              onClick={migration.run}
              disabled={!migration.canRun}
              className={cn(btnOutline, "mt-3 h-9 text-xs")}
              data-testid="core-migration-run"
            >
              <ImportSquare variant="Bulk" size={15} />
              {migration.progress.running ? t("migrationRunning") : t("migrationRun")}
            </button>
          )}
          {migration.batched && !migration.progress.running && (
            <p className="mt-1 text-[11px] text-muted-foreground">{t("migrationBatched")}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!linkedId && isOwner && (
          <button onClick={link} disabled={linking} className={cn(btnOutline, "h-9 text-xs")} data-testid="core-status-link-btn">
            <Link21 variant="Bulk" size={15} /> {linking ? t("linking") : t("linkNow")}
          </button>
        )}
        {degraded && (
          <button
            onClick={() => {
              resetCoreModules();
              window.location.reload();
            }}
            className={cn(btnOutline, "h-9 text-xs")}
            data-testid="core-status-retry-btn"
          >
            <Refresh2 variant="Bulk" size={15} /> {t("retry")}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end text-right">{children}</dd>
    </div>
  );
}

function Badge({
  ok,
  pending,
  children,
  testId,
}: {
  ok: boolean;
  pending?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  const tone = pending
    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"
    : ok
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
      : "bg-muted text-muted-foreground";
  return (
    <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tone)} data-testid={testId}>
      {pending ? null : ok ? <TickCircle variant="Bulk" size={13} /> : <CloseCircle variant="Bulk" size={13} />}
      {children}
    </span>
  );
}
