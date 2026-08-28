"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin, rectIntersection, closestCenter, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { midKey, compareSortKeys } from "@/lib/sort-key";

export type DropZone = "before" | "into" | "after";
export type DropIntent = { targetId: string; zone: DropZone } | null;

type TrashDndContextValue = {
  trashingIds: Set<string>;
  activeDrag: ActiveDrag | null;
  dropIntent: DropIntent;
  // §14.3 multi-select
  selectedIds: Set<string>;
  selectClick: (id: string, e: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => void;
  clearSelection: () => void;
  registerVisibleOrder: (ids: string[]) => void;
  bulkTrash: (ids: string[]) => void;
  // §14.3 / M3.6: the sidebar registers its tree scroll container so the
  // provider can run edge auto-scroll (24px zones, velocity ramping by
  // proximity) while a tree drag is active.
  registerScrollContainer: (el: HTMLElement | null) => void;
};

type ActiveDrag = {
  id: string;
  documentId: string;
  title: string;
  icon?: string;
  type: "card" | "tree" | "favorite";
  // §14.3 group drag: when the dragged row is part of a multi-selection,
  // these carry the full selected set so the overlay shows a count badge and
  // drop-to-trash archives every selected row.
  count?: number;
  selectedIds?: string[];
};

const TrashDndContext = createContext<TrashDndContextValue>({
  trashingIds: new Set(),
  activeDrag: null,
  dropIntent: null,
  selectedIds: new Set(),
  selectClick: () => {},
  clearSelection: () => {},
  registerVisibleOrder: () => {},
  bulkTrash: () => {},
  registerScrollContainer: () => {},
});

// §14.1: 3-zone drop intent from pointer Y within the over rect.
function getDropZone(pointerY: number, top: number, height: number): DropZone {
  const ratio = (pointerY - top) / height;
  if (ratio <= 0.25) return "before";
  if (ratio >= 0.75) return "after";
  return "into";
}

export function useTrashDnd() {
  return useContext(TrashDndContext);
}

export function TrashDndProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspaceId } = useWorkspace();
  const t = useTranslations("workspace");
  const archive = useMutation(api.flux_documents.archive);
  const restore = useMutation(api.flux_documents.restore);
  const moveDoc = useMutation(api.flux_documents.move);
  const [trashingIds, setTrashingIds] = useState<Set<string>>(new Set());
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dropIntent, setDropIntent] = useState<DropIntent>(null);
  // §14.1: dropIntent is read in handleDragEnd via a ref so the memoized
  // callback always sees the latest zone (the state value would be stale in
  // the closure because dropIntent is intentionally not in the dep array).
  const dropIntentRef = useRef<DropIntent>(null);
  // Pointer Y is not on DragOverEvent directly; track it ourselves so the
  // 3-zone computation is exact rather than derived from the dragged rect.
  // §14.3 / M3.6: pointer X is also tracked so edge auto-scroll only fires
  // when the pointer is actually over the tree scroll container.
  const pointerY = useRef(0);
  const pointerX = useRef(0);

  // §14.3 multi-select state. `selectedIds` is reactive (drives row styling);
  // the refs mirror it so memoized callbacks (handleDragStart/handleDragEnd)
  // and the ⌫ keydown handler always read the latest selection without being
  // re-created on every selection change.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);
  // Flat ordered list of currently visible tree-row document ids, registered
  // by the sidebar each render (it owns docs + openIds). Used for ⇧-click
  // range selection.
  const visibleOrderRef = useRef<string[]>([]);

  const registerVisibleOrder = useCallback((ids: string[]) => {
    visibleOrderRef.current = ids;
  }, []);

  // §14.3 / M3.6: tree scroll container registered by the sidebar so the
  // provider can run edge auto-scroll during a drag.
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const registerScrollContainer = useCallback((el: HTMLElement | null) => {
    scrollContainerRef.current = el;
  }, []);

  const clearSelection = useCallback(() => {
    selectedIdsRef.current = new Set();
    anchorRef.current = null;
    setSelectedIds(new Set());
  }, []);

  const selectClick = useCallback(
    (id: string, e: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => {
      const shift = e.shiftKey;
      const toggle = e.metaKey || e.ctrlKey;
      if (!shift && !toggle) {
        // Plain click clears selection (navigation is handled by the Link).
        clearSelection();
        return;
      }
      if (shift) {
        const order = visibleOrderRef.current;
        const anchor = anchorRef.current ?? id;
        const a = order.indexOf(anchor);
        const b = order.indexOf(id);
        if (a === -1 || b === -1) {
          // Fallback: just toggle the clicked id if range can't resolve.
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            selectedIdsRef.current = next;
            return next;
          });
          anchorRef.current = id;
          return;
        }
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = new Set(order.slice(lo, hi + 1));
        selectedIdsRef.current = range;
        anchorRef.current = anchor;
        setSelectedIds(range);
        return;
      }
      // ⌘/ctrl toggle
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selectedIdsRef.current = next;
        return next;
      });
      anchorRef.current = id;
    },
    [clearSelection],
  );

  // §14.3 bulk trash with a single Undo toast. Archives every id (each via
  // the existing recursive `archive` mutation), shows one toast whose Undo
  // action restores them all. `trashingIds` is set for every id so rows play
  // the collapse animation together.
  const bulkTrash = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setSelectedIds(new Set());
      selectedIdsRef.current = new Set();
      anchorRef.current = null;
      setTrashingIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      const undo = async () => {
        try {
          await Promise.all(
            ids.map((id) => restore({ documentId: id as Id<"flux_documents"> })),
          );
          toast.success(t("bulkRestored", { count: ids.length }));
        } catch {
          toast.error(t("bulkRestoreFailed"));
        }
      };
      Promise.all(ids.map((id) => archive({ documentId: id as Id<"flux_documents"> })))
        .then(() => {
          toast.success(t("bulkTrashed", { count: ids.length }), {
            action: { label: t("undo"), onClick: undo },
          });
        })
        .catch(() => {
          toast.error(t("docMoveTrashFailed"));
        })
        .finally(() => {
          setTimeout(() => {
            setTrashingIds((prev) => {
              const next = new Set(prev);
              for (const id of idSet) next.delete(id);
              return next;
            });
          }, 300);
        });
    },
    [archive, restore, t],
  );

  // §14.3 ⌫ bulk-trashes the current selection; Escape clears it. Only fires
  // when focus is not in a text-editable element so we never hijack editor
  // backspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable;
      if (editable) return;
      if (e.key === "Backspace" && selectedIdsRef.current.size > 0) {
        e.preventDefault();
        bulkTrash(Array.from(selectedIdsRef.current));
      } else if (e.key === "Escape" && selectedIdsRef.current.size > 0) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bulkTrash, clearSelection]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerY.current = e.clientY;
      pointerX.current = e.clientX;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // §14.3: 6px activation constraint so a click never becomes a 1-px drag.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  // Docs list for the cycle guard (prevent dropping a folder into its own descendant).
  const docs = useQuery(
    api.flux_documents.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  // Composed collision detection: pointerWithin (precise for nested rows), then
  // rectIntersection, then closestCenter — fixes drops onto empty folders.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    const rect = rectIntersection(args);
    if (rect.length > 0) return rect;
    return closestCenter(args);
  }, []);

  // True when `targetId` is `ancestorId` or one of its descendants.
  const isDescendant = useCallback(
    (ancestorId: string, targetId: string): boolean => {
      if (!docs) return false;
      let cur: string | undefined = targetId;
      const seen = new Set<string>();
      while (cur) {
        if (cur === ancestorId) return true;
        if (seen.has(cur)) return false;
        seen.add(cur);
        cur = docs.find((d: any) => d._id === cur)?.parentId as string | undefined;
      }
      return false;
    },
    [docs],
  );

  // Mark the body while dragging so CSS can dim non-droppable rows.
  useEffect(() => {
    if (activeDrag) {
      document.body.dataset.dragging = "doc";
    } else {
      delete document.body.dataset.dragging;
    }
  }, [activeDrag]);

  // §14.3 / M3.6: edge auto-scroll. While a tree drag is active, run a
  // requestAnimationFrame loop that scrolls the registered tree container
  // when the pointer is within a 24px zone of its top or bottom edge.
  // Velocity ramps by proximity (closer to the edge → faster), capped at
  // MAX_SPEED px/frame. Only fires when the pointer is horizontally within
  // the container (with a small tolerance) and the container can scroll in
  // that direction, so we never scroll a parent or jank a non-scrollable
  // region.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!activeDrag) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const SCROLL_ZONE = 24;
    const MAX_SPEED = 14;
    const X_TOLERANCE = 64;
    const tick = () => {
      const el = scrollContainerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const py = pointerY.current;
        const px = pointerX.current;
        const inHorizontally = px >= rect.left - X_TOLERANCE && px <= rect.right + X_TOLERANCE;
        if (inHorizontally && py >= rect.top - SCROLL_ZONE && py <= rect.bottom + SCROLL_ZONE) {
          const distTop = py - rect.top;
          const distBottom = rect.bottom - py;
          let delta = 0;
          if (distTop < SCROLL_ZONE && distTop > -SCROLL_ZONE && el.scrollTop > 0) {
            const within = Math.min(Math.max(distTop, 0), SCROLL_ZONE);
            delta = -((SCROLL_ZONE - within) / SCROLL_ZONE) * MAX_SPEED;
          } else if (distBottom < SCROLL_ZONE && distBottom > -SCROLL_ZONE &&
                     el.scrollTop < el.scrollHeight - el.clientHeight) {
            const within = Math.min(Math.max(distBottom, 0), SCROLL_ZONE);
            delta = ((SCROLL_ZONE - within) / SCROLL_ZONE) * MAX_SPEED;
          }
          if (delta !== 0) el.scrollTop += delta;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [activeDrag]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { documentId?: string; title?: string; icon?: string; type?: string } | undefined;
    if (data?.documentId) {
      // §14.3: if the dragged row is part of the current multi-selection,
      // carry the whole set so the overlay renders a count badge and a
      // drop-to-trash archives every selected row.
      const sel = selectedIdsRef.current;
      const inSelection = sel.has(data.documentId);
      const groupIds = inSelection && sel.size > 1 ? Array.from(sel) : undefined;
      setActiveDrag({
        id: String(event.active.id),
        documentId: data.documentId,
        title: data.title || "Untitled",
        icon: data.icon,
        type: data.type === "favorite" ? "favorite" : data.type === "tree" ? "tree" : "card",
        count: groupIds ? groupIds.length : undefined,
        selectedIds: groupIds,
      });
    }
    dropIntentRef.current = null;
    setDropIntent(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) { dropIntentRef.current = null; setDropIntent(null); return; }
    const overId = String(over.id);
    if (!overId.startsWith("tree-")) { dropIntentRef.current = null; setDropIntent(null); return; }
    const targetId = (over.data.current as { documentId?: string } | undefined)?.documentId;
    const activeId = (active.data.current as { documentId?: string } | undefined)?.documentId;
    if (!targetId || targetId === activeId) { dropIntentRef.current = null; setDropIntent(null); return; }
    const rect = over.rect;
    if (!rect) { dropIntentRef.current = null; setDropIntent(null); return; }
    const next: DropIntent = { targetId, zone: getDropZone(pointerY.current, rect.top, rect.height) };
    dropIntentRef.current = next;
    setDropIntent(next);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
    dropIntentRef.current = null;
    setDropIntent(null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      // §14.1: read the zone from the ref (state would be stale in this
      // memoized callback because dropIntent is not in the dep array).
      const intent = dropIntentRef.current;
      setActiveDrag(null);
      dropIntentRef.current = null;
      setDropIntent(null);
      if (!over || !activeWorkspaceId) return;

      const activeId = (active.data.current as { documentId?: string } | undefined)?.documentId;
      if (!activeId) return;
      const overId = String(over.id);

      // §14.3: the drag group is the full multi-selection when the dragged
      // row is part of it, otherwise just the single active row.
      const sel = selectedIdsRef.current;
      const dragIds = sel.has(activeId) && sel.size > 1 ? Array.from(sel) : [activeId];
      const dragSet = new Set(dragIds);

      // §14.2 / M3.3: siblings of a given parent (excluding every dragged
      // row), sorted by sortKey so we can compute fractional-index midpoints.
      const siblingsSorted = (parentId: string | undefined) =>
        (docs ?? [])
          .filter(
            (d: any) =>
              !d.isArchived &&
              (d.parentId ?? undefined) === (parentId ?? undefined) &&
              !dragSet.has(String(d._id)),
          )
          .sort(compareSortKeys) as Array<{ _id: string; sortKey?: string }>;

      // §14.1 rule 3: single-row optimistic move. Patch the cached
      // `flux_documents.list` result (parentId + sortKey) and re-sort it so
      // the tree reflects the new position instantly; Convex auto-rolls-back
      // the optimistic patch when the mutation completes (server truth wins)
      // and rejects on error → we toast.
      const moveOptimistic = (args: {
        documentId: Id<"flux_documents">;
        parentId: Id<"flux_documents"> | undefined;
        sortKey: string;
      }) => {
        const fn = moveDoc.withOptimisticUpdate((store) => {
          const list = store.getQuery(api.flux_documents.list, { workspaceId: activeWorkspaceId });
          if (!list) return;
          const next = (list as any[]).map((d: any) =>
            String(d._id) === args.documentId
              ? { ...d, parentId: args.parentId, sortKey: args.sortKey, updatedAt: Date.now() }
              : d,
          );
          next.sort(compareSortKeys);
          store.setQuery(api.flux_documents.list, { workspaceId: activeWorkspaceId }, next as any);
        });
        return fn(args);
      };

      // Move to root (Private section header, root tree drop zone, or root area).
      if (overId === "sidebar-private-root" || overId === "sidebar-root-area" || overId.startsWith("sidebar-root-tree")) {
        // Append the drag group at end of root siblings with sequential keys.
        const sibs = siblingsSorted(undefined);
        let prevKey: string | null = sibs.length ? sibs[sibs.length - 1].sortKey ?? null : null;
        try {
          for (const id of dragIds) {
            const sortKey = midKey(prevKey, null);
            await moveOptimistic({ documentId: id as Id<"flux_documents">, parentId: undefined, sortKey });
            prevKey = sortKey;
          }
          toast.success(dragIds.length > 1 ? t("movedToRoot") : t("movedToRoot"));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t("couldNotMove"));
        }
        return;
      }

      // §14.1 / M3.2: any document can nest. Tree drops honor the 3-zone
      // intent: "into" → child of target (auto-expands target so the moved
      // doc is visible); "before"/"after" → sibling of target (same parent).
      // M3.3: each branch now computes a `midKey` sortKey so the moved row
      // lands at the exact drop position and the tree re-sorts optimistically.
      // M3.5: a multi-selection moves as a block (sequential sortKeys).
      if (overId.startsWith("tree-")) {
        const targetId = (over.data.current as { documentId?: string } | undefined)?.documentId;
        if (!targetId || dragSet.has(targetId)) return;

        const zone = intent?.zone ?? "into";
        if (zone === "into") {
          // Cycle guard: drop any dragged node that is the target itself or a
          // descendant of the target (would create a cycle).
          const valid = dragIds.filter((id) => id !== targetId && !isDescendant(id, targetId));
          if (valid.length === 0) {
            toast.error(t("couldNotMove"));
            return;
          }
          // Append the group at end of the target's children, sequentially.
          const children = siblingsSorted(targetId);
          let prevKey: string | null = children.length ? children[children.length - 1].sortKey ?? null : null;
          try {
            for (const id of valid) {
              const sortKey = midKey(prevKey, null);
              await moveOptimistic({
                documentId: id as Id<"flux_documents">,
                parentId: targetId as Id<"flux_documents">,
                sortKey,
              });
              prevKey = sortKey;
            }
            // §14.1: auto-expand the new parent so the user sees the moved
            // docs nested inside (children auto-make parent expandable).
            window.dispatchEvent(new CustomEvent("bureau:tree-expand", { detail: { id: targetId } }));
            toast.success(t("movedToFolder"));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : t("couldNotMove"));
          }
          return;
        }

        // before / after → sibling: move into the target's parent and place
        // the block at the exact position via fractional-index midpoints.
        const targetDoc = docs?.find((d: any) => String(d._id) === targetId);
        const siblingParentId = targetDoc?.parentId ?? undefined;
        // Cycle guard against the sibling parent for every dragged node.
        const valid = siblingParentId
          ? dragIds.filter((id) => !isDescendant(id, String(siblingParentId)))
          : dragIds;
        if (valid.length === 0) {
          toast.error(t("couldNotMove"));
          return;
        }
        const sibs = siblingsSorted(siblingParentId);
        const targetIdx = sibs.findIndex((s) => String(s._id) === targetId);
        const targetKey = targetIdx >= 0 ? sibs[targetIdx].sortKey ?? null : null;
        try {
          if (zone === "before") {
            let prevKey = targetIdx > 0 ? sibs[targetIdx - 1].sortKey ?? null : null;
            for (const id of valid) {
              const sortKey = midKey(prevKey, targetKey);
              await moveOptimistic({
                documentId: id as Id<"flux_documents">,
                parentId: siblingParentId as Id<"flux_documents"> | undefined,
                sortKey,
              });
              prevKey = sortKey;
            }
          } else {
            // after: place the block between the target and its next sibling.
            const nextKey = targetIdx >= 0 && targetIdx < sibs.length - 1 ? sibs[targetIdx + 1].sortKey ?? null : null;
            let prevKey = targetKey;
            for (const id of valid) {
              const sortKey = midKey(prevKey, nextKey);
              await moveOptimistic({
                documentId: id as Id<"flux_documents">,
                parentId: siblingParentId as Id<"flux_documents"> | undefined,
                sortKey,
              });
              prevKey = sortKey;
            }
          }
          toast.success(siblingParentId ? t("movedToFolder") : t("movedToRoot"));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t("couldNotMove"));
        }
        return;
      }

      // Drop on trash. §14.3: a multi-selection archives as a group with a
      // single Undo toast (bulkTrash); a single row keeps the legacy path.
      if (overId !== "sidebar-trash") return;

      if (dragIds.length > 1) {
        bulkTrash(dragIds);
        return;
      }

      setTrashingIds((prev) => new Set(prev).add(activeId));
      try {
        await archive({ documentId: activeId as Id<"flux_documents"> });
        toast.success(t("docMovedTrash"));
      } catch {
        toast.error(t("docMoveTrashFailed"));
      } finally {
        setTimeout(() => {
          setTrashingIds((prev) => {
            const next = new Set(prev);
            next.delete(activeId);
            return next;
          });
        }, 300);
      }
    },
    [activeWorkspaceId, archive, moveDoc, isDescendant, docs, t, bulkTrash],
  );

  return (
    <TrashDndContext.Provider value={{ trashingIds, activeDrag, dropIntent, selectedIds, selectClick, clearSelection, registerVisibleOrder, bulkTrash, registerScrollContainer }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.18, 0.89, 0.32, 1.28)" }}>
          {activeDrag && <DragPreview {...activeDrag} />}
        </DragOverlay>
      </DndContext>
    </TrashDndContext.Provider>
  );
}

