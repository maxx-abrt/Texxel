export type Tone = "coral" | "mint" | "amber" | "ocean" | "violet" | "red"

export type Project = {
  id: string
  name: string
  client: string
  tone: Tone
  status: "planning" | "active" | "on_hold" | "completed"
  currentStep: string
  done: number
  total: number
  members: string[]
  due: string
}

export type Task = {
  id: string
  title: string
  project: string
  projectId: string
  status: "planned" | "in_progress" | "review" | "done" | "blocked"
  priority: "urgent" | "high" | "medium" | "low"
  due: string
  time: string
  labels: string[]
  assignees: string[]
  subtasks: { title: string; done: boolean }[]
}

export type Doc = {
  id: string
  title: string
  emoji: string
  tone: Tone
  editedAt: string
  words: number
  collaborators: string[]
  excerpt: string
  blocks: { type: "h2" | "p" | "quote" | "todo" | "bullet"; text: string; done?: boolean }[]
}

export type Notification = {
  id: string
  kind: "mention" | "task" | "meeting" | "file" | "member"
  actor: string
  initials: string
  title: string
  context: string
  body: string
  time: string
  unread: boolean
}

export type Event = {
  id: string
  title: string
  meta: string
  start: string
  end: string
  hour: number
  tone: Tone
  attendees: string[]
}

export type Conversation = {
  id: string
  title: string
  preview: string
  time: string
  tone: Tone
}

export const user = {
  name: "Maxx Abrt",
  first: "Maxx",
  role: "Product Lead",
  workspace: "Texxel HQ",
  initials: "MA",
  focusScore: 82,
  streak: 12,
}

export const projects: Project[] = [
  {
    id: "flux-mobile",
    name: "Flux Mobile",
    client: "Texxel",
    tone: "coral",
    status: "active",
    currentStep: "Design system",
    done: 7,
    total: 12,
    members: ["MA", "SL", "JD"],
    due: "Aug 12",
  },
  {
    id: "web-refresh",
    name: "Web Refresh",
    client: "Acme Studio",
    tone: "mint",
    status: "active",
    currentStep: "Sitemap",
    done: 4,
    total: 10,
    members: ["SL", "TR"],
    due: "Aug 04",
  },
  {
    id: "analytics",
    name: "Analytics v2",
    client: "Internal",
    tone: "amber",
    status: "planning",
    currentStep: "User research",
    done: 2,
    total: 10,
    members: ["JD", "MA", "KP"],
    due: "Sep 01",
  },
  {
    id: "brand-kit",
    name: "Brand Kit",
    client: "Northwind",
    tone: "ocean",
    status: "on_hold",
    currentStep: "Logo grid",
    done: 6,
    total: 8,
    members: ["KP"],
    due: "Aug 22",
  },
]

export const tasks: Task[] = [
  {
    id: "t-1",
    title: "Finalize home screen UI",
    project: "Flux Mobile",
    projectId: "flux-mobile",
    status: "in_progress",
    priority: "high",
    due: "Today",
    time: "1:00 PM",
    labels: ["Design", "Mobile"],
    assignees: ["MA", "SL"],
    subtasks: [
      { title: "Stat pills spacing", done: true },
      { title: "AI card gradient", done: true },
      { title: "Tab bar haptics", done: false },
    ],
  },
  {
    id: "t-2",
    title: "Client meeting — roadmap sync",
    project: "Web Refresh",
    projectId: "web-refresh",
    status: "planned",
    priority: "medium",
    due: "Today",
    time: "3:00 PM",
    labels: ["Meeting"],
    assignees: ["SL", "TR", "MA"],
    subtasks: [{ title: "Prepare deck", done: true }],
  },
  {
    id: "t-3",
    title: "User research synthesis",
    project: "Analytics v2",
    projectId: "analytics",
    status: "review",
    priority: "medium",
    due: "Tomorrow",
    time: "10:30 AM",
    labels: ["Research"],
    assignees: ["JD"],
    subtasks: [
      { title: "Tag interviews", done: true },
      { title: "Affinity map", done: false },
    ],
  },
  {
    id: "t-4",
    title: "Fix onboarding drop-off",
    project: "Flux Mobile",
    projectId: "flux-mobile",
    status: "blocked",
    priority: "urgent",
    due: "Today",
    time: "5:00 PM",
    labels: ["Growth", "Bug"],
    assignees: ["MA"],
    subtasks: [],
  },
  {
    id: "t-5",
    title: "Launch prep checklist",
    project: "Brand Kit",
    projectId: "brand-kit",
    status: "planned",
    priority: "low",
    due: "Fri",
    time: "9:00 AM",
    labels: ["Ops"],
    assignees: ["KP", "MA"],
    subtasks: [],
  },
  {
    id: "t-6",
    title: "Ship weekly changelog",
    project: "Web Refresh",
    projectId: "web-refresh",
    status: "done",
    priority: "low",
    due: "Yesterday",
    time: "6:00 PM",
    labels: ["Writing"],
    assignees: ["TR"],
    subtasks: [],
  },
]

