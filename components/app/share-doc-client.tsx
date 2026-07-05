"use client";

// Public share page: read-only for everyone, live-editable by anonymous
// guests when the owner enabled "guest editing". Content syncs in real time
// through Convex reactivity (debounced last-write-wins, Google-Docs style).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import TextareaAutosize from "react-textarea-autosize";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getGuestIdentity, setGuestName } from "@/lib/guest";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight2, Edit2, Eye, Lock1, TickCircle } from "iconsax-reactjs";
import { Spinner } from "@/components/app/common";

const FluxEditor = dynamic(() => import("@/components/app/flux-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

const AVATAR_COLORS = ["#e65a41", "#2f7ea6", "#2fbf9b", "#d98324", "#7c5cff", "#1f9d76"];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ShareDocClient({ shareToken }: { shareToken: string }) {
  const locale = useLocale();
  const t = useTranslations("home");
  const te = useTranslations("editor");
  const tc = useTranslations("common");

  const doc = useQuery(api.flux_public.getByToken, { shareToken });
  const presence = useQuery(api.flux_public.listPresence, { shareToken });
  const updatePublic = useMutation(api.flux_public.updatePublic);
  const heartbeat = useMutation(api.flux_public.heartbeat);
  const leaveFn = useMutation(api.flux_public.leave);

  const [guest, setGuest] = useState<{ id: string; name: string } | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const editorRef = useRef<any>(null);
  const lastLocalContent = useRef<string | null>(null);
  const lastEditAt = useRef(0);
  const contentTimer = useRef<any>(null);
  const titleTimer = useRef<any>(null);
  const titleLoaded = useRef(false);

  const editable = !!doc?.allowGuestEdit;

  // Guest identity (client only).
  useEffect(() => {
    const g = getGuestIdentity(locale);
    setGuest(g);
    setNameDraft(g.name);
  }, [locale]);

  // Load title once (don't clobber while typing).
  useEffect(() => {
    if (doc && !titleLoaded.current) {
      setTitle(doc.title || "");
      titleLoaded.current = true;
    }
  }, [doc]);

  // Presence heartbeat loop.
  useEffect(() => {
    if (!guest || !doc) return;
    let active = true;
    const beat = () => {
      if (!active) return;
      const editing = editable && Date.now() - lastEditAt.current < 10_000;
      heartbeat({ shareToken, guestId: guest.id, guestName: guest.name, state: editing ? "editing" : "viewing" }).catch(() => {});
    };
    beat();
    const iv = setInterval(beat, 8000);
    const onUnload = () => leaveFn({ shareToken, guestId: guest.id }).catch(() => {});
    window.addEventListener("beforeunload", onUnload);
    return () => {
      active = false;
      clearInterval(iv);
      window.removeEventListener("beforeunload", onUnload);
      leaveFn({ shareToken, guestId: guest.id }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest?.id, guest?.name, !!doc, editable, shareToken]);

  // Apply remote content into the local editor (when not actively typing).
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !doc?.content) return;
    if (doc.content === lastLocalContent.current) return;
    if (Date.now() - lastEditAt.current < 2000) return; // typing — let LWW settle
    try {
      const blocks = JSON.parse(doc.content);
      if (Array.isArray(blocks) && blocks.length) {
        ed.replaceBlocks(ed.document, blocks);
        lastLocalContent.current = doc.content;
      }
    } catch {}
  }, [doc?.content]);

  // Remote title updates (when not typing the title).
  useEffect(() => {
    if (!doc) return;
    if (Date.now() - lastEditAt.current < 2000) return;
    if (doc.title !== title && titleLoaded.current) setTitle(doc.title || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.title]);

  const onContentChange = useCallback(
    (content: string) => {
      lastLocalContent.current = content;
      lastEditAt.current = Date.now();
      if (contentTimer.current) clearTimeout(contentTimer.current);
      setSaving(true);
      contentTimer.current = setTimeout(async () => {
        try {
          await updatePublic({ shareToken, content });
        } catch {}
        setSaving(false);
      }, 700);
    },
    [shareToken, updatePublic],
  );

  const onTitleChange = (value: string) => {
    setTitle(value);
    lastEditAt.current = Date.now();
    if (titleTimer.current) clearTimeout(titleTimer.current);
    setSaving(true);
    titleTimer.current = setTimeout(async () => {
      try {
        await updatePublic({ shareToken, title: value || tc("untitled") });
      } catch {}
      setSaving(false);
    }, 600);
  };

  const renameGuest = () => {
    if (!guest) return;
    const clean = setGuestName(nameDraft);
    setGuest({ ...guest, name: clean });
  };

  const people = useMemo(() => (presence ?? []).slice(0, 6), [presence]);
  const extra = (presence?.length ?? 0) - people.length;

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:px-6">
        <Link href="/" className="shrink-0 text-xl font-extrabold tracking-tight">{t("tagline")}</Link>

        <div className="flex min-w-0 items-center gap-3">
          {/* Presence avatars */}
          {people.length > 0 && (
            <div className="flex items-center -space-x-2" data-testid="share-presence">
              {people.map((p: any) => {
                const c = colorFor(p.id);
                return (
                  <span key={p.id} title={`${p.name} · ${p.state === "editing" ? te("guestEditing") : te("guestViewing")}`} className="relative inline-block">
                    <Avatar className={cn("h-7 w-7 ring-2 ring-background", p.state === "editing" && "ring-[var(--flux-coral)]")}>
                      {p.image ? <AvatarImage src={p.image} /> : null}
                      <AvatarFallback className="text-[10px] font-semibold" style={{ backgroundColor: `${c}22`, color: c }}>
                        {initials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                  </span>
                );
              })}
              {extra > 0 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">+{extra}</span>
              )}
            </div>
          )}

          {/* Guest identity chip */}
          {editable && guest && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted" data-testid="guest-chip">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(`guest:${guest.id}`) }} />
                  <span className="max-w-28 truncate">{guest.name}</span>
                  <Edit2 variant="Bulk" size={13} className="text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{te("guestName")}</p>
                <div className="flex gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && renameGuest()}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    data-testid="guest-name-input"
                  />
                  <button onClick={renameGuest} className="flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground" data-testid="guest-name-save">
                    <TickCircle variant="Bulk" size={16} />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Link href="/auth" className="hidden shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:flex">
            {te("makeYourOwn")} <ArrowRight2 variant="Bulk" size={16} />
          </Link>
        </div>
      </nav>

      {/* Status banner */}
      {doc && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium",
              editable ? "bg-[var(--flux-coral-soft)] text-primary" : "bg-muted text-muted-foreground",
            )}
            data-testid="share-banner"
          >
            {editable ? (
              <>
                <Edit2 variant="Bulk" size={14} />
                {guest ? te("editingAsGuest", { name: guest.name }) : te("guestJoinTitle")}
                {saving && <span className="flex items-center gap-1 opacity-70"><Spinner className="h-3 w-3" /> {te("savingShort")}</span>}
              </>
            ) : (
              <><Eye variant="Bulk" size={14} /> {te("readOnlyBanner")}</>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {doc === undefined ? (
        <div className="mx-auto max-w-[820px] px-6 py-12">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="mt-6 h-64 w-full" />
        </div>
      ) : doc === null ? (
        <div className="mx-auto max-w-[820px] px-6 py-24 text-center">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 font-display text-2xl font-bold">{te("shareNotAvailable")}</h1>
          <p className="mt-2 text-muted-foreground">{te("shareNotAvailableDesc")}</p>
        </div>
      ) : doc.isLocked ? (
        <div className="mx-auto max-w-[820px] px-6 py-24 text-center">
          <Lock1 variant="Bulk" size={40} className="mx-auto text-primary" />
          <h1 className="mt-4 font-display text-2xl font-bold">{te("shareNotAvailable")}</h1>
          <p className="mt-2 text-muted-foreground">{te("shareNotAvailableDesc")}</p>
        </div>
      ) : (
        <article className="mx-auto max-w-[820px] px-5 py-10 md:px-6 md:py-12">
          {doc.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.coverImage} alt={te("coverAlt")} className="mb-6 h-44 w-full rounded-2xl object-cover md:h-56" />
          )}
          {doc.icon && <div className="text-6xl">{doc.icon}</div>}
          {editable ? (
            <TextareaAutosize
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={tc("untitled")}
              className="mt-2 w-full resize-none bg-transparent font-display text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
              data-testid="share-title-input"
            />
          ) : (
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{doc.title || tc("untitled")}</h1>
          )}
          <div className="mt-6">
            <FluxEditor
              initialContent={doc.content}
              editable={editable}
              onChange={editable ? onContentChange : undefined}
              onEditorReady={(ed) => { editorRef.current = ed; }}
            />
          </div>
        </article>
      )}
    </div>
  );
}
