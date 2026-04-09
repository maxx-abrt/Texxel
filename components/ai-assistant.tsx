"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  FileText,
  FolderPlus,
  History,
  Lightbulb,
  ListTodo,
  Loader2,
  MessageSquare,
  Minimize2,
  Maximize2,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  SpellCheck,
  Sparkles,
  Wand2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  sendAiMessage,
  buildSystemPrompt,
  extractPlainText,
  type AiMessage,
  type AiAction,
  type AppContext,
} from "@/lib/ai";
import { useExtensions } from "@/hooks/useExtensions";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Crown, Globe, BookOpen, Code2, MessageSquareText } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AiAssistantPanelProps {
  onClose?: () => void;
  documentContext?: { id: string; title: string; content?: string };
  taskContext?: { id: string; title: string; description?: string; status?: string; priority?: string; assigneeName?: string; projectName?: string };
  onDocumentContentReplace?: (newContent: string) => void;
}

type ActionStatus = "pending" | "applied" | "rejected";

interface PendingAction {
  action: AiAction;
  status: ActionStatus;
}

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  pendingActions?: PendingAction[];
  timestamp?: number;
}

type SidebarTab = "chat" | "history";

// ─── Icons map ───────────────────────────────────────────────────────────────

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  summarize: FileText,
  improveWriting: Wand2,
  generateTasks: ListTodo,
  suggestPriority: Lightbulb,
  correctErrors: Pencil,
  createNote: Plus,
  analyzeWorkspace: Eye,
  planDay: ClipboardList,
  brainstorm: Zap,
  translate: Globe,
  analyzeDocument: BookOpen,
  generateDocument: FileText,
  codeReview: Code2,
  explain: MessageSquareText,
  fixGrammar: SpellCheck,
  makeShorter: Minimize2,
  makeLonger: Maximize2,
  changeTone: Palette,
  generateChart: BarChart3,
};

// Mapping from suggestion key → API action name
const SUGGESTION_TO_ACTION: Record<string, string> = {
  summarize: "summarize",
  improveWriting: "improve_writing",
  fixGrammar: "fix_grammar",
  makeShorter: "make_shorter",
  makeLonger: "make_longer",
  changeTone: "change_tone",
  translate: "translate",
  generateTasks: "generate_tasks",
  analyzeDocument: "analyze_document",
  generateDocument: "generate_document",
  brainstorm: "brainstorm",
  codeReview: "code_review",
  explain: "explain",
  generateChart: "generate_chart",
};

// Suite-only action keys
const SUITE_ACTIONS = new Set(["translate", "generateTasks", "analyzeDocument", "generateDocument", "brainstorm", "codeReview", "explain"]);

const ACTION_TYPE_ICONS: Record<string, React.ElementType> = {
  create_task: CheckSquare,
  edit_task: Pencil,
  create_subtask: ListTodo,
  create_document: FileText,
  replace_content: Pencil,
  edit_document_blocks: Wand2,
  insert_blocks: Plus,
  create_project: FolderPlus,
};

// ─── A2E AI cute avatar ──────────────────────────────────────────────────────

function A2EAvatar({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "h-10 w-10" : size === "md" ? "h-7 w-7" : "h-6 w-6";
  const icon = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <div className={cn(
      s,
      "shrink-0 rounded-xl bg-gradient-to-br from-violet-500/20 via-primary/15 to-blue-500/20 flex items-center justify-center ring-1 ring-primary/10",
    )}>
      <Sparkles className={cn(icon, "text-primary")} />
    </div>
  );
}

// ─── Diff preview for document content changes ──────────────────────────────

