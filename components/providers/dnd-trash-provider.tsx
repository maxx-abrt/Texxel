"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TrashDndContextValue = {
  trashingIds: Set<string>;
};

type ActiveDrag = {
  id: string;
  documentId: string;
  title: string;
  icon?: string;
  type: "card" | "tree" | "favorite";
};

const TrashDndContext = createContext<TrashDndContextValue>({ trashingIds: new Set() });

export function useTrashDnd() {
  return useContext(TrashDndContext);
}

export function TrashDndProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspaceId } = useWorkspace();
  const archive = useMutation(api.flux_documents.archive);
  const moveDoc = useMutation(api.flux_documents.move);
  const [trashingIds, setTrashingIds] = useState<Set<string>>(new Set());
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { documentId?: string; title?: string; icon?: string; type?: string } | undefined;
    if (data?.documentId) {
      setActiveDrag({
        id: String(event.active.id),
        documentId: data.documentId,
        title: data.title || "Untitled",
        icon: data.icon,
        type: data.type === "favorite" ? "favorite" : data.type === "tree" ? "tree" : "card",
      });
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDrag(null);
      if (!over || !activeWorkspaceId) return;

      const activeId = (active.data.current as { documentId?: string } | undefined)?.documentId;
      if (!activeId) return;
      const overId = String(over.id);

      // Move to root (Private section header).
      if (overId === "sidebar-private-root") {
        try {
          await moveDoc({ documentId: activeId as Id<"flux_documents">, parentId: undefined });
          toast.success("Moved to root");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not move document");
        }
        return;
      }

      // Move into a tree node (folder or document).
      if (overId.startsWith("tree-")) {
        const targetId = (over.data.current as { documentId?: string } | undefined)?.documentId;
        if (!targetId || targetId === activeId) return;
        try {
          await moveDoc({ documentId: activeId as Id<"flux_documents">, parentId: targetId as Id<"flux_documents"> });
          toast.success("Moved to folder");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not move document");
        }
        return;
      }

      // Drop on trash.
      if (overId !== "sidebar-trash") return;

      setTrashingIds((prev) => new Set(prev).add(activeId));
      try {
        await archive({ documentId: activeId as Id<"flux_documents"> });
        toast.success("Document moved to trash");
      } catch {
        toast.error("Could not move document to trash");
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
    [activeWorkspaceId, archive, moveDoc],
  );

  return (
    <TrashDndContext.Provider value={{ trashingIds }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeDrag && <DragPreview {...activeDrag} />}
        </DragOverlay>
      </DndContext>
    </TrashDndContext.Provider>
  );
}

function DragPreview({ title, icon, type }: { title: string; icon?: string; type: "card" | "tree" | "favorite" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-2xl ring-2 ring-primary/30",
        type === "card" && "w-56",
        type !== "card" && "w-52",
      )}
    >
      <span className="text-lg">{icon ?? "📄"}</span>
      <span className="truncate text-sm font-medium">{title || "Untitled"}</span>
    </div>
  );
}
