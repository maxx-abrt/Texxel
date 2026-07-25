/** View models shared by the screens — identical whether the data comes from
 * Convex or from the bundled demo workspace. */

export type Person = { name: string | null; image?: string | null };

export type VmWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
};

export type VmProject = {
  id: string;
  name: string;
  client: string;
  status: "planning" | "active" | "completed" | "on_hold";
  tone: string;
  done: number;
  total: number;
  dueDate?: number | null;
  members: Person[];
};

export type VmTaskPriority = "none" | "low" | "medium" | "high" | "urgent";

export type VmTask = {
  id: string;
  title: string;
  description?: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  isDone: boolean;
  priority: VmTaskPriority;
  dueDate?: number | null;
  labels: string[];
  assignee?: Person | null;
  projectId?: string | null;
  projectName?: string | null;
  updatedAt: number;
};

export type VmDoc = {
  id: string;
  title: string;
  icon?: string | null;
  parentId?: string | null;
  isFolder: boolean;
  updatedAt: number;
  excerpt: string;
  content?: string | null;
  tone: string;
};

export type VmEvent = {
  id: string;
  title: string;
  meta: string;
  start: number;
  end: number;
  tone: string;
};

export type VmNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
};

export type VmStatus = { key: string; label: string; color: string; isDone: boolean };

export type Result<T> = {
  data: T;
  loading: boolean;
};
