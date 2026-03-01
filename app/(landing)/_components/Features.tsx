"use client";

import { CheckSquare, FolderKanban, FileText, Users, Bell, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: FileText,
    title: "Collaborative Docs",
    desc: "Rich block-based editor with real-time sync. Write together, never overwrite each other.",
    accent: "from-violet-500/20 to-violet-500/5",
    iconColor: "text-violet-500",
  },
  {
    icon: CheckSquare,
    title: "Task Tracking",
    desc: "Track tasks with priorities, assignments, and due dates. Simple, powerful, and fast.",
    accent: "from-blue-500/20 to-blue-500/5",
    iconColor: "text-blue-500",
  },
  {
    icon: FolderKanban,
    title: "Project Boards",
    desc: "Organize work across projects. See progress at a glance with visual boards.",
    accent: "from-emerald-500/20 to-emerald-500/5",
    iconColor: "text-emerald-500",
  },
  {
    icon: Users,
    title: "Team Workspaces",
    desc: "Invite teammates, assign roles, and collaborate across all your work in one place.",
    accent: "from-amber-500/20 to-amber-500/5",
    iconColor: "text-amber-500",
  },
  {
    icon: Bell,
    title: "Smart Inbox",
    desc: "Mentions, assignments, and updates in one feed. Never miss what matters.",
    accent: "from-pink-500/20 to-pink-500/5",
    iconColor: "text-pink-500",
  },
  {
    icon: Zap,
    title: "Instant Sync",
    desc: "Changes appear live for your whole team. No refresh needed, ever.",
    accent: "from-orange-500/20 to-orange-500/5",
    iconColor: "text-orange-500",
  },
];

export function Features() {
  return (
    <section className="w-full max-w-5xl">
      <div className="mb-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Everything you need</p>
        <h2 className="text-2xl font-bold sm:text-3xl tracking-tight">Built for speed, designed for clarity</h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
          Every feature is crafted to help you and your team move faster.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-2xl border bg-card p-6 text-left transition-all hover:border-primary/20 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className={cn(
              "pointer-events-none absolute inset-0 bg-linear-to-br opacity-0 transition-opacity group-hover:opacity-100",
              f.accent,
            )} />
            <div className="relative">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                <f.icon className={cn("h-5 w-5", f.iconColor)} />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
