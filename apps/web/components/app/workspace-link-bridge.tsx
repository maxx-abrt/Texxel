"use client";

import * as React from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  useWorkspace as useCoreWorkspace,
  useCoreMutation,
  coreApi,
} from "@a2e/core";
import { api } from "@/convex/_generated/api";

/**
 * Workspace link bridge (Pattern B) — reconciles Bureau's local workspaces
 * with A2E Core on every login, in both directions:
 *
 *  1. core → local (`coreSync.syncFromCore`): materializes local mirrors for
 *     every core workspace the user belongs to (created in Bilan, the
 *     auto-provisioned personal one, …) and links owned local twins by
 *     normalized name. Runs FIRST so the switcher/onboarding never see a
 *     stale empty list and no duplicate core workspace is created for
 *     something the server heuristic can link.
 *  2. local → core: for each remaining unlinked local workspace the user
 *     owns, creates the core workspace with the user's own token
 *     (`workspaces.create`), stamps `coreId` server-side (ownership
 *     re-verified), then imports the other local members via the service
 *     bridge with their verified local roles.
 *
 * Idempotent: safe to re-run on every login; subsequent runs are no-ops.
 * Renders `fallback` until the first core→local pass settles so the app shell
 * (and its onboarding gate) never flashes a stale empty workspace list.
 */

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function WorkspaceLinkBridge({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isAuthenticated } = useConvexAuth();
  const { workspaces: coreWorkspaces } = useCoreWorkspace();
  const localWorkspaces = useQuery(
    api.workspaces.listMine,
    isAuthenticated ? {} : "skip",
  );
  const syncFromCore = useAction(api.coreSync.syncFromCore);
  const stampCoreId = useMutation(api.coreSync.stampCoreId);
  const importLocalMembers = useAction(api.coreSync.importLocalMembers);
  const createCoreWorkspace = useCoreMutation(coreApi.workspaces.create);

  const [settled, setSettled] = React.useState(false);
  const syncing = React.useRef(false);
  const pushing = React.useRef(false);

  const coreIds = (coreWorkspaces ?? []).map((w) => w._id).join(",");
  const localKey = (localWorkspaces ?? [])
    .map((w) => `${w._id}:${w.coreId ?? ""}`)
    .join(",");

  // Pass 1 — core → local (mirrors + heuristic links).
  React.useEffect(() => {
    if (!isAuthenticated || !coreWorkspaces || !localWorkspaces) return;
    if (syncing.current) return;
    syncing.current = true;
    syncFromCore()
      .catch((err) => console.error("[a2e] syncFromCore failed (will retry):", err))
      .finally(() => {
        syncing.current = false;
        setSettled(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, coreIds, localKey]);

  // Pass 2 — local → core (create + stamp + import members).
  React.useEffect(() => {
    if (!settled || !isAuthenticated || !coreWorkspaces || !localWorkspaces) return;
    if (pushing.current) return;
    const toCreate = localWorkspaces.filter((w) => !w.coreId && w.role === "owner");
    if (toCreate.length === 0) return;
    pushing.current = true;
    const coreNames = new Set(coreWorkspaces.map((w) => normalizeName(w.name)));
    (async () => {
      try {
        for (const w of toCreate) {
          try {
            if (coreNames.has(normalizeName(w.name))) {
              // A core twin exists but this local row isn't linked yet — let
              // the server-side name heuristic stamp it instead of duplicating.
              await syncFromCore();
              continue;
            }
            const coreId = await createCoreWorkspace({
              name: w.name,
              ...(w.type === "business" || w.type === "association"
                ? { type: w.type }
                : {}),
              ...(w.locale ? { locale: w.locale } : {}),
              ...(w.currency ? { currency: w.currency } : {}),
            });
            await stampCoreId({ localWorkspaceId: w._id, coreId });
            // Member import is best-effort: members who never logged into a
            // core-connected app are skipped server-side and self-heal on
            // their own first login.
            await importLocalMembers({ localWorkspaceId: w._id }).catch(() => undefined);
            coreNames.add(normalizeName(w.name));
          } catch (err) {
            console.error(
              `[a2e] failed to link workspace "${w.name}" to core (will retry on next load):`,
              err,
            );
          }
        }
      } finally {
        pushing.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, isAuthenticated, coreIds, localKey]);

  if (isAuthenticated && !settled) return <>{fallback}</>;
  return <>{children}</>;
}
