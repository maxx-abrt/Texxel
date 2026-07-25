import { useMutation, useQuery } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/src/auth/auth-provider";
import { storage } from "@/src/utils/storage";
import { convexApi } from "./convex-api";
import { demoUser, demoWorkspace } from "./demo";
import type { VmWorkspace } from "./types";

const LAST_WORKSPACE_KEY = "bureau.workspace";

type WorkspaceValue = {
  /** `true` when data must come from Convex, `false` for the demo workspace. */
  live: boolean;
  loading: boolean;
  workspace: VmWorkspace | null;
  workspaces: VmWorkspace[];
  /** Convex workspace id, or `null` in demo mode — pass to Convex queries. */
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
  profile: { id: string | null; name: string | null; email: string | null; image: string | null };
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { mode, status, user } = useAuth();
  const live = mode === "live" && status === "authenticated";

  const [selected, setSelected] = useState<string | null>(null);
  const storeUser = useMutation(convexApi.users.store);

  // Ensure the Convex `users` row exists for this WorkOS identity.
  useEffect(() => {
    if (!live) return;
    void storeUser({} as never).catch(() => undefined);
  }, [live, storeUser]);

  useEffect(() => {
    let alive = true;
    void storage.getItem<string>(LAST_WORKSPACE_KEY, "").then((id) => {
      if (alive && typeof id === "string" && id) setSelected(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const remote = useQuery(convexApi.workspaces.listMine, live ? ({} as never) : "skip");

  const setWorkspaceId = useCallback((id: string) => {
    setSelected(id);
    void storage.setItem(LAST_WORKSPACE_KEY, id);
  }, []);

  const value = useMemo<WorkspaceValue>(() => {
    if (!live) {
      return {
        live: false,
        loading: false,
        workspace: demoWorkspace,
        workspaces: [demoWorkspace],
        workspaceId: null,
        setWorkspaceId,
        profile: demoUser,
      };
    }

    const workspaces: VmWorkspace[] = (remote ?? []).map((w) => ({
      id: w._id,
      name: w.name,
      slug: w.slug,
      role: w.role,
      memberCount: w.memberCount,
    }));
    const active = workspaces.find((w) => w.id === selected) ?? workspaces[0] ?? null;

    return {
      live: true,
      loading: remote === undefined,
      workspace: active,
      workspaces,
      workspaceId: active?.id ?? null,
      setWorkspaceId,
      profile: {
        id: user?.id ?? null,
        name: user?.name ?? null,
        email: user?.email ?? null,
        image: user?.image ?? null,
      },
    };
  }, [live, remote, selected, setWorkspaceId, user]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