function DiffPreview({
  oldContent,
  newBlocks,
  newPlainText,
}: {
  oldContent?: string;
  newBlocks?: any[];
  newPlainText?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const oldText = oldContent ? extractPlainText(oldContent).slice(0, 600) : "";
  const newText = newBlocks
    ? extractPlainText(JSON.stringify(newBlocks)).slice(0, 600)
    : (newPlainText ?? "").slice(0, 600);

  if (!oldText && !newText) return null;

  return (
    <div className="mt-1.5 rounded-lg border border-border/50 overflow-hidden text-[11px]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-2.5 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <span className="font-medium text-muted-foreground">Preview changes</span>
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="grid grid-cols-2 divide-x divide-border/50 max-h-40 overflow-y-auto">
          <div className="p-2 bg-red-500/5">
            <p className="font-semibold text-red-500/70 mb-1 text-[9px] uppercase tracking-wider">Before</p>
            <p className="whitespace-pre-wrap text-muted-foreground/80 leading-relaxed">{oldText || "—"}</p>
          </div>
          <div className="p-2 bg-emerald-500/5">
            <p className="font-semibold text-emerald-500/70 mb-1 text-[9px] uppercase tracking-wider">After</p>
            <p className="whitespace-pre-wrap text-foreground/80 leading-relaxed">{newText || "—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action card (pending approval) ─────────────────────────────────────────

function ActionCard({
  pa,
  onApply,
  onReject,
  documentContent,
}: {
  pa: PendingAction;
  onApply: () => void;
  onReject: () => void;
  documentContent?: string;
}) {
  const t = useTranslations("ai");
  const Icon = ACTION_TYPE_ICONS[pa.action.type] ?? Sparkles;
  const isDone = pa.status !== "pending";

  const showDiff =
    (pa.action.type === "edit_document_blocks" || pa.action.type === "replace_content") &&
    documentContent;

  return (
    <div className={cn(
      "rounded-lg border transition-all",
      pa.status === "applied" ? "border-emerald-500/30 bg-emerald-500/5" :
      pa.status === "rejected" ? "border-red-400/30 bg-red-400/5 opacity-60" :
      "border-primary/20 bg-primary/5",
    )}>
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0",
          pa.status === "applied" ? "text-emerald-500" :
          pa.status === "rejected" ? "text-red-400" :
          "text-primary"
        )} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-medium leading-snug",
            pa.status === "rejected" && "line-through text-muted-foreground",
          )}>
            {pa.action.label}
          </p>
          {pa.status === "applied" && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" /> {t("applied")}
            </p>
          )}
          {pa.status === "rejected" && (
            <p className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1">
              <XCircle className="h-2.5 w-2.5" /> {t("rejected")}
            </p>
          )}
        </div>
        {!isDone && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onReject}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
              title={t("reject")}
            >
              <X className="h-3 w-3" />
            </button>
            <button
              onClick={onApply}
              className="flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors"
            >
              <Check className="h-3 w-3" />
              {t("apply")}
            </button>
          </div>
        )}
      </div>

      {showDiff && pa.status === "pending" && (
        <div className="px-3 pb-2">
          <DiffPreview
            oldContent={documentContent}
            newBlocks={pa.action.data.blocks}
            newPlainText={pa.action.data.newContent}
          />
        </div>
      )}
    </div>
  );
}

// ─── Block normalizer — fixes tableCell wrapper objects the model sometimes emits ──
function normalizeCells(cells: any[]): any[][] {
  return cells.map((cell: any) => {
    // Correct format: cell is already an array of inline content
    if (Array.isArray(cell)) return cell;
    // Wrong format: cell is a tableCell object with a content array
    if (cell && typeof cell === "object" && cell.type === "tableCell" && Array.isArray(cell.content)) {
      return cell.content;
    }
    // Fallback: wrap as text
    return [{ type: "text", text: String(cell ?? "") }];
  });
}

function normalizeBlocks(blocks: any[]): any[] {
  return blocks.map((block: any) => {
    if (block?.type === "table" && block.content?.rows) {
      return {
        ...block,
        content: {
          ...block.content,
          rows: block.content.rows.map((row: any) => ({
            ...row,
            cells: normalizeCells(row.cells ?? []),
          })),
        },
      };
    }
    return block;
  });
}

// ─── Main component ─────────────────────────────────────────────────────────

