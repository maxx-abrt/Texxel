import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarStateStore {
  isCollapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export const useSidebarState = create<SidebarStateStore>()(
  persist(
    (set) => ({
      isCollapsed: false,
      setCollapsed: (v) => set({ isCollapsed: v }),
    }),
    { name: "sidebar-collapsed" },
  ),
);
