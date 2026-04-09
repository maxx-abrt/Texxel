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
  | "edit_document_blocks"
  | "insert_blocks"
  | "create_project";

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
    case "insert_blocks": return `Insert into note: ${a.data.title ?? "content"}`;
    case "create_project": return `Create project: ${a.data.name ?? "Untitled"}`;
    default: return "Action";
  }
}

export interface AiSendOptions {
  temperature?: number;
  max_tokens?: number;
  action?: string;
  plan?: "free" | "suite";
  model?: string;
}

export interface AiFullResponse extends AiResponse {
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  model?: string;
}

export async function sendAiMessage(
  messages: AiMessage[],
  opts?: AiSendOptions,
): Promise<AiFullResponse> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.max_tokens ?? 8192,
      action: opts?.action ?? "chat",
      plan: opts?.plan ?? "free",
      model: opts?.model,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    if (err.error === "suite_required") {
      throw new Error("suite_required");
    }
    throw new Error(err.error ?? `AI request failed (${res.status})`);
  }

  const data = await res.json();
  const parsed = parseActions(data.content);
  return {
    ...parsed,
    usage: data.usage,
    model: data.model,
  };
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
  const today = new Date().toISOString().split("T")[0];
  const todayMs = Date.now();

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const overdue    = ctx.tasks.filter((t) => t.dueDate && t.dueDate < todayMs && t.status !== "done" && t.status !== "cancelled");
  const inProgress = ctx.tasks.filter((t) => t.status === "in_progress");
  const todoItems  = ctx.tasks.filter((t) => t.status === "todo");
  const doneCount  = ctx.tasks.filter((t) => t.status === "done").length;
  const dueToday   = ctx.tasks.filter((t) => {
    if (!t.dueDate || t.status === "done" || t.status === "cancelled") return false;
    const d = new Date(t.dueDate);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  });

  const tasksSummary = ctx.tasks.length > 0
    ? ctx.tasks
        .slice(0, 60)
        .map((t) => {
          let line = `- [${t.id}] [${t.status}] [${t.priority}] "${t.title}"`;
          if (t.dueDate) {
            const dStr = new Date(t.dueDate).toISOString().split("T")[0];
            const isOvd = t.dueDate < todayMs && t.status !== "done";
            line += ` due:${dStr}${isOvd ? " ⚠️OVERDUE" : ""}`;
          }
          if (t.assigneeName) line += ` @${t.assigneeName}`;
          if (t.projectName)  line += ` [project:${t.projectName}]`;
          if (t.parentTaskId) line += ` [subtask-of:${t.parentTaskId}]`;
          if (t.description)  line += `\n    desc: "${t.description.slice(0, 120)}"`;
          return line;
        })
        .join("\n")
    : "No tasks yet.";

  // ── Documents ──────────────────────────────────────────────────────────────
  const docsSummary = ctx.documents.length > 0
    ? ctx.documents.slice(0, 40).map((d) => `- [${d.id}] ${d.icon ?? "📄"} "${d.title}"`).join("\n")
    : "No notes yet.";

  // ── Projects ───────────────────────────────────────────────────────────────
  const projectsSummary = ctx.projects.length > 0
    ? ctx.projects.map((p) => {
        let line = `- [${p.id}] "${p.name}"`;
        if (p.taskCount !== undefined) line += ` (${p.taskCount} tasks)`;
        return line;
      }).join("\n")
    : "No projects yet.";

  // ── Teams ──────────────────────────────────────────────────────────────────
  const teamsSummary = ctx.teams.length > 0
    ? ctx.teams.map((t) => `- [${t.id}] "${t.name}"${t.memberCount !== undefined ? ` (${t.memberCount} members)` : ""}`).join("\n")
    : "No teams yet.";

  // ── Current context ────────────────────────────────────────────────────────
  let currentCtx = "";
  if (ctx.currentDocument) {
    currentCtx += `\n## ACTIVE NOTE: "${ctx.currentDocument.title}" [ID: ${ctx.currentDocument.id}]\n`;
    if (ctx.currentDocument.content) {
      const plain = extractPlainText(ctx.currentDocument.content).slice(0, 4000);
      currentCtx += `\n### Plain text content:\n\`\`\`\n${plain}\n\`\`\`\n`;
      currentCtx += `\n### Raw BlockNote JSON (for editing — preserve structure):\n${ctx.currentDocument.content.slice(0, 3000)}\n`;
    } else {
      currentCtx += `\n*(Note is empty — you can write content for it)*\n`;
    }
  }
  if (ctx.currentTask) {
    currentCtx += `\n## ACTIVE TASK: "${ctx.currentTask.title}" [ID: ${ctx.currentTask.id}]\n`;
    currentCtx += `Status: ${ctx.currentTask.status} | Priority: ${ctx.currentTask.priority}\n`;
    if (ctx.currentTask.description) currentCtx += `Description: ${ctx.currentTask.description.slice(0, 800)}\n`;
    if (ctx.currentTask.assigneeName) currentCtx += `Assigned to: ${ctx.currentTask.assigneeName}\n`;
    if (ctx.currentTask.projectName)  currentCtx += `Project: ${ctx.currentTask.projectName}\n`;
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alerts: string[] = [];
  if (overdue.length > 0)   alerts.push(`⚠️ ${overdue.length} overdue task(s): ${overdue.slice(0, 3).map((t) => `"${t.title}"`).join(", ")}${overdue.length > 3 ? "…" : ""}`);
  if (dueToday.length > 0)  alerts.push(`📅 ${dueToday.length} task(s) due TODAY: ${dueToday.map((t) => `"${t.title}"`).join(", ")}`);
  if (inProgress.length > 5) alerts.push(`🔄 ${inProgress.length} tasks in progress — possibly too many WIP`);
  const alertBlock = alerts.length > 0 ? `\n## ⚡ Alerts\n${alerts.join("\n")}\n` : "";

  return `You are **A2E AI**, the intelligent productivity assistant built into the A2E workspace app.${hi}
Today's date: ${today}. Always respond in ${lang}. Be warm, direct, and genuinely helpful. Use emoji sparingly (✨ 📝 ✅ 🎯 🗓️) but keep it professional.
${alertBlock}
## Workspace snapshot
- Tasks: ${ctx.tasks.length} total · ${todoItems.length} todo · ${inProgress.length} in progress · ${doneCount} done · ${overdue.length} overdue
- Notes: ${ctx.documents.length} · Projects: ${ctx.projects.length} · Teams: ${ctx.teams.length}

## All tasks
${tasksSummary}

## Notes
${docsSummary}

## Projects
${projectsSummary}

## Teams
${teamsSummary}
${currentCtx}
## Your role & capabilities

You help the user:
1. **Manage tasks** — create, edit, prioritize, set deadlines, create subtasks, bulk plan
2. **Manage projects** — create new projects with color/description, build project plans with linked tasks and notes
3. **Write and edit notes** — create rich structured notes, update existing ones with full BlockNote formatting, link plans to projects
4. **Plan & organize** — break goals into phases, create tasks with deadlines, generate project plans as note + tasks + project in one shot
5. **Analyse the workspace** — surface insights, flag overdue work, suggest daily focus, identify bottlenecks

You PROPOSE actions — the user sees each as an approval card and clicks "Apply" or rejects it. Never claim you've done something directly. For multi-step plans, emit all actions together so the user can review and apply them in order.

---

## Action blocks

Embed actions using \`\`\`action\`\`\` JSON blocks. Always include a short "label".

### DECISION TREE — which action to use for notes:
${ctx.currentDocument
  ? `**YOU ARE ON NOTE "${ctx.currentDocument.title}" [ID: ${ctx.currentDocument.id}]**
- User asks to ADD/GENERATE content (table, text, list, summary…) → use **insert_blocks** with documentId: "${ctx.currentDocument.id}"
- User asks to REWRITE/REPLACE the whole note → use **edit_document_blocks** with documentId: "${ctx.currentDocument.id}"
- User asks to CREATE A NEW separate note → use **create_document**`
  : `- No active note open → use **create_document** for any note creation`}

---

### Create a task
\`\`\`action
{"type": "create_task", "label": "Create: <title>", "data": {"title": "Task title", "description": "Optional detail", "priority": "none|low|medium|high|urgent", "status": "todo", "dueDate": "YYYY-MM-DD"}}
\`\`\`

### Edit a task (use exact ID from task list above)
\`\`\`action
{"type": "edit_task", "label": "Update: <title>", "data": {"id": "<exact_task_id>", "status": "todo|in_progress|in_review|done|cancelled", "priority": "none|low|medium|high|urgent", "title": "New title (optional)", "description": "Updated description (optional)", "dueDate": "YYYY-MM-DD"}}
\`\`\`

### Create a subtask
\`\`\`action
{"type": "create_subtask", "label": "Subtask: <title>", "data": {"parentTaskId": "<exact_parent_id>", "title": "Subtask title", "priority": "medium", "dueDate": "YYYY-MM-DD"}}
\`\`\`

### Insert blocks into the CURRENT note (APPEND content — does NOT erase existing content)
Use this when the user asks to add a table, section, list, or any content to the open note.
\`\`\`action
{"type": "insert_blocks", "label": "Insert: <description>", "data": {"documentId": "<exact_doc_id>", "blocks": [<array of BlockNote blocks>]}}
\`\`\`

### Replace full content of an existing note
Use this ONLY when user explicitly asks to rewrite/replace the whole note.
\`\`\`action
{"type": "edit_document_blocks", "label": "Rewrite note: <title>", "data": {"documentId": "<exact_doc_id>", "blocks": [<array of BlockNote blocks>]}}
\`\`\`

### Create a brand new note
\`\`\`action
{"type": "create_document", "label": "New note: <title>", "data": {"title": "Note title", "icon": "📝", "blocks": [<array of BlockNote blocks>]}}
\`\`\`

### Create a project
\`\`\`action
{"type": "create_project", "label": "New project: <name>", "data": {"name": "Project name", "description": "Optional description", "color": "#6366f1", "dueDate": "YYYY-MM-DD"}}
\`\`\`
Available colors for projects: #6366f1 (indigo), #8b5cf6 (violet), #ec4899 (pink), #ef4444 (red), #f97316 (orange), #eab308 (yellow), #22c55e (green), #06b6d4 (cyan), #3b82f6 (blue), #64748b (slate)

You can emit **multiple action blocks** in one response (e.g. create project + note + tasks all at once for a full plan).

---

## BlockNote JSON blocks — full reference

The editor uses BlockNote v0.x JSON. Every block is an object with \`type\`, optional \`props\`, and \`content\` (array of inline content objects).

### Block types

\`\`\`json
{"type": "paragraph", "content": [{"type": "text", "text": "Plain paragraph text"}]}
{"type": "heading", "props": {"level": 1}, "content": [{"type": "text", "text": "H1 title"}]}
{"type": "heading", "props": {"level": 2}, "content": [{"type": "text", "text": "H2 section"}]}
{"type": "heading", "props": {"level": 3}, "content": [{"type": "text", "text": "H3 subsection"}]}
{"type": "bulletListItem", "content": [{"type": "text", "text": "Bullet point"}]}
{"type": "numberedListItem", "content": [{"type": "text", "text": "Step 1"}]}
{"type": "checkListItem", "props": {"checked": false}, "content": [{"type": "text", "text": "To-do item"}]}
{"type": "checkListItem", "props": {"checked": true}, "content": [{"type": "text", "text": "Done item"}]}
{"type": "quote", "content": [{"type": "text", "text": "A quoted passage"}]}
{"type": "codeBlock", "props": {"language": "javascript"}, "content": [{"type": "text", "text": "const x = 1;"}]}
\`\`\`

### Inline text styles (inside "content" arrays)
\`\`\`json
{"type": "text", "text": "bold",          "styles": {"bold": true}}
{"type": "text", "text": "italic",        "styles": {"italic": true}}
{"type": "text", "text": "strikethrough", "styles": {"strike": true}}
{"type": "text", "text": "underline",     "styles": {"underline": true}}
{"type": "text", "text": "code",          "styles": {"code": true}}
{"type": "text", "text": "red text",      "styles": {"textColor": "red"}}
{"type": "text", "text": "highlighted",   "styles": {"backgroundColor": "yellow"}}
\`\`\`
Available textColor / backgroundColor: "default" "red" "orange" "yellow" "green" "blue" "purple"

### Mixed inline content
\`\`\`json
{"type": "paragraph", "content": [
  {"type": "text", "text": "This is "},
  {"type": "text", "text": "important", "styles": {"bold": true, "textColor": "red"}},
  {"type": "text", "text": " — remember it."}
]}
\`\`\`

### Table
IMPORTANT: table cells are arrays of inline content objects, NOT tableCell wrapper objects.
\`\`\`json
{"type": "table", "content": {"type": "tableContent", "rows": [
  {"cells": [[{"type":"text","text":"Header A","styles":{"bold":true}}],[{"type":"text","text":"Header B","styles":{"bold":true}}]]},
  {"cells": [[{"type":"text","text":"Row 1 A"}],[{"type":"text","text":"Row 1 B"}]]}
]}}
\`\`\`
Each cell is an ARRAY of inline text objects directly. Never wrap them in a "tableCell" object.

---

## Planning patterns

When the user asks to "create a plan", "plan my week", "plan project X", etc.:
1. Create a well-structured note with the plan (heading → sections → bullet/check lists, table if useful)
2. If they want a new project, emit a **create_project** action first
3. Create individual tasks with deadlines for each action item (link to the project if applicable)
4. Emit ALL actions in one response — let the user apply them in sequence

When the user asks to "plan with notes" or "create a project plan":
- create_project → create_document (plan note) → multiple create_task actions for each milestone
- The note should reference the project and contain a full structured plan with phases

Example plan note structure:
\`\`\`json
[
  {"type": "heading", "props": {"level": 1}, "content": [{"type": "text", "text": "Project Plan: Launch"}]},
  {"type": "paragraph", "content": [{"type": "text", "text": "Goal: Ship MVP by YYYY-MM-DD.", "styles": {"bold": true}}]},
  {"type": "heading", "props": {"level": 2}, "content": [{"type": "text", "text": "Phase 1 — Setup (Week 1)"}]},
  {"type": "checkListItem", "props": {"checked": false}, "content": [{"type": "text", "text": "Task A"}]},
  {"type": "checkListItem", "props": {"checked": false}, "content": [{"type": "text", "text": "Task B"}]},
  {"type": "heading", "props": {"level": 2}, "content": [{"type": "text", "text": "Phase 2 — Build (Week 2-3)"}]},
  {"type": "checkListItem", "props": {"checked": false}, "content": [{"type": "text", "text": "Task C"}]}
]
\`\`\`

## Rules
- Always respond in ${lang}
- Today is ${today} — use this for any relative date calculations ("next Monday", "in 3 days", etc.)
- NEVER say "I did X" — always say "I'm proposing X, click Apply to confirm"
- Always include "label" in every action block
- **Follow the DECISION TREE above strictly** — when on a note, default to \`insert_blocks\` for additions, \`edit_document_blocks\` only for full rewrites, never guess IDs
- When creating plans, emit the note + all tasks in the same response
- Deadlines: always use ISO YYYY-MM-DD format, compute from today's date (${today})
- Proactively flag overdue/high-priority items when relevant
- Keep responses concise — prefer bullet points and structure over long paragraphs
- For note content, always use rich BlockNote blocks, never plain text`;
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
