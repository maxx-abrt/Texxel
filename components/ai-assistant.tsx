"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  Bot,
  CheckSquare,
  FileText,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AiAssistantPanelProps {
  onClose?: () => void;
  documentContext?: { title: string; content?: string };
  taskContext?: { title: string; description?: string; status?: string };
}

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  summarize: FileText,
  improveWriting: Sparkles,
  generateTasks: CheckSquare,
  suggestPriority: Lightbulb,
};

export function AiAssistantPanel({ onClose, documentContext, taskContext }: AiAssistantPanelProps) {
  const t = useTranslations("ai");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const myTasks = useQuery(api.tasks.getMyTasks, {});
  const activeTasks = (myTasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled");

  const contextSummary = (() => {
    const parts: string[] = [];
    if (documentContext) parts.push(`Note: "${documentContext.title}"`);
    if (taskContext) parts.push(`Task: "${taskContext.title}" (${taskContext.status})`);
    if (activeTasks.length > 0) parts.push(`${activeTasks.length} active tasks`);
    return parts.join(" · ") || null;
  })();

  const suggestions = documentContext
    ? ["summarize", "improveWriting", "generateTasks"]
    : taskContext
      ? ["suggestPriority", "generateTasks"]
      : ["summarize", "generateTasks"];

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setIsLoading(true);

    // Simulate AI response — in production this would call an AI API
    setTimeout(() => {
      let response = "";
      if (msg.toLowerCase().includes("summar")) {
        response = documentContext
          ? `Here's a summary of "${documentContext.title}":\n\nThis document covers the main points and key ideas. To get a full AI-powered summary, connect your OpenAI or Anthropic API key in Settings.`
          : "To summarize content, open a note first and then ask me to summarize it.";
      } else if (msg.toLowerCase().includes("task") || msg.toLowerCase().includes("priority")) {
        const overdue = activeTasks.filter((t) => t.dueDate && t.dueDate < Date.now());
        response = overdue.length > 0
          ? `You have ${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}. I'd recommend focusing on: "${overdue[0].title}" first.`
          : `You have ${activeTasks.length} active tasks. Everything looks on track!`;
      } else if (msg.toLowerCase().includes("improv") || msg.toLowerCase().includes("writ")) {
        response = "To improve writing, I'd need an AI API key configured. Go to Settings → Extensions → AI Assistant to set it up.";
      } else {
        response = `I understand you're asking about "${msg}". To unlock full AI capabilities, configure your API key in Settings → Extensions. For now, I can help with:\n\n• Summarizing notes\n• Suggesting task priorities\n• Generating task lists from notes\n• Writing improvement suggestions`;
      }
      setMessages((prev) => [...prev, { role: "ai", text: response }]);
      setIsLoading(false);
    }, 800 + Math.random() * 600);
  };

  const handleSuggestion = (key: string) => {
    const text = t(key as any);
    handleSend(text);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Context banner */}
      {contextSummary && (
        <div className="border-b bg-muted/30 px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
            {t("contextLabel")}
          </p>
          <p className="text-xs text-muted-foreground truncate">{contextSummary}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/15 mb-3" />
            <p className="text-sm font-medium text-muted-foreground/70">{t("title")}</p>
            <p className="text-xs text-muted-foreground/50 mt-1 max-w-[200px]">
              {t("placeholder")}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2.5",
              msg.role === "user" && "flex-row-reverse",
            )}
          >
            {msg.role === "ai" && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                <Bot className="h-3 w-3 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "rounded-xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
              <Bot className="h-3 w-3 text-primary" />
            </div>
            <div className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("thinking")}
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="border-t px-4 py-3 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
            {t("suggestions")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((key) => {
              const Icon = SUGGESTION_ICONS[key] ?? Sparkles;
              return (
                <button
                  key={key}
                  onClick={() => handleSuggestion(key)}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                >
                  <Icon className="h-3 w-3" />
                  {t(key as any)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("placeholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="h-8 w-8 p-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
