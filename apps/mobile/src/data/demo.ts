import { tones } from "@/src/theme/tokens";
import { startOfDay } from "@/src/lib/format";
import type {
  VmDoc,
  VmEvent,
  VmNotification,
  VmProject,
  VmStatus,
  VmTask,
  VmWorkspace,
} from "./types";

/**
 * Demo workspace.
 *
 * Ships with the app so Bureau is explorable before signing in (and offline).
 * Mirrors the product shape 1:1 — the screens cannot tell the difference.
 */

const HOUR = 3_600_000;
const DAY = 86_400_000;

const today = startOfDay(Date.now());
const at = (hour: number, minutes = 0, dayOffset = 0) => today + dayOffset * DAY + hour * HOUR + minutes * 60_000;

export const demoUser = { id: "demo-user", name: "Maxx Abrt", email: "demo@bureau.app", image: null };

export const demoWorkspace: VmWorkspace = {
  id: "demo-workspace",
  name: "Bureau HQ",
  slug: "bureau-hq",
  role: "owner",
  memberCount: 5,
};

export const demoStatuses: VmStatus[] = [
  { key: "todo", label: "To do", color: tones.ocean, isDone: false },
  { key: "in_progress", label: "In progress", color: tones.amber, isDone: false },
  { key: "review", label: "Review", color: tones.violet, isDone: false },
  { key: "done", label: "Done", color: tones.mint, isDone: true },
];

const people = {
  MA: { name: "Maxx Abrt" },
  SL: { name: "Sarah Lane" },
  JD: { name: "Jade Doe" },
  TR: { name: "Tom Ray" },
  KP: { name: "Kim Park" },
};

export const demoProjects: VmProject[] = [
  {
    id: "p-mobile",
    name: "Bureau Mobile",
    client: "A2E",
    status: "active",
    tone: tones.coral,
    done: 7,
    total: 12,
    dueDate: today + 12 * DAY,
    members: [people.MA, people.SL, people.JD],
  },
  {
    id: "p-web",
    name: "Web Refresh",
    client: "Acme Studio",
    status: "active",
    tone: tones.mint,
    done: 4,
    total: 10,
    dueDate: today + 4 * DAY,
    members: [people.SL, people.TR],
  },
  {
    id: "p-analytics",
    name: "Analytics v2",
    client: "Internal",
    status: "planning",
    tone: tones.amber,
    done: 2,
    total: 10,
    dueDate: today + 30 * DAY,
    members: [people.JD, people.MA, people.KP],
  },
  {
    id: "p-brand",
    name: "Brand Kit",
    client: "Northwind",
    status: "on_hold",
    tone: tones.ocean,
    done: 6,
    total: 8,
    dueDate: today + 22 * DAY,
    members: [people.KP],
  },
];

