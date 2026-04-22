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
  /** UI density — applied as [data-density] on <html> */
  density: "compact" | "default" | "spacious";
  /** Corner radius scale — applied as [data-radius] on <html> */
  cornerStyle: "sharp" | "default" | "rounded";
  /** Ambient texture — applied as [data-texture] on <html> */
  texture: "flat" | "paper";
}

export interface AiAccessConfig {
  scope: "all" | "restricted";
  allowedDocumentIds: string[];
  allowedProjectIds: string[];
}

interface WorkspaceExtensions {
  extensions: ExtensionConfig[];
  uiConfig: UIConfig;
  aiAccess: AiAccessConfig;
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
  getAiAccess: () => AiAccessConfig;
  updateAiAccess: (patch: Partial<AiAccessConfig>) => void;
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
  { id: "focusTimer", category: "productivity", enabled: false },
  { id: "databases", category: "productivity", enabled: false },
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
  density: "default",
  cornerStyle: "default",
  texture: "flat",
};

const DEFAULT_AI_ACCESS: AiAccessConfig = {
  scope: "all",
  allowedDocumentIds: [],
  allowedProjectIds: [],
};

const DEFAULT_WS_DATA: WorkspaceExtensions = {
  extensions: DEFAULT_EXTENSIONS,
  uiConfig: DEFAULT_UI,
  aiAccess: DEFAULT_AI_ACCESS,
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
      // Merge persisted config with defaults so newly-added fields (density,
      // cornerStyle, texture…) are always populated even for stale stores.
      getUIConfig: () => ({ ...DEFAULT_UI, ...(getWsData(get()).uiConfig ?? {}) }),
      getAiAccess: () => getWsData(get()).aiAccess ?? DEFAULT_AI_ACCESS,
      updateAiAccess: (patch: Partial<AiAccessConfig>) =>
        set((state) => {
          const key = state.workspaceId ?? "_default";
          const current = state.workspaceData[key] ?? DEFAULT_WS_DATA;
          return {
            workspaceData: {
              ...state.workspaceData,
              [key]: {
                ...current,
                aiAccess: { ...(current.aiAccess ?? DEFAULT_AI_ACCESS), ...patch },
              },
            },
          };
        }),
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