export function AiAssistantPanel({
  onClose,
  documentContext,
  taskContext,
  onDocumentContentReplace,
}: AiAssistantPanelProps) {
  const t = useTranslations("ai");
  const locale = useLocale();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const [currentAction, setCurrentAction] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");
  const [sessionHistory, setSessionHistory] = useState<{ id: string; preview: string; messages: ChatMessage[]; date: number }[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("a2e_ai_history") : null;
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiAccess = useExtensions().getAiAccess();

  // Subscription & usage
  const subscription = useQuery(api.subscriptions.getMySubscription);
  const aiUsage = useQuery(api.subscriptions.getMyAiUsage);
  const trackUsage = useMutation(api.subscriptions.trackAiUsage);
  const plan = (subscription?.plan ?? "free") as "free" | "suite";
  const isSuite = plan === "suite";
  const dailyLimit = isSuite ? -1 : 5;
  const dailyUsed = aiUsage?.requestCount ?? 0;
  const dailyRemaining = dailyLimit === -1 ? Infinity : Math.max(0, dailyLimit - dailyUsed);

  // Convex queries
  const { activeWorkspaceId } = useWorkspace();
  const wsId = activeWorkspaceId as any;
  const myTasks = useQuery(api.tasks.getMyTasks, { workspaceId: wsId });
  const recentDocs = useQuery(api.documents.getSidebar, { parentDocument: undefined, workspaceId: wsId });
  const myProjects = useQuery(api.projects.getMyProjects, { workspaceId: wsId });
  const myTeams = useQuery(api.teams.getMyTeams, { workspaceId: wsId });

  // Convex mutations
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const createDoc = useMutation(api.documents.createWithContent);
  const updateDoc = useMutation(api.documents.update);
  const createProject = useMutation(api.projects.create);

  const activeTasks = (myTasks ?? []).filter(
    (tk) => tk.status !== "done" && tk.status !== "cancelled",
  );

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Context summary for header ─────────────────────────────────────────────
  const contextSummary = (() => {
    const parts: string[] = [];
    if (documentContext) parts.push(`${locale === "fr" ? "Note" : "Note"}: "${documentContext.title}"`);
    if (taskContext) parts.push(`${locale === "fr" ? "Tâche" : "Task"}: "${taskContext.title}" (${taskContext.status})`);
    if (activeTasks.length > 0) parts.push(`${activeTasks.length} ${locale === "fr" ? "tâches actives" : "active tasks"}`);
    return parts.join(" · ") || null;
  })();

  // ── Dynamic suggestions ────────────────────────────────────────────────────
  const baseSuggestions = documentContext
    ? ["summarize", "improveWriting", "fixGrammar", "makeShorter", "makeLonger", "generateChart"]
    : taskContext
      ? ["suggestPriority", "brainstorm", "generateChart"]
      : ["analyzeWorkspace", "createNote", "planDay", "generateChart"];

  const suiteSuggestions = documentContext
    ? ["translate", "analyzeDocument", "generateTasks", "changeTone"]
    : taskContext
      ? ["generateTasks", "explain"]
      : ["generateDocument", "generateTasks", "brainstorm"];

  const suggestions = [...baseSuggestions, ...suiteSuggestions];

  // ── Build full app context (filtered by AI access scope) ────────────────────
  const buildCtx = useCallback((): AppContext => {
    const isRestricted = aiAccess.scope === "restricted";
    const allowedDocs = new Set(aiAccess.allowedDocumentIds);
    const allowedProjects = new Set(aiAccess.allowedProjectIds);

    // Filter documents: in restricted mode only show allowed ones (+ always show current)
    const allDocs = (recentDocs ?? []).map((d) => ({ id: d._id, title: d.title, icon: d.icon ?? undefined }));
    const filteredDocs = isRestricted
      ? allDocs.filter((d) => allowedDocs.has(d.id) || d.id === documentContext?.id)
      : allDocs;

    // Filter projects
    const allProjects = (myProjects ?? []).filter(Boolean).map((p) => ({ id: p!._id, name: p!.name }));
    const filteredProjects = isRestricted
      ? allProjects.filter((p) => allowedProjects.has(p.id))
      : allProjects;

    // Filter tasks: in restricted mode only show tasks from allowed projects (or unassigned)
    const allTasks = (myTasks ?? []).map((tk) => ({
      id: tk._id,
      title: tk.title,
      status: tk.status,
      priority: tk.priority,
      dueDate: tk.dueDate ?? undefined,
      description: tk.description ?? undefined,
      parentTaskId: tk.parentTaskId ?? undefined,
      assigneeName: tk.assigneeName ?? undefined,
      projectId: tk.projectId ?? undefined,
    }));
    const filteredTasks = isRestricted
      ? allTasks.filter((tk) => !tk.projectId || allowedProjects.has(tk.projectId) || tk.id === taskContext?.id)
      : allTasks;

    return {
      locale,
      tasks: filteredTasks,
      documents: filteredDocs,
      projects: filteredProjects,
      teams: (myTeams ?? []).filter(Boolean).map((tm) => ({ id: tm!._id, name: tm!.name })),
      currentDocument: documentContext
        ? { id: documentContext.id, title: documentContext.title, content: documentContext.content }
        : undefined,
      currentTask: taskContext
        ? {
            id: taskContext.id,
            title: taskContext.title,
            status: taskContext.status ?? "todo",
            priority: taskContext.priority ?? "none",
            description: taskContext.description,
            assigneeName: taskContext.assigneeName,
            projectName: taskContext.projectName,
          }
        : undefined,
    };
  }, [locale, myTasks, recentDocs, myProjects, myTeams, documentContext, taskContext, aiAccess]);

  // ── Execute a single action (on user approval) ─────────────────────────────
  const executeAction = async (action: AiAction): Promise<string> => {
    try {
      switch (action.type) {
        case "create_task": {
          const d = action.data;
          const dueDate = d.dueDate && d.dueDate !== "null" ? new Date(d.dueDate).getTime() : undefined;
          await createTask({
            title: d.title ?? "Untitled task",
            description: d.description ?? undefined,
            priority: d.priority ?? "none",
            status: d.status ?? "todo",
            dueDate,
            workspaceId: wsId,
          });
          return t("actionCreatedTask");
        }
        case "edit_task": {
          const d = action.data;
          if (!d.id) return t("actionFailed");
          const patch: any = {};
          if (d.title) patch.title = d.title;
          if (d.status) patch.status = d.status;
          if (d.priority) patch.priority = d.priority;
          if (d.description !== undefined) patch.description = d.description;
          if (d.dueDate && d.dueDate !== "null") patch.dueDate = new Date(d.dueDate).getTime();
          await updateTask({ id: d.id as Id<"tasks">, ...patch });
          return t("actionEditedTask");
        }
        case "create_subtask": {
          const d = action.data;
          if (!d.parentTaskId) return t("actionFailed");
          await createTask({
            title: d.title ?? "Subtask",
            parentTaskId: d.parentTaskId as Id<"tasks">,
            priority: "none",
            workspaceId: wsId,
          });
          return t("actionCreatedSubtask");
        }
        case "create_document": {
          const d = action.data;
          let content: string | undefined;
          if (d.blocks && Array.isArray(d.blocks)) {
            content = JSON.stringify(normalizeBlocks(d.blocks));
          } else if (d.content) {
            content = JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: d.content }] }]);
          }
          await createDoc({ title: d.title ?? "Untitled", content, icon: d.icon ?? undefined, workspaceId: wsId });
          return t("actionCreatedNote");
        }
        case "create_project": {
          const d = action.data;
          const dueDate = d.dueDate && d.dueDate !== "null" ? new Date(d.dueDate).getTime() : undefined;
          await createProject({
            name: d.name ?? "Untitled Project",
            description: d.description ?? undefined,
            color: d.color ?? "#6366f1",
            dueDate,
            workspaceId: wsId,
          });
          return `Project "${d.name ?? "Untitled"}" created`;
        }
        case "insert_blocks": {
          const d = action.data;
          if (!d.documentId || !d.blocks) return t("actionFailed");
          const newBlocks = normalizeBlocks(d.blocks);
          // Append to existing content
          let existingBlocks: any[] = [];
          if (documentContext && d.documentId === documentContext.id && documentContext.content) {
            try { existingBlocks = JSON.parse(documentContext.content); } catch {}
          }
          const merged = [...existingBlocks, ...newBlocks];
          const content = JSON.stringify(merged);
          if (onDocumentContentReplace && documentContext && d.documentId === documentContext.id) {
            onDocumentContentReplace(content);
          } else {
            await updateDoc({ id: d.documentId as Id<"documents">, content });
          }
          return t("actionReplacedContent");
        }
        case "edit_document_blocks": {
          const d = action.data;
          if (!d.documentId || !d.blocks) return t("actionFailed");
          const content = JSON.stringify(normalizeBlocks(d.blocks));
          if (onDocumentContentReplace && documentContext && d.documentId === documentContext.id) {
            onDocumentContentReplace(content);
          } else {
            await updateDoc({ id: d.documentId as Id<"documents">, content });
          }
          return t("actionReplacedContent");
        }
        case "replace_content": {
          const d = action.data;
          if (!d.documentId || !d.newContent) return t("actionFailed");
          const content = JSON.stringify([
            { type: "paragraph", content: [{ type: "text", text: d.newContent }] },
          ]);
          if (onDocumentContentReplace && documentContext && d.documentId === documentContext.id) {
            onDocumentContentReplace(content);
          } else {
            await updateDoc({ id: d.documentId as Id<"documents">, content });
          }
          return t("actionReplacedContent");
        }
        default:
          return t("actionFailed");
      }
    } catch (err: any) {
      console.error("[A2E AI Action]", err);
      return `${t("actionFailed")}: ${err.message?.slice(0, 80) ?? ""}`;
    }
  };

  // ── Handle apply/reject from action cards ──────────────────────────────────
  const handleApplyAction = async (msgIdx: number, actionIdx: number) => {
    const msg = messages[msgIdx];
    if (!msg.pendingActions?.[actionIdx]) return;
    const pa = msg.pendingActions[actionIdx];
    if (pa.status !== "pending") return;

    const result = await executeAction(pa.action);
    toast.success(result);

    setMessages((prev) => prev.map((m, i) => {
      if (i !== msgIdx || !m.pendingActions) return m;
      const updated = [...m.pendingActions];
      updated[actionIdx] = { ...updated[actionIdx], status: "applied" };
      return { ...m, pendingActions: updated };
    }));
  };

  const handleRejectAction = (msgIdx: number, actionIdx: number) => {
    setMessages((prev) => prev.map((m, i) => {
      if (i !== msgIdx || !m.pendingActions) return m;
      const updated = [...m.pendingActions];
      updated[actionIdx] = { ...updated[actionIdx], status: "rejected" };
      return { ...m, pendingActions: updated };
    }));
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;
    setInput("");

    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setIsLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(buildCtx());
      const actionReminder = documentContext
        ? `\n\n[SYSTEM REMINDER: If proposing any content for the note, you MUST emit a \`\`\`action block with type insert_blocks or edit_document_blocks. Do NOT describe the action — output it as a JSON action block.]`
        : `\n\n[SYSTEM REMINDER: If creating tasks, notes, or projects, you MUST output them as \`\`\`action JSON blocks. Do NOT describe what you would do — emit the actual action blocks so the user can apply them.]`;
      const apiMessages: AiMessage[] = [
        { role: "developer", content: systemPrompt },
        ...messages.slice(-20).map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.text,
        })),
        { role: "user", content: msg + actionReminder },
      ];

      // Check daily limit for free tier
      if (!isSuite && dailyRemaining <= 0) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: t("dailyLimitReached") },
        ]);
        setIsLoading(false);
        return;
      }

      const response = await sendAiMessage(apiMessages, { plan, action: currentAction });

      // Track usage
      if (response.usage) {
        setTotalTokensUsed((prev) => prev + response.usage!.total_tokens);
        trackUsage({ tokensUsed: response.usage.total_tokens }).catch(() => {});
      }

      // Handle chart generation: try to parse JSON chart data and create insert action
      if (currentAction === "generate_chart" && response.text) {
        try {
          const cleaned = response.text.replace(/```json\n?|```\n?/g, "").trim();
          const chartConfig = JSON.parse(cleaned);
          if (chartConfig.type && chartConfig.data) {
            const chartAction: AiAction = {
              type: "create_document" as any,
              label: t("chartInserted"),
              data: {
                title: chartConfig.title || "Chart",
                blocks: [{
                  type: "chart",
                  props: { chartData: JSON.stringify(chartConfig) },
                }],
              },
            };
            setMessages((prev) => [...prev, {
              role: "ai",
              text: t("chartGenerated"),
              pendingActions: [{ action: chartAction, status: "pending" }],
            }]);
            setCurrentAction(undefined);
            return;
          }
        } catch { /* not valid JSON, fall through to normal display */ }
      }

      const pendingActions: PendingAction[] = response.actions.map((a) => ({
        action: a,
        status: "pending" as ActionStatus,
      }));

      const aiMsg: ChatMessage = {
        role: "ai",
        text: response.text || (pendingActions.length > 0 ? "" : t("noResponse")),
        pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setCurrentAction(undefined);
    } catch (err: any) {
      let errMsg: string;
      if (err.message === "suite_required") {
        errMsg = t("suiteRequired");
      } else if (err.message?.startsWith("rate_limit:")) {
        const delay = err.message.replace("rate_limit:", "");
        errMsg = `⏳ ${locale === "fr" ? `Limite de requêtes atteinte. Réessayez dans ${delay}.` : `Rate limit reached. Please retry in ${delay}.`}`;
      } else {
        errMsg = `${t("errorPrefix")}: ${err.message ?? t("unknownError")}`;
      }
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: errMsg },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (key: string) => {
    // For suite-only suggestions, check plan first
    if (SUITE_ACTIONS.has(key) && !isSuite) {
      setMessages((prev) => [...prev,
        { role: "user", text: t(key as any) },
        { role: "ai", text: t("suiteRequired") },
      ]);
      return;
    }
    // Set the action type for API routing
    const apiAction = SUGGESTION_TO_ACTION[key];
    if (apiAction) {
      setCurrentAction(apiAction);
    }
    handleSend(t(key as any));
  };

  const saveToHistory = useCallback((msgs: ChatMessage[]) => {
    if (msgs.length < 2) return;
    const entry = {
      id: Date.now().toString(),
      preview: msgs.find((m) => m.role === "user")?.text?.slice(0, 80) ?? "Conversation",
      messages: msgs,
      date: Date.now(),
    };
    setSessionHistory((prev) => {
      const updated = [entry, ...prev].slice(0, 20);
      try { localStorage.setItem("a2e_ai_history", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const handleReset = () => {
    if (messages.length >= 2) saveToHistory(messages);
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const handleLoadHistory = (msgs: ChatMessage[]) => {
    setMessages(msgs);
    setActiveTab("chat");
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
  };

  const handleApplyAll = async (msgIdx: number) => {
    const msg = messages[msgIdx];
    if (!msg?.pendingActions) return;
    for (let j = 0; j < msg.pendingActions.length; j++) {
      if (msg.pendingActions[j].status === "pending") {
        await handleApplyAction(msgIdx, j);
      }
    }
  };

  const handleRejectAll = (msgIdx: number) => {
    setMessages((prev) => prev.map((m, i) => {
      if (i !== msgIdx || !m.pendingActions) return m;
      return { ...m, pendingActions: m.pendingActions.map((pa) => pa.status === "pending" ? { ...pa, status: "rejected" as ActionStatus } : pa) };
    }));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0 bg-gradient-to-r from-violet-500/5 via-transparent to-blue-500/5">
        <div className="flex items-center gap-2.5">
          <A2EAvatar size="md" />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold tracking-tight">{t("title")}</h3>
              {isSuite && (
                <span className="flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                  <Crown className="h-2.5 w-2.5" /> Suite
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/60">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title={t("reset")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title={t("close")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b">
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors border-b-2",
            activeTab === "chat"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground/50 hover:text-muted-foreground",
          )}
        >
          <MessageSquare className="h-3 w-3" /> Chat
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors border-b-2",
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground/50 hover:text-muted-foreground",
          )}
        >
          <History className="h-3 w-3" /> History
          {sessionHistory.length > 0 && (
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
              {sessionHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* History tab */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-y-auto">
          {sessionHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <History className="h-8 w-8 text-muted-foreground/20 mb-3" />
              <p className="text-xs font-medium text-muted-foreground/60">No history yet</p>
              <p className="text-[11px] text-muted-foreground/40 mt-1">Past conversations will appear here</p>
            </div>
          ) : (
            <div className="divide-y">
              {sessionHistory.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleLoadHistory(entry.messages)}
                  className="w-full flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-accent/30 transition-colors group"
                >
                  <p className="text-[12px] font-medium truncate text-foreground/80 group-hover:text-foreground">
                    {entry.preview}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40">
                    {new Date(entry.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · "}{entry.messages.length} messages
                  </p>
                </button>
              ))}
            </div>
          )}
          {sessionHistory.length > 0 && (
            <div className="px-4 py-3 border-t">
              <button
                onClick={() => {
                  setSessionHistory([]);
                  try { localStorage.removeItem("a2e_ai_history"); } catch {}
                }}
                className="text-[11px] text-muted-foreground/40 hover:text-destructive transition-colors"
              >
                Clear history
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chat tab */}
      {activeTab === "chat" && (
        <>
      {/* Context banner */}
      {contextSummary && (
        <div className="border-b bg-muted/20 px-4 py-1.5 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-0.5">
            {t("contextLabel")}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{contextSummary}</p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="relative mb-4">
              <A2EAvatar size="lg" />
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <p className="text-sm font-semibold text-foreground/80">{t("greeting")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[240px] leading-relaxed">
              {t("greetingDesc")}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200",
              msg.role === "user" && "flex-row-reverse",
            )}
          >
            {msg.role === "ai" && <A2EAvatar />}
            <div className="max-w-[88%] space-y-2 min-w-0">
              {msg.text && (
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted/60 text-foreground rounded-bl-md",
                  )}
                >
                  {msg.text}
                </div>
              )}

              {/* Action cards (pending approval) */}
              {msg.pendingActions && msg.pendingActions.length > 0 && (
                <div className="space-y-1.5">
                  {msg.pendingActions.length > 1 && msg.pendingActions.some((pa) => pa.status === "pending") && (
                    <div className="flex items-center gap-1.5 pb-0.5">
                      <button
                        onClick={() => handleApplyAll(i)}
                        className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Check className="h-2.5 w-2.5" /> Apply all
                      </button>
                      <button
                        onClick={() => handleRejectAll(i)}
                        className="flex items-center gap-1 rounded-md bg-red-400/10 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-400/20 transition-colors"
                      >
                        <X className="h-2.5 w-2.5" /> Reject all
                      </button>
                    </div>
                  )}
                  {msg.pendingActions.map((pa, j) => (
                    <ActionCard
                      key={j}
                      pa={pa}
                      onApply={() => handleApplyAction(i, j)}
                      onReject={() => handleRejectAction(i, j)}
                      documentContent={documentContext?.content}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 animate-in fade-in duration-200">
            <A2EAvatar />
            <div className="rounded-2xl rounded-bl-md bg-muted/60 px-3.5 py-2.5 text-[13px] text-muted-foreground flex items-center gap-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
              </div>
              {t("thinking")}
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="border-t px-4 py-3 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-2">
            {t("suggestions")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((key) => {
              const Icon = SUGGESTION_ICONS[key] ?? Sparkles;
              const isSuiteOnly = SUITE_ACTIONS.has(key);
              return (
                <button
                  key={key}
                  onClick={() => handleSuggestion(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all",
                    isSuiteOnly && !isSuite
                      ? "border-amber-500/20 bg-amber-500/5 text-amber-600/60 dark:text-amber-400/60 hover:border-amber-500/40 hover:bg-amber-500/10"
                      : "border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {t(key as any)}
                  {isSuiteOnly && !isSuite && <Crown className="h-2.5 w-2.5 text-amber-500/50" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t px-4 py-3 shrink-0 bg-gradient-to-r from-violet-500/3 via-transparent to-blue-500/3">
        <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 transition-colors focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/5">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("placeholder")}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/35"
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="h-7 w-7 p-0 rounded-lg"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[9px] text-muted-foreground/30">
            A2E AI · {t("poweredBy")}
          </p>
          {dailyLimit !== -1 && (
            <p className="text-[9px] text-muted-foreground/30">
              {dailyUsed}/{dailyLimit} {t("requestsToday") ?? "today"}
            </p>
          )}
          {isSuite && (
            <p className="text-[9px] text-amber-500/50">
              ∞ {t("requestsToday") ?? "today"}
            </p>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
