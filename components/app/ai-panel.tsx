"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import {
  sendAiMessage,
  buildSystemPrompt,
  type AiMessage,
  type AiAction,
  type AppContext,
} from "@/lib/ai";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocale, useTranslations } from "next-intl";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Check,
  FileText,
  ListTodo,
  FolderPlus,
  Wand2,
  PanelRight,
  Minimize2,
} from "lucide-react";
import {
  Magicpen,
  DocumentText as IxDoc,
  TaskSquare as IxTask,
  FolderAdd as IxFolder,
  Flash as IxFlash,
  MessageText1 as IxMsg,
} from "iconsax-reactjs";

type ChatRole = "user" | "ai";
interface PendingAction {
  action: AiAction;
  status: "pending" | "applied" | "rejected";
}
interface Msg {
  role: ChatRole;
  text: string;
  actions?: PendingAction[];
}

function parseDate(s?: string): number | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : t;
}
function clampStatus(s?: string): "todo" | "in_progress" | "done" {
  if (s === "in_progress" || s === "in_review") return "in_progress";
  if (s === "done") return "done";
  return "todo";
}
function clampPriority(p?: string): "none" | "low" | "medium" | "high" | "urgent" {
  return (["none", "low", "medium", "high", "urgent"].includes(p ?? "") ? p : "medium") as any;
}

const ICON_FOR: Record<string, React.ElementType> = {
  create_task: ListTodo,
  create_subtask: ListTodo,
  edit_task: ListTodo,
  create_document: FileText,
  edit_document_blocks: FileText,
  insert_blocks: FileText,
  create_project: FolderPlus,
};

