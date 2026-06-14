"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { PageContainer, timeAgo, btnPrimary } from "@/components/app/common";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DocumentText,
  TaskSquare,
  CalendarAdd,
  Data2,
  Add,
  ArrowRight2,
  Notification,
  Clock,
  TickCircle,
} from "iconsax-reactjs";

export default function HomePage() {
  const router = useRouter();
  const { activeWorkspaceId, activeWorkspace, me } = useWorkspace();
  const docs = useQuery(
    api.flux_documents.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const tasks = useQuery(
    api.flux_tasks.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const notifications = useQuery(api.notifications.listMine, { limit: 6 });
  const createDoc = useMutation(api.flux_documents.create);

  const recent = (docs ?? [])
    .slice()
    .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  const openTasks = (tasks ?? []).filter((t: any) => t.status !== "done");

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = (me?.name ?? me?.email ?? "there").split(" ")[0].split("@")[0];

  const onNewDoc = async () => {
    if (!activeWorkspaceId) return;
    try {
      const id = await createDoc({ workspaceId: activeWorkspaceId, title: "Untitled" });
      router.push(`/app/documents/${id}`);
    } catch {
      toast.error("Could not create document");
    }
  };

  const QUICK = [
    { label: "New document", desc: "Write & organize", Icon: DocumentText, onClick: onNewDoc, color: "var(--flux-coral)" },
    { label: "New task", desc: "Track your work", Icon: TaskSquare, onClick: () => router.push("/app/tasks?new=1"), color: "var(--accent-ocean)" },
    { label: "New event", desc: "Plan your week", Icon: CalendarAdd, onClick: () => router.push("/app/calendar?new=1"), color: "var(--accent-mint)" },
    { label: "New database", desc: "Structure data", Icon: Data2, onClick: () => router.push("/app/databases?new=1"), color: "#d98324" },
  ];

  return (
    <PageContainer>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">{activeWorkspace?.name}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl" data-testid="home-greeting">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1.5 text-muted-foreground">Here is what is happening in your second brain.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {QUICK.map((q) => (
          <button
            key={q.label}
            onClick={q.onClick}
            data-testid={`quick-${q.label.split(" ")[1]}`}
            className="group flex flex-col items-start rounded-2xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-sm"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in oklch, ${q.color} 16%, transparent)`, color: q.color }}
            >
              <q.Icon variant="Bulk" size={22} />
            </span>
            <span className="mt-3 text-sm font-semibold">{q.label}</span>
            <span className="text-xs text-muted-foreground">{q.desc}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Recent documents */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent documents</h2>
            <Link href="/app/documents" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight2 variant="Bulk" size={15} />
            </Link>
          </div>
          {docs === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
              <DocumentText variant="Bulk" size={30} className="text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No documents yet</p>
              <button onClick={onNewDoc} className={cn(btnPrimary, "mt-4")} data-testid="home-create-doc">
                <Add variant="Bulk" size={16} /> Create your first document
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recent.map((d: any) => (
                <Link
                  key={d._id}
                  href={`/app/documents/${d._id}`}
                  data-testid="home-doc-card"
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
                >
                  <span className="text-2xl leading-none">{d.icon ?? "\ud83d\udcc4"}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:text-primary">{d.title || "Untitled"}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock variant="Bulk" size={12} /> {timeAgo(d.updatedAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Open tasks</h2>
              <Link href="/app/tasks" className="text-xs font-medium text-primary hover:underline">All</Link>
            </div>
            {openTasks.length === 0 ? (
              <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <TickCircle variant="Bulk" size={18} className="text-[var(--accent-mint)]" /> You are all caught up
              </p>
            ) : (
              <ul className="space-y-1.5">
                {openTasks.slice(0, 5).map((t: any) => (
                  <li key={t._id}>
                    <Link href="/app/tasks" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Inbox</h2>
              <Link href="/app/inbox" className="text-xs font-medium text-primary hover:underline">Open</Link>
            </div>
            {!notifications || notifications.length === 0 ? (
              <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Notification variant="Bulk" size={18} /> No notifications
              </p>
            ) : (
              <ul className="space-y-2">
                {notifications.slice(0, 5).map((n: any) => (
                  <li key={n._id} className="flex items-start gap-2">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-border" : "bg-primary")} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
