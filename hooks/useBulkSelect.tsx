"use client";

import { create } from "zustand";
import { Id } from "@/convex/_generated/dataModel";

interface BulkSelectState {
  isSelecting: boolean;
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  toggleSelecting: () => void;
  exitSelecting: () => void;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  toggleIds: (ids: string[]) => void;
  selectRange: (anchorId: string, targetId: string, orderedIds: string[]) => void;
}

export const useBulkSelect = create<BulkSelectState>((set, get) => ({
  isSelecting: false,
  selectedIds: new Set(),
  lastSelectedId: null,
  toggleSelecting: () =>
    set((s) => ({
      isSelecting: !s.isSelecting,
      selectedIds: !s.isSelecting ? new Set() : s.selectedIds,
    })),
  exitSelecting: () => set({ isSelecting: false, selectedIds: new Set(), lastSelectedId: null }),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next, lastSelectedId: id };
    }),
  selectAll: (ids) =>
    set({
      selectedIds: new Set(ids),
      lastSelectedId: ids[ids.length - 1] ?? null,
    }),
  deselectAll: () => set({ selectedIds: new Set(), lastSelectedId: null }),
  isSelected: (id) => get().selectedIds.has(id),
  toggleIds: (ids) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return { selectedIds: next, lastSelectedId: ids[ids.length - 1] ?? null };
    }),
  selectRange: (anchorId, targetId, orderedIds) =>
    set((s) => {
      const start = orderedIds.indexOf(anchorId);
      const end = orderedIds.indexOf(targetId);
      const lo = Math.max(0, start === -1 ? 0 : start);
      const hi = end === -1 ? orderedIds.length - 1 : end;
      const range = orderedIds.slice(Math.min(lo, hi), Math.max(lo, hi) + 1);
      const next = new Set(s.selectedIds);
      for (const id of range) next.add(id);
      return { selectedIds: next, lastSelectedId: targetId };
    }),
}));
