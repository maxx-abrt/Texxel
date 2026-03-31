"use client";

import { create } from "zustand";
import { Id } from "@/convex/_generated/dataModel";

interface BulkSelectState {
  isSelecting: boolean;
  selectedIds: Set<string>;
  toggleSelecting: () => void;
  exitSelecting: () => void;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
}

export const useBulkSelect = create<BulkSelectState>((set, get) => ({
  isSelecting: false,
  selectedIds: new Set(),
  toggleSelecting: () =>
    set((s) => ({
      isSelecting: !s.isSelecting,
      selectedIds: !s.isSelecting ? new Set() : s.selectedIds,
    })),
  exitSelecting: () => set({ isSelecting: false, selectedIds: new Set() }),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  deselectAll: () => set({ selectedIds: new Set() }),
  isSelected: (id) => get().selectedIds.has(id),
}));
