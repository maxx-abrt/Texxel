"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type WorkspaceSummary = {
  _id: Id<"workspaces">;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
  type?: string;
};

type Ctx = {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  activeWorkspaceId: Id<"workspaces"> | null;
  setActive: (id: Id<"workspaces">) => void;
  me: any;
  isLoading: boolean;
  needsOnboarding: boolean;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const workspaces = useQuery(api.workspaces.listMine) as
    | WorkspaceSummary[]
    | undefined;
  const prefs = useQuery(api.flux_userPrefs.get);
  const me = useQuery(api.users.me);
  const ensure = useMutation(api.flux_userPrefs.ensure);
  const updatePrefs = useMutation(api.flux_userPrefs.update);
  const [activeId, setActiveId] = useState<Id<"workspaces"> | null>(null);

  useEffect(() => {
    ensure({}).catch(() => {});
  }, [ensure]);

  useEffect(() => {
    if (!workspaces) return;
    if (activeId && workspaces.some((w) => w._id === activeId)) return;
    const last = prefs?.lastWorkspaceId as Id<"workspaces"> | undefined;
    const fromLast = last && workspaces.find((w) => w._id === last);
    const next = (fromLast?._id ?? workspaces[0]?._id ?? null) as
      | Id<"workspaces">
      | null;
    setActiveId(next);
  }, [workspaces, prefs, activeId]);

  const setActive = (id: Id<"workspaces">) => {
    setActiveId(id);
    updatePrefs({ lastWorkspaceId: id }).catch(() => {});
  };

  const value = useMemo<Ctx>(
    () => ({
      workspaces: workspaces ?? [],
      activeWorkspace: workspaces?.find((w) => w._id === activeId) ?? null,
      activeWorkspaceId: activeId,
      setActive,
      me: me ?? null,
      isLoading: workspaces === undefined,
      needsOnboarding: workspaces !== undefined && workspaces.length === 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaces, activeId, me],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const c = useContext(WorkspaceContext);
  if (!c) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return c;
}
