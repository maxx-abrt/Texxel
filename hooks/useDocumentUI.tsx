import { create } from "zustand";

type ExportHandlers = {
  pdf: (() => Promise<void>) | null;
  docx: (() => Promise<void>) | null;
};

type DocumentUIStore = {
  showComments: boolean;
  showShare: boolean;
  showVersionHistory: boolean;
  focusMode: boolean;
  toggleComments: () => void;
  openShare: () => void;
  closeShare: () => void;
  toggleVersionHistory: () => void;
  closeVersionHistory: () => void;
  toggleFocusMode: () => void;
  exportHandlers: ExportHandlers;
  setExportHandlers: (handlers: ExportHandlers) => void;
};

export const useDocumentUI = create<DocumentUIStore>((set) => ({
  showComments: false,
  showShare: false,
  showVersionHistory: false,
  focusMode: false,
  toggleComments: () =>
    set((s) => ({
      showComments: !s.showComments,
      showVersionHistory: !s.showComments ? false : s.showVersionHistory,
    })),
  openShare: () => set({ showShare: true }),
  closeShare: () => set({ showShare: false }),
  toggleVersionHistory: () =>
    set((s) => ({
      showVersionHistory: !s.showVersionHistory,
      showComments: !s.showVersionHistory ? false : s.showComments,
    })),
  closeVersionHistory: () => set({ showVersionHistory: false }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  exportHandlers: { pdf: null, docx: null },
  setExportHandlers: (handlers) => set({ exportHandlers: handlers }),
}));
