"use client";

// Music widget (§3.1) — discovery, queue and full controls over the shared
// Zustand store. The actual player iframe lives in the singleton
// `MusicPlayerHost` (mounted in the app shell), so this component is a pure
// control surface: it never mounts provider SDKs and survives dock/float
// transitions without touching playback.
//
// Phase 2 scope: queue drag-reorder via dnd-kit (SortableContext +
// PointerSensor with a 6px activation constraint so clicks never become
// 1px drags), a Recently-played row, and provider capability-gated seek bar.

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  Pin,
  PinOff,
  X,
  GripVertical,
  History,
} from "lucide-react";
import { useMusicStore } from "@/lib/music/store";
import type { MusicRef } from "@/lib/music/types";
import { cn } from "@/lib/utils";

const PROVIDER_BADGE: Record<MusicRef["provider"], string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
};

function refKey(ref: MusicRef) {
  return `${ref.provider}:${ref.kind}:${ref.id}`;
}

function OpenInProvider({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="music-open-in-provider"
      aria-label={label}
      title={label}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ExternalLink size={14} />
    </a>
  );
}

interface SortableQueueRowProps {
  id: string;
  index: number;
  isActive: boolean;
  isPinned: boolean;
  displayTitle: string;
  provider: MusicRef["provider"];
  playLabel: string;
  pinLabel: string;
  unpinLabel: string;
  removeLabel: string;
  dragLabel: string;
  onPlay: () => void;
  onTogglePin: () => void;
  onRemove: () => void;
}

function SortableQueueRow({
  id,
  index,
  isActive,
  isPinned,
  displayTitle,
  provider,
  playLabel,
  pinLabel,
  unpinLabel,
  removeLabel,
  dragLabel,
  onPlay,
  onTogglePin,
  onRemove,
}: SortableQueueRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`music-queue-item-${index}`}
      data-active={isActive || undefined}
      data-dragging={isDragging || undefined}
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-accent/50",
        isDragging && "z-10 opacity-80 shadow-[var(--elev-2)]",
      )}
    >
      <button
        type="button"
        data-testid={`music-queue-drag-${index}`}
        aria-label={dragLabel}
        title={dragLabel}
        {...attributes}
        {...listeners}
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVertical size={12} aria-hidden />
      </button>
      <button
        type="button"
        data-testid={`music-queue-play-${index}`}
        aria-label={playLabel}
        onClick={onPlay}
        className="min-w-0 flex-1 truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="mr-1.5 text-[10px] uppercase text-muted-foreground">
          {PROVIDER_BADGE[provider]}
        </span>
        {displayTitle}
      </button>
      <button
        type="button"
        data-testid={`music-queue-pin-${index}`}
        aria-label={isPinned ? unpinLabel : pinLabel}
        title={isPinned ? unpinLabel : pinLabel}
        onClick={onTogglePin}
        aria-pressed={isPinned}
        className="invisible size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground group-hover:inline-flex focus-visible:visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
      </button>
      <button
        type="button"
        data-testid={`music-queue-remove-${index}`}
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
        className="invisible size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive group-hover:inline-flex focus-visible:visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={12} />
      </button>
    </li>
  );
}

