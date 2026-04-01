"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ExtensionConfig {
  id: string;
  category: "productivity" | "visualization" | "collaboration" | "ai";
  enabled: boolean;
}

export interface UIConfig {
  sidebarWidth: number;
  fontSize: "sm" | "base" | "lg";
  fontFamily: "system" | "inter" | "mono" | "serif";
  compactMode: boolean;
  showWordCount: boolean;
  defaultTaskView: "list" | "board";
  defaultProjectView: "board" | "list" | "gantt";
  editorWidth: "default" | "wide" | "full";
}

interface WorkspaceExtensions {
  extensions: ExtensionConfig[];
  uiConfig: UIConfig;
}

interface ExtensionsState {
  workspaceId: string | null;
  workspaceData: Record<string, WorkspaceExtensions>;
  setWorkspaceId: (id: string | null) => void;
  toggleExtension: (id: string) => void;
  isEnabled: (id: string) => boolean;
  updateUIConfig: (patch: Partial<UIConfig>) => void;
  getExtensions: () => ExtensionConfig[];
  getUIConfig: () => UIConfig;
}

const DEFAULT_EXTENSIONS: ExtensionConfig[] = [
  { id: "kanban", category: "productivity", enabled: true },
  { id: "gantt", category: "visualization", enabled: true },
  { id: "retroPlanning", category: "visualization", enabled: true },
  { id: "aiAssistant", category: "ai", enabled: false },
  { id: "calendar", category: "productivity", enabled: true },
  { id: "timeTracking", category: "productivity", enabled: true },
  { id: "customFields", category: "productivity", enabled: true },
  { id: "automations", category: "ai", enabled: false },
];

const DEFAULT_UI: UIConfig = {
  sidebarWidth: 252,
  fontSize: "base",
  fontFamily: "system",
  compactMode: false,
  showWordCount: true,
  defaultTaskView: "list",
  defaultProjectView: "board",
  editorWidth: "default",
};

const DEFAULT_WS_DATA: WorkspaceExtensions = {
  extensions: DEFAULT_EXTENSIONS,
  uiConfig: DEFAULT_UI,
};

const getWsData = (state: ExtensionsState): WorkspaceExtensions => {
  const key = state.workspaceId ?? "_default";
  return state.workspaceData[key] ?? DEFAULT_WS_DATA;
};

export const useExtensions = create<ExtensionsState>()(
  persist(
    (set, get) => ({
      workspaceId: null,
      workspaceData: {},

      setWorkspaceId: (id) => set({ workspaceId: id }),

      toggleExtension: (id: string) =>
        set((state) => {
          const key = state.workspaceId ?? "_default";
          const current = state.workspaceData[key] ?? DEFAULT_WS_DATA;
          return {
            workspaceData: {
              ...state.workspaceData,
              [key]: {
                ...current,
                extensions: current.extensions.map((ext) =>
                  ext.id === id ? { ...ext, enabled: !ext.enabled } : ext,
                ),
              },
            },
          };
        }),

      isEnabled: (id: string) => {
        const data = getWsData(get());
        const ext = data.extensions.find((e) => e.id === id);
        return ext?.enabled ?? false;
      },

      updateUIConfig: (patch: Partial<UIConfig>) =>
        set((state) => {
          const key = state.workspaceId ?? "_default";
          const current = state.workspaceData[key] ?? DEFAULT_WS_DATA;
          return {
            workspaceData: {
              ...state.workspaceData,
              [key]: {
                ...current,
                uiConfig: { ...current.uiConfig, ...patch },
              },
            },
          };
        }),

      getExtensions: () => getWsData(get()).extensions,
      getUIConfig: () => getWsData(get()).uiConfig,
    }),
    {
      name: "texxel-extensions",
    },
  ),
);

// Helper hooks for cleaner access
export const useCurrentExtensions = () => {
  const store = useExtensions();
  return store.getExtensions();
};

export const useCurrentUIConfig = () => {
  const store = useExtensions();
  return store.getUIConfig();
};
