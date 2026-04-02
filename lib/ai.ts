// ─── A2E AI Service — calls /api/ai and parses structured actions ────────────

export interface AiMessage {
  role: "developer" | "user" | "assistant";
  content: string;
}

export type AiActionType =
  | "create_task"
  | "edit_task"
  | "create_subtask"
  | "create_document"
  | "replace_content"
  | "edit_document_blocks";

export interface AiAction {
  type: AiActionType;
  label: string;
  data: Record<string, any>;
}

export interface AiResponse {
  text: string;
  actions: AiAction[];
}

const ACTION_REGEX = /```action\s*\n([\s\S]*?)\n```/g;

function parseActions(raw: string): { text: string; actions: AiAction[] } {
  const actions: AiAction[] = [];
  const text = raw.replace(ACTION_REGEX, (_, json) => {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        actions.push(...parsed.filter((a: any) => a.type));
      } else if (parsed.type) {
        actions.push(parsed);
      }
    } catch {
      // ignore malformed action blocks
    }
    return "";
  }).trim();

  // Auto-generate labels if missing
  for (const a of actions) {
    if (!a.label) {
      a.label = defaultLabel(a);
    }
  }
  return { text, actions };
}

function defaultLabel(a: AiAction): string {
  switch (a.type) {
    case "create_task": return `Create task: ${a.data.title ?? "Untitled"}`;
    case "edit_task": return `Edit task${a.data.title ? `: ${a.data.title}` : ""}`;
    case "create_subtask": return `Add subtask: ${a.data.title ?? "Subtask"}`;
    case "create_document": return `Create note: ${a.data.title ?? "Untitled"}`;
    case "replace_content": return "Replace note content";
    case "edit_document_blocks": return "Edit note (BlockNote)";
    default: return "Action";
  }
}

export async function sendAiMessage(
  messages: AiMessage[],
  opts?: { temperature?: number; max_tokens?: number },
): Promise<AiResponse> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.max_tokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error ?? `AI request failed (${res.status})`);
  }

  const data = await res.json();
  return parseActions(data.content);
}

// ─── System prompt builder ───────────────────────────────────────────────────

export interface TaskCtx {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: number;
  description?: string;
  parentTaskId?: string;
  assigneeName?: string;
  projectName?: string;
  projectId?: string;
  subtaskCount?: number;
  commentCount?: number;
}

export interface DocCtx {
  id: string;
  title: string;
  icon?: string;
}

export interface ProjectCtx {
  id: string;
  name: string;
  color?: string;
  taskCount?: number;
}

export interface TeamCtx {
  id: string;
  name: string;
  memberCount?: number;
}

export interface AppContext {
  locale: string;
  userName?: string;
  tasks: TaskCtx[];
  documents: DocCtx[];
  projects: ProjectCtx[];
  teams: TeamCtx[];
  currentDocument?: { id: string; title: string; content?: string; icon?: string };
  currentTask?: { id: string; title: string; status: string; priority: string; description?: string; assigneeName?: string; projectName?: string };
}