export const demoTasks: VmTask[] = [
  {
    id: "t-1",
    title: "Finalize home screen UI",
    description: "Stat pills spacing, hero card gradient and tab bar haptics.",
    status: "in_progress",
    statusLabel: "In progress",
    statusColor: tones.amber,
    isDone: false,
    priority: "high",
    dueDate: at(13),
    labels: ["Design", "Mobile"],
    assignee: people.MA,
    projectId: "p-mobile",
    projectName: "Bureau Mobile",
    updatedAt: Date.now() - 2 * HOUR,
  },
  {
    id: "t-2",
    title: "Client meeting — roadmap sync",
    description: "Walk Acme through the Q3 plan.",
    status: "todo",
    statusLabel: "To do",
    statusColor: tones.ocean,
    isDone: false,
    priority: "medium",
    dueDate: at(15),
    labels: ["Meeting"],
    assignee: people.SL,
    projectId: "p-web",
    projectName: "Web Refresh",
    updatedAt: Date.now() - 5 * HOUR,
  },
  {
    id: "t-3",
    title: "User research synthesis",
    description: "Tag interviews and build the affinity map.",
    status: "review",
    statusLabel: "Review",
    statusColor: tones.violet,
    isDone: false,
    priority: "medium",
    dueDate: at(10, 30, 1),
    labels: ["Research"],
    assignee: people.JD,
    projectId: "p-analytics",
    projectName: "Analytics v2",
    updatedAt: Date.now() - DAY,
  },
  {
    id: "t-4",
    title: "Fix onboarding drop-off",
    description: "Step 2 loses 38% of new accounts.",
    status: "todo",
    statusLabel: "To do",
    statusColor: tones.ocean,
    isDone: false,
    priority: "urgent",
    dueDate: at(17),
    labels: ["Growth", "Bug"],
    assignee: people.MA,
    projectId: "p-mobile",
    projectName: "Bureau Mobile",
    updatedAt: Date.now() - 30 * 60_000,
  },
  {
    id: "t-5",
    title: "Launch prep checklist",
    status: "todo",
    statusLabel: "To do",
    statusColor: tones.ocean,
    isDone: false,
    priority: "low",
    dueDate: today + 3 * DAY + 9 * HOUR,
    labels: ["Ops"],
    assignee: people.KP,
    projectId: "p-brand",
    projectName: "Brand Kit",
    updatedAt: Date.now() - 3 * DAY,
  },
  {
    id: "t-6",
    title: "Ship weekly changelog",
    status: "done",
    statusLabel: "Done",
    statusColor: tones.mint,
    isDone: true,
    priority: "low",
    dueDate: today - DAY + 18 * HOUR,
    labels: ["Writing"],
    assignee: people.TR,
    projectId: "p-web",
    projectName: "Web Refresh",
    updatedAt: Date.now() - DAY,
  },
  {
    id: "t-7",
    title: "Design tokens audit",
    status: "done",
    statusLabel: "Done",
    statusColor: tones.mint,
    isDone: true,
    priority: "medium",
    dueDate: today - 2 * DAY,
    labels: ["Design"],
    assignee: people.SL,
    projectId: "p-mobile",
    projectName: "Bureau Mobile",
    updatedAt: Date.now() - 2 * DAY,
  },
];

function doc(blocks: { type: string; text?: string; checked?: boolean }[]): string {
  return JSON.stringify(
    blocks.map((b, i) => {
      const props: Record<string, unknown> = {
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      };
      let type = b.type;
      if (type === "h1" || type === "h2" || type === "h3") {
        props.level = Number(type.slice(1));
        type = "heading";
      }
      if (type === "checkListItem") props.checked = Boolean(b.checked);
      return {
        id: `demo-${i}`,
        type,
        props,
        content: b.text ? [{ type: "text", text: b.text, styles: {} }] : [],
        children: [],
      };
    }),
  );
}

export const demoDocs: VmDoc[] = [
  {
    id: "d-notes",
    title: "Product meeting notes",
    icon: "🗒️",
    parentId: null,
    isFolder: false,
    updatedAt: Date.now() - 2 * HOUR,
    tone: tones.ocean,
    excerpt: "Decisions on the mobile shell, tab bar behaviour and assistant scope.",
    content: doc([
      { type: "h2", text: "Decisions" },
      {
        type: "paragraph",
        text: "The mobile shell keeps a floating pill tab bar. Search moves into the command sheet.",
      },
      { type: "checkListItem", text: "Lock the warm paper palette", checked: true },
      { type: "checkListItem", text: "Ship the schedule timeline", checked: false },
      { type: "quote", text: "If it does not feel instant, it is not done." },
      { type: "h2", text: "Open questions" },
      { type: "bulletListItem", text: "Do we keep kanban on small screens?" },
      { type: "bulletListItem", text: "How many accent presets ship at launch?" },
      { type: "divider" },
      { type: "codeBlock", text: "pnpm dev:mobile" },
    ]),
  },
  {
    id: "d-brand",
    title: "Brand strategy",
    icon: "🎨",
    parentId: null,
    isFolder: false,
    updatedAt: Date.now() - 4 * HOUR,
    tone: tones.coral,
    excerpt: "Positioning, tone of voice and the warm paper visual direction.",
    content: doc([
      { type: "h1", text: "Positioning" },
      { type: "paragraph", text: "Bureau is the calm workspace. Warm paper surfaces, one confident accent." },
      { type: "bulletListItem", text: "Calm over clever" },
      { type: "bulletListItem", text: "Fast over full" },
      { type: "quote", text: "Warm paper, coral ink." },
    ]),
  },
  {
    id: "d-roadmap",
    title: "Q3 roadmap",
    icon: "🗺️",
    parentId: null,
    isFolder: false,
    updatedAt: Date.now() - DAY,
    tone: tones.mint,
    excerpt: "Three bets for the quarter: mobile shell, assistant actions, databases.",
    content: doc([
      { type: "h2", text: "Bets" },
      { type: "checkListItem", text: "Mobile shell", checked: true },
      { type: "checkListItem", text: "Assistant actions", checked: false },
      { type: "checkListItem", text: "Databases v2", checked: false },
    ]),
  },
  {
    id: "f-team",
    title: "Team handbook",
    icon: "📁",
    parentId: null,
    isFolder: true,
    updatedAt: Date.now() - 3 * DAY,
    tone: tones.violet,
    excerpt: "Onboarding, rituals and ways of working.",
    content: null,
  },
  {
    id: "d-onboarding",
    title: "Onboarding checklist",
    icon: "✅",
    parentId: "f-team",
    isFolder: false,
    updatedAt: Date.now() - 3 * DAY,
    tone: tones.amber,
    excerpt: "Everything a new teammate needs in week one.",
    content: doc([
      { type: "h2", text: "Week one" },
      { type: "checkListItem", text: "Accounts and access", checked: true },
      { type: "checkListItem", text: "Read the design system", checked: false },
      { type: "checkListItem", text: "Ship a first PR", checked: false },
    ]),
  },
];

