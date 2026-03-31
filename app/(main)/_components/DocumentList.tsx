"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";

import { Item } from "./Item";

import { FileIcon, CornerDownRight, Square, SquareCheckBig } from "lucide-react";
import { useBulkSelect } from "@/hooks/useBulkSelect";

interface SortableItemProps {
  document: Doc<"documents">;
  level: number;
  onExpand: (id: string) => void;
  expanded: boolean;
  onRedirect: (id: string) => void;
  activeId?: string | string[];
  isNestTarget?: boolean;
}
interface DocumentListProps {
  parentDocumentId?: Id<"documents">;
  level?: number;
}

const SortableItem = ({
  document,
  level,
  onExpand,
  expanded,
  onRedirect,
  activeId,
  isNestTarget,
}: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: document._id });
  const { isSelecting, toggle, isSelected } = useBulkSelect();
  const selected = isSelected(document._id);

  const style = {
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleY: 1, scaleX: 1 } : null,
    ),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleClick = () => {
    if (isSelecting) {
      toggle(document._id);
    } else {
      onRedirect(document._id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isSelecting ? {} : { ...attributes, ...listeners })}
      className={cn(
        "relative rounded-md transition-all",
        isNestTarget && "ring-2 ring-primary/50 ring-offset-1 bg-primary/5",
        isSelecting && selected && "bg-primary/8 ring-1 ring-primary/20",
      )}
    >
      {isNestTarget && (
        <div className="absolute -top-0.5 left-2 flex items-center gap-1 text-[10px] text-primary font-medium z-10 pointer-events-none">
          <CornerDownRight className="h-3 w-3" />
          Move inside
        </div>
      )}
      <div className="flex items-center">
        {isSelecting && (
          <button
            onClick={(e) => { e.stopPropagation(); toggle(document._id); }}
            className="shrink-0 ml-1 flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            {selected ? (
              <SquareCheckBig className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <Item
            id={document._id}
            onClick={handleClick}
            label={document.title}
            icon={FileIcon}
            documentIcon={document.icon}
            active={activeId === document._id}
            level={isSelecting ? 0 : level}
            onExpand={() => onExpand(document._id)}
            expanded={expanded}
            isNested={level > 0}
          />
        </div>
      </div>
      {expanded && !isSelecting && (
        <DocumentList parentDocumentId={document._id} level={level + 1} />
      )}
    </div>
  );
};

export const DocumentList = ({
  parentDocumentId,
  level = 0,
}: DocumentListProps) => {
  const params = useParams();
  const router = useRouter();
  const reorder = useMutation(api.documents.reorder);
  const setParent = useMutation(api.documents.setParent);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [activeDoc, setActiveDoc] = useState<Doc<"documents"> | null>(null);
  const [nestTarget, setNestTarget] = useState<string | null>(null);
  const [orderedDocuments, setOrderedDocuments] = useState<Doc<"documents">[]>([]);

  const nestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOverRef = useRef<string | null>(null);

  const documents = useQuery(api.documents.getSidebar, {
    parentDocument: parentDocumentId,
  });

  useEffect(() => {
    if (!isDragging && documents) {
      setOrderedDocuments(documents);
    }
  }, [documents, isDragging]);

  const onExpand = (documentId: string) => {
    setExpanded((prev) => ({ ...prev, [documentId]: !prev[documentId] }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const clearNestTimer = useCallback(() => {
    if (nestTimerRef.current) {
      clearTimeout(nestTimerRef.current);
      nestTimerRef.current = null;
    }
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setIsDragging(true);
    const doc = orderedDocuments.find((d) => d._id === event.active.id);
    setActiveDoc(doc ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | null;

    if (!overId || overId === event.active.id) {
      clearNestTimer();
      setNestTarget(null);
      lastOverRef.current = null;
      return;
    }

    const isOverDocument = orderedDocuments.some((d) => d._id === overId);
    if (!isOverDocument) {
      clearNestTimer();
      setNestTarget(null);
      lastOverRef.current = null;
      return;
    }

    if (lastOverRef.current !== overId) {
      clearNestTimer();
      setNestTarget(null);
      lastOverRef.current = overId;
      nestTimerRef.current = setTimeout(() => {
        setNestTarget(overId);
      }, 600);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    clearNestTimer();
    setIsDragging(false);
    setActiveDoc(null);
    lastOverRef.current = null;

    const { active, over } = event;

    if (!over) {
      setNestTarget(null);
      return;
    }

    const activeId = active.id as Id<"documents">;
    const overId = over.id as string;

    if (nestTarget && nestTarget !== activeId && nestTarget === overId) {
      setNestTarget(null);
      setParent({ id: activeId, parentDocument: overId as Id<"documents"> });
      return;
    }

    setNestTarget(null);

    if (activeId !== overId) {
      const oldIndex = orderedDocuments.findIndex((d) => d._id === activeId);
      const newIndex = orderedDocuments.findIndex((d) => d._id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        setOrderedDocuments((prev) => arrayMove(prev, oldIndex, newIndex));
        reorder({ id: activeId, parentDocument: parentDocumentId, newOrder: newIndex });
      }
    }
  };

  const onRedirect = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  if (documents === undefined) {
    return (
      <>
        <Item.Skeleton level={level} />
        {level === 0 && (
          <>
            <Item.Skeleton level={level} />
            <Item.Skeleton level={level} />
          </>
        )}
      </>
    );
  }

  return (
    <div className="w-full">
      {orderedDocuments.length === 0 && level !== 0 && (
        <p
          style={{ paddingLeft: level ? `${level * 12 + 25}px` : undefined }}
          className="py-1 text-sm font-medium text-muted-foreground/80"
        >
          No pages inside
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedDocuments.map((doc) => doc._id)}
          strategy={verticalListSortingStrategy}
        >
          {orderedDocuments.map((document) => (
            <SortableItem
              key={document._id}
              document={document}
              level={level}
              onExpand={onExpand}
              expanded={expanded[document._id]}
              onRedirect={onRedirect}
              activeId={params.documentId as string}
              isNestTarget={nestTarget === document._id}
            />
          ))}
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 120, easing: "ease" }}>
          {activeDoc ? (
            <div className="opacity-90 shadow-lg rounded-md bg-background border px-2 py-1 text-sm font-medium truncate max-w-[200px]">
              {activeDoc.icon ? `${activeDoc.icon} ` : ""}
              {activeDoc.title || "Untitled"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
