"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import {
  sendAiMessage,
  buildSystemPrompt,
  type AiMessage,
  type AppContext,
} from "@/lib/ai";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, RotateCcw } from "lucide-react";
import {
  DocumentText as IxDoc,
  TaskSquare as IxTask,
  FolderAdd as IxFolder,
  Flash as IxFlash,
} from "iconsax-reactjs";
import { SynaIcon } from "@/components/app/syna-icon";

type Msg = { role: "user" | "ai"; text: string };

/**
 * AI Assistant widget (§3): a compact inline chat that reuses the same AI
 * service (`sendAiMessage` / `buildSystemPrompt`) and workspace-context
 * building as the full `AiPanel`, plus its quick-prompt suggestions. It is a
 * lightweight companion — structured action *application* stays in the
 * editor-anchored `AiPanel` (per `ai.actionEditorOnly`); here actions render
 * as plain labeled chips so the user knows to open the full panel to apply.
 */
export function AiWidget() {
  const t = useTranslations("ai");
  const locale = useLocale();
  const { activeWorkspaceId, me } = useWorkspace();
  const docs = useQuery(
    api.flux_documents.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const tasks = useQuery(
    api.flux_tasks.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const projects = useQuery(
    api.projects.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const buildCtx = (): AppContext => ({
    locale,
    userName: me?.name ?? me?.email ?? undefined,
    documents: (docs ?? []).slice(0, 40).map((d: any) => ({
      id: d._id, title: d.title, icon: d.icon,
    })),
    tasks: (tasks ?? []).slice(0, 60).map((t: any) => ({
      id: t._id, title: t.title, status: t.status, priority: t.priority ?? "none", dueDate: t.dueDate,
    })),
    projects: (projects ?? []).map((p: any) => ({ id: p._id, name: p.name, color: p.color })),
    teams: [],
  });

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
    setMessages((prev) => [...prev, { role: "user", text }]);
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
        { role: "ai", text: res.text || t("done") },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: `⚠️ ${(e as Error).message || t("unknownError")}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = [
    { Icon: IxFolder, label: t("suggestionPlanProject"), prompt: t("promptPlanProject"), color: "#E14B3D" },
    { Icon: IxTask, label: t("suggestionBreakDownWork"), prompt: t("promptBreakDownWork"), color: "#2f7ea6" },
    { Icon: IxDoc, label: t("suggestionDraftDoc"), prompt: t("promptDraftDoc"), color: "#1f9d76" },
    { Icon: IxFlash, label: t("suggestionWhatsOnMyPlate"), prompt: t("promptWhatsOnMyPlate"), color: "#d98324" },
  ];

  return (
    <div data-testid="widget-ai" className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="flex flex-col items-center pt-2 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <SynaIcon size={20} />
              </span>
              <p className="mt-2 text-sm font-semibold">
                {t("intro", { name: me?.name?.split(" ")[0] ?? t("there") })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.prompt)}
                  data-testid="widget-ai-suggestion"
                  className="tx-card-hover flex flex-col gap-1.5 rounded-xl border border-border bg-background p-2.5 text-left text-[11px] font-semibold"
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{
                      background: `color-mix(in oklch, ${s.color} 14%, transparent)`,
                      color: s.color,
                    }}
                  >
                    <s.Icon variant="Bulk" size={15} />
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex items-end gap-2",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role === "ai" && (
                <span className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <SynaIcon size={13} />
                </span>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground",
                )}
              >
                {m.role === "ai" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{m.text}</span>
                )}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="flex items-end gap-2">
            <span className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <SynaIcon size={13} />
            </span>
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-2.5">
              <Loader2 size={13} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <button
          onClick={() => setMessages([])}
          data-testid="widget-ai-reset"
          className="mx-3 mb-1 flex items-center justify-center gap-1.5 rounded-lg py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <RotateCcw size={12} /> {t("reset")}
        </button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-sidebar-border p-3"
      >
        <input
          data-testid="widget-ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
        <button
          data-testid="widget-ai-send"
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