export function MusicWidget() {
  const t = useTranslations("music");
  const {
    status,
    track,
    queue,
    currentIndex,
    pinned,
    recent,
    volume,
    reason,
    positionMs,
    submitUrl,
    playAt,
    togglePlay,
    seekTo,
    setVolume,
    removeFromQueue,
    reorderQueue,
    togglePin,
  } = useMusicStore();

  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    // 6px activation constraint: a plain click never becomes a drag (§14.3).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const current = currentIndex >= 0 ? queue[currentIndex] : null;
  const playable = status === "playing" || status === "buffering";
  const durationMs = track?.durationMs ?? 0;
  const canSeek = durationMs > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const failure = await submitUrl(url);
    setSubmitting(false);
    if (failure) {
      setError(failure);
    } else {
      setUrl("");
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = queue.findIndex((q) => refKey(q.ref) === active.id);
    const to = queue.findIndex((q) => refKey(q.ref) === over.id);
    if (from !== -1 && to !== -1) reorderQueue(from, to);
  };

  const isPinned = (ref: MusicRef) =>
    pinned.some((p) => refKey(p) === refKey(ref));

  return (
    <div data-testid="widget-music" className="flex min-h-0 flex-1 flex-col">
      {/* Paste field (§3.1 #1) — always on top. */}
      <form onSubmit={onSubmit} className="flex flex-col gap-1.5 p-3 pb-2">
        <label htmlFor="music-url" className="text-xs font-medium text-muted-foreground">
          {t("pasteLabel")}
        </label>
        <input
          id="music-url"
          data-testid="music-url-input"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={t("pastePlaceholder")}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error && (
          <p data-testid="music-url-error" role="alert" className="text-xs text-destructive">
            {t(error === "unsupported" ? "errorUnsupported" : "errorGeneric")}
          </p>
        )}
        <p className="text-[11px] leading-snug text-muted-foreground">{t("privacyNote")}</p>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {/* Now playing */}
        {current ? (
          <section
            data-testid="music-now-playing"
            className="mb-3 flex items-center gap-2 rounded-[var(--radius)] border border-border bg-card p-2"
            aria-live="polite"
          >
            <button
              type="button"
              data-testid="music-toggle-play"
              onClick={togglePlay}
              aria-label={playable ? t("pause") : t("play")}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {playable ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {track?.title ?? current.ref.id}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {track?.creator ? `${track.creator} · ` : ""}
                <span className="tx-pill">{PROVIDER_BADGE[current.ref.provider]}</span>
                {status === "loading" && ` · ${t("statusLoading")}`}
                {status === "blocked" && ` · ${t("statusBlocked")}`}
                {status === "error" && ` · ${t("statusError")}`}
              </p>
              {status === "blocked" && (
                <p data-testid="music-blocked-hint" className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-500">
                  {t("tapToPlay")}
                </p>
              )}
            </div>
            <OpenInProvider url={current.ref.url} label={t("openInProvider")} />
          </section>
        ) : (
          /* Empty state (§3.1 #1) */
          <section
            data-testid="music-empty"
            className="mb-3 flex flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-border px-4 py-6 text-center"
          >
            <Music size={20} className="text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium text-foreground">{t("empty")}</p>
            <p className="text-xs leading-snug text-muted-foreground">{t("emptyHint")}</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
              {(["spotify", "youtube", "soundcloud"] as const).map((p) => (
                <span key={p} data-testid={`music-provider-chip-${p}`} className="tx-pill">
                  {PROVIDER_BADGE[p]}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Progress (capability-gated: YouTube & SoundCloud expose seek) */}
        {current && canSeek && (
          <div className="mb-3 flex items-center gap-2" data-testid="music-progress">
            <input
              type="range"
              min={0}
              max={durationMs}
              step={1000}
              value={Math.min(positionMs, durationMs)}
              aria-label={t("seek")}
              aria-valuemax={durationMs}
              aria-valuenow={Math.round(positionMs)}
              data-testid="music-progress-slider"
              onChange={(e) => seekTo(Number(e.target.value))}
              className="h-1 min-w-0 flex-1 accent-primary"
            />
          </div>
        )}

        {/* Volume (capability-gated: all first-release adapters expose it) */}
        {current && (
          <div className="mb-3 flex items-center gap-2" data-testid="music-volume">
            {volume === 0 ? (
              <VolumeX size={14} className="shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <Volume2 size={14} className="shrink-0 text-muted-foreground" aria-hidden />
            )}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label={t("volume")}
              aria-valuetext={`${Math.round(volume * 100)}%`}
              data-testid="music-volume-slider"
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 min-w-0 flex-1 accent-primary"
            />
          </div>
        )}

        {/* Queue — drag to reorder (§3.1 #3) */}
        {queue.length > 0 && (
          <section aria-label={t("queue")} className="mb-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("queue")}
            </h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={queue.map((q) => refKey(q.ref))}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-0.5" data-testid="music-queue-list">
                  {queue.map((item, i) => (
                    <SortableQueueRow
                      key={refKey(item.ref)}
                      id={refKey(item.ref)}
                      index={i}
                      isActive={i === currentIndex}
                      isPinned={isPinned(item.ref)}
                      displayTitle={
                        track && i === currentIndex
                          ? (track.title ?? item.ref.id)
                          : item.ref.id
                      }
                      provider={item.ref.provider}
                      playLabel={t("playQueueItem")}
                      pinLabel={t("pin")}
                      unpinLabel={t("unpin")}
                      removeLabel={t("removeFromQueue")}
                      dragLabel={t("dragToReorder")}
                      onPlay={() => playAt(i)}
                      onTogglePin={() => togglePin(item.ref)}
                      onRemove={() => removeFromQueue(i)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        )}

        {/* Recently played (§3.1 #3) */}
        {recent.length > 0 && (
          <section aria-label={t("recent")} className="mb-3">
            <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <History size={12} aria-hidden />
              {t("recent")}
            </h3>
            <ul className="flex flex-col gap-0.5" data-testid="music-recent-list">
              {recent.slice(0, 5).map((ref, i) => (
                <li
                  key={refKey(ref)}
                  data-testid={`music-recent-item-${i}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50"
                >
                  <button
                    type="button"
                    data-testid={`music-recent-play-${i}`}
                    aria-label={t("playQueueItem")}
                    onClick={() => void submitUrl(ref.url)}
                    className="min-w-0 flex-1 truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="mr-1.5 text-[10px] uppercase text-muted-foreground">
                      {PROVIDER_BADGE[ref.provider]}
                    </span>
                    {ref.id}
                  </button>
                  <OpenInProvider url={ref.url} label={t("openInProvider")} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Pinned */}
        {pinned.length > 0 && (
          <section aria-label={t("pinned")}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("pinned")}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {pinned.map((ref, i) => (
                <li
                  key={refKey(ref)}
                  data-testid={`music-pinned-item-${i}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50"
                >
                  <button
                    type="button"
                    data-testid={`music-pinned-play-${i}`}
                    aria-label={t("playQueueItem")}
                    onClick={() => void submitUrl(ref.url)}
                    className="min-w-0 flex-1 truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="mr-1.5 text-[10px] uppercase text-muted-foreground">
                      {PROVIDER_BADGE[ref.provider]}
                    </span>
                    {ref.id}
                  </button>
                  <button
                    type="button"
                    data-testid={`music-pinned-unpin-${i}`}
                    aria-label={t("unpin")}
                    title={t("unpin")}
                    onClick={() => togglePin(ref)}
                    className="size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PinOff size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