export const docs: Doc[] = [
  {
    id: "product-meeting-notes",
    title: "Product meeting notes",
    emoji: "🗒️",
    tone: "ocean",
    editedAt: "2h ago",
    words: 842,
    collaborators: ["MA", "SL", "JD"],
    excerpt: "Decisions on the mobile shell, tab bar behaviour and the AI assistant scope for v1.",
    blocks: [
      { type: "h2", text: "Decisions" },
      { type: "p", text: "The mobile shell keeps a floating tab bar with a centered assistant trigger. Search moves into the assistant surface." },
      { type: "todo", text: "Lock the warm paper palette", done: true },
      { type: "todo", text: "Ship the schedule timeline", done: false },
      { type: "quote", text: "If it does not feel instant, it is not done." },
      { type: "h2", text: "Open questions" },
      { type: "bullet", text: "Do we keep kanban on small screens?" },
      { type: "bullet", text: "How many accent presets ship at launch?" },
    ],
  },
  {
    id: "brand-strategy",
    title: "Brand strategy",
    emoji: "🎨",
    tone: "coral",
    editedAt: "4h ago",
    words: 1264,
    collaborators: ["KP", "MA"],
    excerpt: "Positioning, tone of voice and the warm paper visual direction for Texxel.",
    blocks: [
      { type: "h2", text: "Positioning" },
      { type: "p", text: "Texxel is the calm workspace. Warm paper surfaces, one confident accent, zero visual noise." },
      { type: "bullet", text: "Calm over clever" },
      { type: "bullet", text: "Fast over full" },
      { type: "quote", text: "Warm paper, coral ink." },
    ],
  },
  {
    id: "q3-roadmap",
    title: "Q3 roadmap",
    emoji: "🗺️",
    tone: "mint",
    editedAt: "Yesterday",
    words: 512,
    collaborators: ["MA", "TR"],
    excerpt: "Three bets for the quarter: mobile shell, assistant actions, and databases.",
    blocks: [
      { type: "h2", text: "Bets" },
      { type: "todo", text: "Mobile shell", done: true },
      { type: "todo", text: "Assistant actions", done: false },
      { type: "todo", text: "Databases v2", done: false },
    ],
  },
]

export const notifications: Notification[] = [
  {
    id: "n-1",
    kind: "mention",
    actor: "Sarah Lane",
    initials: "SL",
    title: "Sarah mentioned you",
    context: "in Product roadmap",
    body: "Can you review the latest updates to the roadmap when you have a moment?",
    time: "2m",
    unread: true,
  },
  {
    id: "n-2",
    kind: "meeting",
    actor: "Calendar",
    initials: "CA",
    title: "Design review meeting",
    context: "in Calendar",
    body: "Starts in 25 minutes with the design team. Agenda attached.",
    time: "5m",
    unread: true,
  },
  {
    id: "n-3",
    kind: "file",
    actor: "Mike Ross",
    initials: "MR",
    title: "Mike uploaded a file",
    context: "in Flux Mobile",
    body: "Q3_Competitive_Analysis.pdf",
    time: "2h",
    unread: true,
  },
  {
    id: "n-4",
    kind: "task",
    actor: "Jade Doe",
    initials: "JD",
    title: "Task assigned to you",
    context: "in Analytics v2",
    body: "User research synthesis — due tomorrow at 10:30 AM.",
    time: "5h",
    unread: false,
  },
  {
    id: "n-5",
    kind: "member",
    actor: "Kim Park",
    initials: "KP",
    title: "Kim joined the workspace",
    context: "in Texxel HQ",
    body: "Kim was invited as a Designer with project access.",
    time: "1d",
    unread: false,
  },
]

