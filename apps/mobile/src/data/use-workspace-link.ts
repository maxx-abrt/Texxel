import { useEffect, useRef, useState } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  useWorkspace as useCoreWorkspace,
  useCoreMutation,
  coreApi,
} from "@a2e/core";

import { convexApi } from "./convex-api";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Workspace link bridge (Pattern B) — mobile copy of
 * `apps/web/components/app/workspace-link-bridge.tsx`. Keep the two in sync.
 *
 * Reconciles Bureau's local workspaces with A2E Core on every login:
 *  1. core → local (`coreSync.syncFromCore`): mirrors + name-heuristic links.
 *  2. local → core: create core twins for owned unlinked locals, stamp
 *     `coreId`, import the other members via the service bridge.
 *
 * Idempotent: safe to re-run on every login; later runs are no-ops.
 */
export function WorkspaceLinkBridge() {
  const { isAuthenticated } = useConvexAuth();
  const { workspaces: coreWorkspaces } = useCoreWorkspace();
  const localWorkspaces = useQuery(
    convexApi.workspaces.listMine,
    isAuthenticated ? {} : "skip",
  );
  const syncFromCore = useAction(convexApi.coreSync.syncFromCore);
  const stampCoreId = useMutation(convexApi.coreSync.stampCoreId);
  const importLocalMembers = useAction(convexApi.coreSync.importLocalMembers);
  const createCoreWorkspace = useCoreMutation(coreApi.workspaces.create);

  const [settled, setSettled] = useState(false);
  const syncing = useRef(false);
  const pushing = useRef(false);

  const coreIds = (coreWorkspaces ?? []).map((w) => w._id).join(",");
  const localKey = (localWorkspaces ?? [])
    .map((w) => `${w._id}:${w.coreId ?? ""}`)
    .join(",");

  // Pass 1 — core → local (mirrors + heuristic links).
  useEffect(() => {
    if (!isAuthenticated || !coreWorkspaces || !localWorkspaces) return;
    if (syncing.current) return;
    syncing.current = true;
    syncFromCore({})
      .catch((err) => console.error("[a2e] syncFromCore failed (will retry):", err))
      .finally(() => {
        syncing.current = false;
        setSettled(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, coreIds, localKey]);

  // Pass 2 — local → core (create + stamp + import members).
  useEffect(() => {
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
              // Core twin exists but isn't linked yet — let the server
              // heuristic stamp it instead of duplicating.
              await syncFromCore({});
              continue;
            }
            const coreId = await createCoreWorkspace({ name: w.name });
            await stampCoreId({ localWorkspaceId: w._id, coreId });
            // Best-effort: unprovisioned members self-heal on their own login.
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

  return null;
}
