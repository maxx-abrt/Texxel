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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
} from "lucide-react";

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

const SUGGESTIONS = [
  { icon: FolderPlus, label: "Plan a project", prompt: "Help me plan a new project. Create the project, a plan note, and the first tasks." },
  { icon: ListTodo, label: "Break down work", prompt: "Break my goal into clear, prioritized tasks with due dates." },
  { icon: FileText, label: "Draft a doc", prompt: "Draft a well-structured document for me." },
  { icon: Wand2, label: "What's on my plate?", prompt: "Summarize my open tasks and what I should focus on today." },
];

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

export function AiPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    locale: "en",
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
          title: d.title ?? "Untitled task",
          description: d.description,
          status: clampStatus(d.status),
          priority: clampPriority(d.priority),
          dueDate: parseDate(d.dueDate),
        });
        break;
      case "create_document": {
        const id = await createDoc({ workspaceId: activeWorkspaceId, title: d.title ?? "Untitled", icon: d.icon });
        if (Array.isArray(d.blocks) && d.blocks.length) {
          await updateDoc({ documentId: id, content: JSON.stringify(d.blocks) });
        }
        break;
      }
      case "create_project":
        await createProject({
          workspaceId: activeWorkspaceId,
          name: d.name ?? "Untitled project",
          client: d.client ?? "Internal",
          status: "active",
          description: d.description,
          color: d.color,
          endDate: parseDate(d.dueDate),
        });
        break;
      default:
        throw new Error(`This action ("${a.type}") can be applied from inside the editor.`);
    }
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    if (!activeWorkspaceId) {
      toast.error("Select a workspace first");
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
          text: res.text || "Done.",
          actions: (res.actions ?? []).map((action) => ({ action, status: "pending" as const })),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "ai", text: `⚠️ ${(e as Error).message || "Something went wrong."}` }]);
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
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          data-testid="ai-fab"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105 active:scale-95"
        >
          <Sparkles size={18} /> <span className="hidden sm:inline">Ask AI</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[640px] sm:w-[420px] sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles size={16} /></span>
              <div className="text-sm font-bold">Flux AI</div>
            </div>
            <button data-testid="ai-close" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"><X size={18} /></button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Hi {me?.name?.split(" ")[0] ?? "there"} — I can create docs, tasks and projects, and answer questions about your workspace.</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.label} onClick={() => send(s.prompt)} className="flex items-center gap-2 rounded-xl border border-border bg-background p-2.5 text-left text-xs font-medium hover:border-primary/40 hover:bg-muted">
                      <s.icon size={15} className="shrink-0 text-primary" /> {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, mi) => (
              <div key={mi} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
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
                                      toast.success("Applied");
                                    } catch (e) {
                                      toast.error((e as Error).message);
                                    }
                                  }}
                                  className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                >
                                  Apply
                                </button>
                                <button onClick={() => setActionStatus(mi, ai, "rejected")} className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted">Dismiss</button>
                              </div>
                            ) : (
                              <div className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", pa.status === "applied" ? "text-emerald-600" : "text-muted-foreground")}>
                                {pa.status === "applied" ? (<><Check size={13} /> Applied</>) : "Dismissed"}
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin" /> Thinking…</div>
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
              placeholder="Ask anything or describe what to create…"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50"
            />
            <button data-testid="ai-send" type="submit" disabled={busy || !input.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