export function AiPanel({
  open,
  onOpenChange,
  shifted = false,
  drawerWidth = 420,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shifted?: boolean;
  drawerWidth?: number;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [docked, setDocked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("ai");
  const locale = useLocale();

  const { activeWorkspaceId, me } = useWorkspace();
  const docs = useQuery(api.flux_documents.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const tasks = useQuery(api.flux_tasks.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");
  const projects = useQuery(api.projects.list, activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip");

  const createDoc = useMutation(api.flux_documents.create);
  const updateDoc = useMutation(api.flux_documents.update);
  const createTask = useMutation(api.flux_tasks.create);
  const createProject = useMutation(api.projects.create);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const buildCtx = (): AppContext => ({
    locale,
    userName: me?.name ?? me?.email ?? undefined,
    documents: (docs ?? []).slice(0, 40).map((d: any) => ({ id: d._id, title: d.title, icon: d.icon })),
    tasks: (tasks ?? []).slice(0, 60).map((t: any) => ({
      id: t._id, title: t.title, status: t.status, priority: t.priority ?? "none", dueDate: t.dueDate,
    })),
    projects: (projects ?? []).map((p: any) => ({ id: p._id, name: p.name, color: p.color })),
    teams: [],
  });

  async function applyAction(a: AiAction): Promise<void> {
    if (!activeWorkspaceId) throw new Error("No workspace");
    const d = a.data || {};
    switch (a.type) {
      case "create_task":
      case "create_subtask":
        await createTask({
          workspaceId: activeWorkspaceId,
          title: d.title ?? t("untitledTask"),
          description: d.description,
          status: clampStatus(d.status),
          priority: clampPriority(d.priority),
          dueDate: parseDate(d.dueDate),
        });
        break;
      case "create_document": {
        const id = await createDoc({ workspaceId: activeWorkspaceId, title: d.title ?? t("untitledNote"), icon: d.icon });
        if (Array.isArray(d.blocks) && d.blocks.length) {
          await updateDoc({ documentId: id, content: JSON.stringify(d.blocks) });
        }
        break;
      }
      case "create_project":
        await createProject({
          workspaceId: activeWorkspaceId,
          name: d.name ?? t("untitledProject"),
          client: d.client ?? "Internal",
          status: "active",
          description: d.description,
          color: d.color,
          endDate: parseDate(d.dueDate),
        });
        break;
      default:
        throw new Error(t("actionEditorOnly"));
    }
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    if (!activeWorkspaceId) {
      toast.error(t("selectWorkspace"));
      return;
    }
    const history: AiMessage[] = messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));
    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const system = buildSystemPrompt(buildCtx());
      const payload: AiMessage[] = [
        { role: "developer", content: system },
        ...history,
        { role: "user", content: text },
      ];
      const res = await sendAiMessage(payload, { action: "chat" });
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: res.text || t("done"),
          actions: (res.actions ?? []).map((action) => ({ action, status: "pending" as const })),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "ai", text: `⚠️ ${(e as Error).message || t("unknownError")}` }]);
    } finally {
      setBusy(false);
    }
  }

  function setActionStatus(mi: number, ai: number, status: PendingAction["status"]) {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === mi && m.actions
          ? { ...m, actions: m.actions.map((pa, j) => (j === ai ? { ...pa, status } : pa)) }
          : m,
      ),
    );
  }

  return (
    <AnimatePresence>
      {/* Panel */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 28, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 flex h-[85dvh] flex-col border border-border bg-card shadow-2xl sm:inset-x-auto sm:w-[420px] sm:right-(--ai-right) sm:transition-[right] sm:duration-300",
            docked
              ? "rounded-t-2xl sm:bottom-0 sm:top-0 sm:h-dvh sm:max-h-none sm:rounded-none sm:border-y-0 sm:border-r-0"
              : "rounded-t-2xl sm:bottom-5 sm:h-[640px] sm:max-h-[calc(100dvh-6rem)] sm:rounded-2xl",
          )}
          style={{
            ["--ai-right" as any]: shifted ? `${drawerWidth + (docked ? 0 : 12)}px` : docked ? "0px" : "1.25rem",
          }}
          data-testid="ai-panel"
          data-docked={docked}
        >
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-b from-primary/[0.06] to-transparent px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--elev-1)]">
                <Magicpen variant="Bulk" size={17} />
              </span>
              <div>
                <div className="text-sm font-bold leading-tight">{t("panelTitle")}</div>
                <div className="text-[11px] text-muted-foreground">Contextual · real-time</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  data-testid="ai-new-chat"
                  onClick={() => setMessages([])}
                  title={t("reset")}
                  className="hidden h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:flex"
                >
                  <Sparkles size={14} /> {t("reset")}
                </button>
              )}
              <button
                data-testid="ai-dock-toggle"
                onClick={() => setDocked((d) => !d)}
                title={docked ? t("floatPanel") : t("dockPanel")}
                className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:flex"
              >
                {docked ? <Minimize2 size={16} /> : <PanelRight size={16} />}
              </button>
              <button data-testid="ai-close" onClick={() => onOpenChange(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"><X size={18} /></button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="flex flex-col items-center pt-4 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--elev-2)]">
                    <Magicpen variant="Bulk" size={26} />
                  </span>
                  <p className="mt-3 text-base font-semibold">{t("intro", { name: me?.name?.split(" ")[0] ?? t("there") })}</p>
                  <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">{t("greetingDesc")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { Icon: IxFolder, label: t("suggestionPlanProject"), prompt: t("promptPlanProject"), color: "#e55a42" },
                    { Icon: IxTask, label: t("suggestionBreakDownWork"), prompt: t("promptBreakDownWork"), color: "#2f7ea6" },
                    { Icon: IxDoc, label: t("suggestionDraftDoc"), prompt: t("promptDraftDoc"), color: "#1f9d76" },
                    { Icon: IxFlash, label: t("suggestionWhatsOnMyPlate"), prompt: t("promptWhatsOnMyPlate"), color: "#d98324" },
                  ].map((s) => (
                    <button key={s.label} onClick={() => send(s.prompt)} data-testid="ai-suggestion" className="tx-card-hover flex flex-col gap-2 rounded-xl border border-border bg-background p-3 text-left text-xs font-semibold">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklch, ${s.color} 14%, transparent)`, color: s.color }}>
                        <s.Icon variant="Bulk" size={17} />
                      </span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, mi) => (
              <div key={mi} className={cn("flex items-end gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "ai" && (
                  <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <Magicpen variant="Bulk" size={15} />
                  </span>
                )}
                <div className={cn("max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground shadow-[var(--elev-1)]")}>
                  {m.role === "ai" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  )}

                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      {m.actions.map((pa, ai) => {
                        const Icon = ICON_FOR[pa.action.type] ?? Sparkles;
                        return (
                          <div key={ai} className="rounded-xl border border-border bg-background p-2.5">
                            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                              <Icon size={14} className="text-primary" /> {pa.action.label || pa.action.type}
                            </div>
                            {pa.status === "pending" ? (
                              <div className="mt-2 flex gap-2">
                                <button
                                  data-testid="ai-apply-action"
                                  onClick={async () => {
                                    try {
                                      await applyAction(pa.action);
                                      setActionStatus(mi, ai, "applied");
                                      toast.success(t("applied"));
                                    } catch (e) {
                                      toast.error((e as Error).message);
                                    }
                                  }}
                                  className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                >
                                  {t("apply")}
                                </button>
                                <button onClick={() => setActionStatus(mi, ai, "rejected")} className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted">{t("reject")}</button>
                              </div>
                            ) : (
                              <div className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", pa.status === "applied" ? "text-emerald-600" : "text-muted-foreground")}>
                                {pa.status === "applied" ? (<><Check size={13} /> {t("applied")}</>) : t("rejected")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex items-end gap-2">
                <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"><Magicpen variant="Bulk" size={15} /></span>
                <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--elev-1)]">
                  <span className="tx-typing-dot" /><span className="tx-typing-dot" style={{ animationDelay: "0.15s" }} /><span className="tx-typing-dot" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              data-testid="ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("inputPlaceholder")}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50"
            />
            <button data-testid="ai-send" type="submit" disabled={busy || !input.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
              <Send size={17} />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