export const events: Event[] = [
  {
    id: "e-1",
    title: "Team standup",
    meta: "Zoom · Team Alpha · 30 min",
    start: "9:00 AM",
    end: "9:30 AM",
    hour: 9,
    tone: "ocean",
    attendees: ["MA", "SL", "JD"],
  },
  {
    id: "e-2",
    title: "Deep work — mobile shell",
    meta: "Focus block · Do not disturb",
    start: "10:30 AM",
    end: "12:00 PM",
    hour: 10,
    tone: "mint",
    attendees: ["MA"],
  },
  {
    id: "e-3",
    title: "Finalize home screen UI",
    meta: "Flux Mobile · High priority",
    start: "1:00 PM",
    end: "2:00 PM",
    hour: 13,
    tone: "coral",
    attendees: ["MA", "SL"],
  },
  {
    id: "e-4",
    title: "Client meeting",
    meta: "Acme Studio · Roadmap sync",
    start: "3:00 PM",
    end: "3:45 PM",
    hour: 15,
    tone: "amber",
    attendees: ["SL", "TR", "MA"],
  },
  {
    id: "e-5",
    title: "Weekly retro",
    meta: "Internal · All hands",
    start: "5:00 PM",
    end: "5:30 PM",
    hour: 17,
    tone: "violet",
    attendees: ["MA", "JD", "KP", "TR"],
  },
]

export const conversations: Conversation[] = [
  {
    id: "c-1",
    title: "Summarise Q3 marketing plan",
    preview: "Here's a summary of your Q3 marketing plan across the three channels…",
    time: "2m",
    tone: "coral",
  },
  {
    id: "c-2",
    title: "Design inspiration ideas",
    preview: "I found 12 references for your dashboard, grouped by layout density…",
    time: "1h",
    tone: "ocean",
  },
  {
    id: "c-3",
    title: "Turn notes into tasks",
    preview: "I created 6 tasks from the meeting notes, 2 need an assignee…",
    time: "Yesterday",
    tone: "mint",
  },
]

export const focusWeek = [
  { day: "M", value: 62 },
  { day: "T", value: 74 },
  { day: "W", value: 48 },
  { day: "T", value: 86 },
  { day: "F", value: 82 },
  { day: "S", value: 34 },
  { day: "S", value: 20 },
]

export const scheduleDays = [
  { label: "Mon", date: 21 },
  { label: "Tue", date: 22 },
  { label: "Wed", date: 23 },
  { label: "Thu", date: 24 },
  { label: "Fri", date: 25 },
  { label: "Sat", date: 26 },
  { label: "Sun", date: 27 },
]

export const quickActions = [
  { id: "summarise", label: "Summarise workspace", hint: "3 docs · 2 min", tone: "coral" as Tone },
  { id: "ideas", label: "Generate ideas", hint: "From Q3 roadmap", tone: "ocean" as Tone },
  { id: "report", label: "Weekly report", hint: "Auto-drafted", tone: "violet" as Tone },
  { id: "tasks", label: "Notes to tasks", hint: "6 detected", tone: "mint" as Tone },
]

export const accentPresets = [
  { id: "coral", name: "Coral", hex: "#e55a42" },
  { id: "ocean", name: "Ocean", hex: "#2f7ea6" },
  { id: "mint", name: "Mint", hex: "#1f9d76" },
  { id: "amber", name: "Amber", hex: "#d98324" },
  { id: "violet", name: "Violet", hex: "#7c5cff" },
  { id: "rose", name: "Rose", hex: "#e5487f" },
]

export function toneVar(tone: Tone) {
  if (tone === "coral") return "var(--primary)"
  if (tone === "red") return "var(--destructive)"
  return `var(--${tone})`
}

export const statusLabel: Record<Task["status"], string> = {
  planned: "Planned",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
}

export const statusTone: Record<Task["status"], Tone> = {
  planned: "ocean",
  in_progress: "amber",
  review: "violet",
  done: "mint",
  blocked: "red",
}

export const priorityTone: Record<Task["priority"], Tone> = {
  urgent: "red",
  high: "coral",
  medium: "amber",
  low: "ocean",
}
