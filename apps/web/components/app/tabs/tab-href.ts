/**
 * Workbench tabs — pure helpers (§4).
 *
 * Tab shape (persisted in `flux_userPrefs.tabs`):
 *   { id, kind: "doc"|"task"|"project"|"view", refId?, title, icon? }
 *
 * - `view` tabs carry the app-relative href in `refId` (e.g. "/app/tasks").
 * - `doc` / `project` tabs derive their href from `refId` (the entity id).
 * - `task` tabs have no dedicated route yet (M10 adds task routes); their
 *   href resolves to null so the strip renders them non-navigable until then.
 *
 * Tab ids are deterministic (`kind:refId`) so re-opening an entity reuses
 * the existing tab — the foundation for M4.3's "resolve into existing tab".
 */

export type TabKind = "doc" | "task" | "project" | "view";

export interface WorkbenchTab {
  id: string;
  kind: TabKind;
  refId?: string;
  title: string;
  icon?: string;
}

/** Stable id for a given (kind, refId) pair — dedup on open. */
export function tabId(kind: TabKind, refId?: string): string {
  return `${kind}:${refId ?? ""}`;
}

/** Resolve a tab to its app href, or null when the kind has no route yet. */
export function tabHref(tab: WorkbenchTab): string | null {
  switch (tab.kind) {
    case "view":
      return tab.refId ?? null;
    case "doc":
      return tab.refId ? `/app/documents/${tab.refId}` : null;
    case "project":
      return tab.refId ? `/app/projects/${tab.refId}` : null;
    case "task":
      // Task detail routes land with M10; until then task tabs are not
      // navigable from the strip.
      return null;
    default:
      return null;
  }
}

/** Whether a tab is the active one for the given pathname. */
export function isTabActive(tab: WorkbenchTab, pathname: string): boolean {
  const href = tabHref(tab);
  if (!href) return false;
  if (href === "/app") return pathname === "/app";
  // For section roots like "/app/tasks", a sub-route ("/app/tasks/trash")
  // still counts as that tab being active.
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Build a `view` tab for an arbitrary app pathname. Returns null for paths
 * outside the workbench (/auth, /) or for the bare "/app" root which is
 * represented as the Home view tab.
 */
export function viewTabFromPath(pathname: string): WorkbenchTab | null {
  if (!pathname.startsWith("/app")) return null;
  const href = pathname;
  return {
    id: tabId("view", href),
    kind: "view",
    refId: href,
    title: href === "/app" ? "Home" : href.replace(/^\/app\/?/, "") || "Home",
  };
}

/**
 * Resolve an app href (from a middle/⌘-clicked link) into the right tab kind.
 * Doc/project routes become doc/project tabs (entity id in `refId`); everything
 * else becomes a `view` tab carrying the full href. Titles are best-effort
 * placeholders (no entity lookup here — M4.3/later can sync real titles). The
 * `?`/`#` suffix is stripped so `/app/documents/<id>?edit` dedups with the
 * plain doc tab. Returns null for non-app hrefs.
 */
export function tabFromHref(href: string): WorkbenchTab | null {
  if (!href.startsWith("/app")) return null;
  const clean = href.split("#")[0].split("?")[0];
  const docMatch = clean.match(/^\/app\/documents\/([^/]+)$/);
  if (docMatch) {
    return { id: tabId("doc", docMatch[1]), kind: "doc", refId: docMatch[1], title: "Document" };
  }
  const projMatch = clean.match(/^\/app\/projects\/([^/]+)$/);
  if (projMatch) {
    return { id: tabId("project", projMatch[1]), kind: "project", refId: projMatch[1], title: "Project" };
  }
  return viewTabFromPath(clean);
}