export const demoEvents: VmEvent[] = [
  { id: "e-1", title: "Team standup", meta: "Zoom · Team Alpha", start: at(9), end: at(9, 30), tone: tones.ocean },
  {
    id: "e-2",
    title: "Deep work — mobile shell",
    meta: "Focus block · Do not disturb",
    start: at(10, 30),
    end: at(12),
    tone: tones.mint,
  },
  {
    id: "e-3",
    title: "Finalize home screen UI",
    meta: "Bureau Mobile · High priority",
    start: at(13),
    end: at(14),
    tone: tones.coral,
  },
  { id: "e-4", title: "Client meeting", meta: "Acme Studio · Roadmap sync", start: at(15), end: at(15, 45), tone: tones.amber },
  { id: "e-5", title: "Weekly retro", meta: "Internal · All hands", start: at(17), end: at(17, 30), tone: tones.violet },
];

export const demoNotifications: VmNotification[] = [
  {
    id: "n-1",
    type: "mention",
    title: "Sarah mentioned you",
    message: "Can you review the latest roadmap updates when you have a moment?",
    read: false,
    createdAt: Date.now() - 2 * 60_000,
  },
  {
    id: "n-2",
    type: "event",
    title: "Design review meeting",
    message: "Starts in 25 minutes with the design team.",
    read: false,
    createdAt: Date.now() - 5 * 60_000,
  },
  {
    id: "n-3",
    type: "file",
    title: "Mike uploaded a file",
    message: "Q3_Competitive_Analysis.pdf",
    read: false,
    createdAt: Date.now() - 2 * HOUR,
  },
  {
    id: "n-4",
    type: "task_assigned",
    title: "Task assigned to you",
    message: "User research synthesis — due tomorrow at 10:30.",
    read: true,
    createdAt: Date.now() - 5 * HOUR,
  },
  {
    id: "n-5",
    type: "member",
    title: "Kim joined the workspace",
    message: "Kim was invited as a Designer with project access.",
    read: true,
    createdAt: Date.now() - DAY,
  },
];

/** Deterministic pseudo-random contribution grid for the analytics heatmap. */
export function demoHeatmap(days = 133): Record<string, number> {
  const counts: Record<string, number> = {};
  let seed = 42;
  for (let i = 0; i < days; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const value = Math.floor((seed / 2147483648) * 7);
    const date = new Date(today - i * DAY).toISOString().slice(0, 10);
    counts[date] = i % 7 === 6 || i % 7 === 5 ? Math.max(0, value - 4) : value;
  }
  return counts;
}