function DragPreview({ title, icon, type, count }: { title: string; icon?: string; type: "card" | "tree" | "favorite"; count?: number }) {
  const t = useTranslations("tree");
  const isGroup = (count ?? 0) > 1;
  return (
    <div className="relative">
      {/* §14.3: stacked-cards ghost for a multi-row drag. Two offset cards
          behind the front one suggest a pile of pages. */}
      {isGroup && (
        <>
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-xl border border-border bg-card translate-x-1.5 translate-y-1.5 opacity-60",
              type === "card" ? "w-56" : "w-52",
            )}
          />
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-xl border border-border bg-card translate-x-0.5 translate-y-0.5 opacity-80",
              type === "card" ? "w-56" : "w-52",
            )}
          />
        </>
      )}
      <div
        data-testid="tree-drag-overlay"
        className={cn(
          // §14.3: slim portal ghost — icon + title, elev-2, 1° tilt.
          "tx-drag-preview relative flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 elev-2 ring-2 ring-primary/30 rotate-1",
          type === "card" && "w-56",
          type !== "card" && "w-52",
        )}
      >
        <span className="text-lg">{icon ?? "📄"}</span>
        <span className="truncate text-sm font-medium">{title || "Untitled"}</span>
        {isGroup && (
          <span
            data-testid="tree-drag-count"
            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground"
          >
            {count}
          </span>
        )}
        {isGroup && <span className="sr-only">{t("pagesSelected", { count: count ?? 0 })}</span>}
      </div>
    </div>
  );
}