export function buildSystemPrompt(ctx: AppContext): string {
  const lang = ctx.locale === "fr" ? "French" : "English";
  const hi = ctx.userName ? ` The user's name is ${ctx.userName}.` : "";

  // ── Tasks with enriched data ───────────────────────────────────────────────
  const tasksSummary = ctx.tasks.length > 0
    ? ctx.tasks
        .slice(0, 40)
        .map((t) => {
          let line = `- [${t.id}] [${t.status}] "${t.title}" (priority: ${t.priority})`;
          if (t.dueDate) line += ` due: ${new Date(t.dueDate).toLocaleDateString()}`;
          if (t.assigneeName) line += ` assigned: ${t.assigneeName}`;
          if (t.projectName) line += ` project: ${t.projectName}`;
          if (t.parentTaskId) line += ` (subtask of ${t.parentTaskId})`;
          return line;
        })
        .join("\n")
    : "No tasks yet.";

  const overdue = ctx.tasks.filter((t) => t.dueDate && t.dueDate < Date.now() && t.status !== "done");
  const inProgress = ctx.tasks.filter((t) => t.status === "in_progress");
  const todoCount = ctx.tasks.filter((t) => t.status === "todo").length;

  // ── Documents ──────────────────────────────────────────────────────────────
  const docsSummary = ctx.documents.length > 0
    ? ctx.documents.slice(0, 30).map((d) => `- [${d.id}] ${d.icon ?? "📄"} "${d.title}"`).join("\n")
    : "No notes yet.";

  // ── Projects ───────────────────────────────────────────────────────────────
  const projectsSummary = ctx.projects.length > 0
    ? ctx.projects.map((p) => `- [${p.id}] "${p.name}"${p.taskCount !== undefined ? ` (${p.taskCount} tasks)` : ""}`).join("\n")
    : "No projects.";

  // ── Teams ──────────────────────────────────────────────────────────────────
  const teamsSummary = ctx.teams.length > 0
    ? ctx.teams.map((t) => `- [${t.id}] "${t.name}"${t.memberCount !== undefined ? ` (${t.memberCount} members)` : ""}`).join("\n")
    : "No teams.";

  // ── Current context ────────────────────────────────────────────────────────
  let currentCtx = "";
  if (ctx.currentDocument) {
    currentCtx += `\n## Currently viewing note: "${ctx.currentDocument.title}" [ID: ${ctx.currentDocument.id}]\n`;
    if (ctx.currentDocument.content) {
      const plain = extractPlainText(ctx.currentDocument.content).slice(0, 3000);
      currentCtx += `Content (plain text extract):\n---\n${plain}\n---\n`;
      currentCtx += `Raw BlockNote JSON (first 2000 chars):\n${ctx.currentDocument.content.slice(0, 2000)}\n`;
    }
  }
  if (ctx.currentTask) {
    currentCtx += `\n## Currently viewing task: "${ctx.currentTask.title}" [ID: ${ctx.currentTask.id}] [${ctx.currentTask.status}, ${ctx.currentTask.priority}]\n`;
    if (ctx.currentTask.description) currentCtx += `Description: ${ctx.currentTask.description.slice(0, 500)}\n`;
    if (ctx.currentTask.assigneeName) currentCtx += `Assigned to: ${ctx.currentTask.assigneeName}\n`;
    if (ctx.currentTask.projectName) currentCtx += `Project: ${ctx.currentTask.projectName}\n`;
  }

  // ── Workspace stats ────────────────────────────────────────────────────────
  const stats = [
    `${ctx.tasks.length} total tasks`,
    `${todoCount} todo`,
    `${inProgress.length} in progress`,
    `${overdue.length} overdue`,
    `${ctx.documents.length} notes`,
    `${ctx.projects.length} projects`,
    `${ctx.teams.length} teams`,
  ].join(" · ");

  return `You are **A2E AI**, the friendly and capable AI assistant built into the A2E productivity app.${hi}
You respond in ${lang}. Be warm, concise, and helpful — like a smart friend who knows the workspace inside out. Use a slightly playful but professional tone. You can use emoji sparingly to be friendly (✨, 📝, ✅, 🎯, etc.) but don't overdo it.

## Workspace overview
${stats}

## Tasks (${ctx.tasks.length})
${tasksSummary}

## Notes (${ctx.documents.length})
${docsSummary}

## Projects
${projectsSummary}

## Teams
${teamsSummary}
${currentCtx}

## Your capabilities
You can PROPOSE actions to the user. The user will see each action as a card and must click "Apply" to execute it — actions are NEVER auto-executed. Always explain what you're proposing and why.

Available actions — use \`\`\`action code blocks with JSON. Include a "label" field for a human-readable summary.

### 1. Create a task
\`\`\`action
{"type": "create_task", "label": "Create task: Weekly report", "data": {"title": "...", "description": "...", "priority": "none|low|medium|high|urgent", "status": "todo|in_progress|in_review|done", "dueDate": "YYYY-MM-DD or null"}}
\`\`\`

### 2. Edit a task (by ID)
\`\`\`action
{"type": "edit_task", "label": "Mark 'Review PR' as done", "data": {"id": "<task_id>", "title": "...", "status": "...", "priority": "...", "description": "...", "dueDate": "YYYY-MM-DD or null"}}
\`\`\`

### 3. Create a subtask
\`\`\`action
{"type": "create_subtask", "label": "Add subtask: Research", "data": {"parentTaskId": "<parent_task_id>", "title": "..."}}
\`\`\`

### 4. Create a new note
\`\`\`action
{"type": "create_document", "label": "Create note: Meeting notes", "data": {"title": "...", "blocks": [<BlockNote JSON blocks>]}}
\`\`\`

### 5. Replace/edit note content (full replacement with BlockNote blocks)
\`\`\`action
{"type": "edit_document_blocks", "label": "Update note content", "data": {"documentId": "<doc_id>", "blocks": [<BlockNote JSON blocks>]}}
\`\`\`

### 6. Replace note content (simple text replacement)
\`\`\`action
{"type": "replace_content", "label": "Fix errors in note", "data": {"documentId": "<doc_id>", "newContent": "corrected plain text"}}
\`\`\`

## BlockNote JSON format
When creating or editing notes, use proper BlockNote JSON blocks for rich content. Examples:

**Paragraph**: \`{"type": "paragraph", "content": [{"type": "text", "text": "Hello world"}]}\`
**Heading**: \`{"type": "heading", "props": {"level": 2}, "content": [{"type": "text", "text": "My Heading"}]}\`
**Bold text**: \`{"type": "text", "text": "bold", "styles": {"bold": true}}\`
**Italic text**: \`{"type": "text", "text": "italic", "styles": {"italic": true}}\`
**Colored text**: \`{"type": "text", "text": "red text", "styles": {"textColor": "red"}}\`
**Highlighted text**: \`{"type": "text", "text": "highlighted", "styles": {"backgroundColor": "yellow"}}\`
**Strikethrough**: \`{"type": "text", "text": "old", "styles": {"strike": true}}\`
**Bullet list**: \`{"type": "bulletListItem", "content": [{"type": "text", "text": "Item 1"}]}\`
**Numbered list**: \`{"type": "numberedListItem", "content": [{"type": "text", "text": "Step 1"}]}\`
**Checklist**: \`{"type": "checkListItem", "props": {"checked": false}, "content": [{"type": "text", "text": "Todo item"}]}\`
**Table**: \`{"type": "table", "content": {"type": "tableContent", "rows": [{"cells": [[{"type": "text", "text": "A1"}], [{"type": "text", "text": "B1"}]]}]}}\`

Available text colors: "default", "red", "orange", "yellow", "green", "blue", "purple".
Available background colors: "default", "red", "orange", "yellow", "green", "blue", "purple".

## Rules
- Always respond in ${lang}
- Be warm and helpful — you're A2E AI ✨
- ALWAYS propose actions, NEVER say you'll execute directly. The user approves each one.
- When proposing, explain briefly why (e.g. "I noticed you have 3 overdue tasks — want me to reschedule them?")
- Include a human-readable "label" in every action
- For document edits, prefer edit_document_blocks with proper BlockNote JSON over replace_content with plain text
- Use rich formatting in BlockNote blocks — headings, bold, colors, lists, highlights, tables when appropriate
- You can include multiple action blocks in one response
- Match tasks/notes by name to the IDs listed above
- For dates, use ISO format YYYY-MM-DD
- If you detect issues (overdue tasks, empty notes, missing priorities), proactively mention them
- Give workspace insights when asked — stats, suggestions for productivity, etc.`;
}

export function extractPlainText(blockNoteJson: string): string {
  try {
    const blocks = JSON.parse(blockNoteJson);
    if (!Array.isArray(blocks)) return blockNoteJson;
    return blocks
      .map((block: any) => {
        const prefix = block.type === "heading" ? "#".repeat(block.props?.level ?? 1) + " " :
          block.type === "bulletListItem" ? "• " :
          block.type === "numberedListItem" ? "- " :
          block.type === "checkListItem" ? (block.props?.checked ? "☑ " : "☐ ") : "";
        if (!block.content) return prefix || "";
        if (typeof block.content === "string") return prefix + block.content;
        if (Array.isArray(block.content)) {
          const text = block.content
            .map((c: any) => {
              if (typeof c === "string") return c;
              if (c.text) return c.text;
              if (c.type === "text") return c.text ?? "";
              return "";
            })
            .join("");
          return prefix + text;
        }
        return prefix;
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return blockNoteJson.slice(0, 3000);
  }
}
