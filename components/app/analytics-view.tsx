"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import {
  TaskSquare,
  TickCircle,
  Chart2,
  DocumentText,
  Briefcase,
  Flash,
  TrendUp,
} from "iconsax-reactjs";

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#c93c2a" },
  high: { label: "Haute", color: "#e55a42" },
  medium: { label: "Moyenne", color: "#d98324" },
  low: { label: "Faible", color: "#2f7ea6" },
  none: { label: "Aucune", color: "#9aa0a6" },
};

function KpiCard({ Icon, label, value, sub, tint }: any) {
  return (
    <div className="tx-card tx-card-hover p-4" data-testid="analytics-kpi">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklch, ${tint} 14%, transparent)`, color: tint }}>
          <Icon variant="Bulk" size={22} />
        </span>
        {sub != null && <span className="text-xs font-medium text-muted-foreground">{sub}</span>}
      </div>
      <div className="mt-3 text-3xl font-extrabold tracking-tight tabular">{value}</div>
      <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children, className = "" }: any) {
  return (
    <div className={`tx-card p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        {Icon && <Icon variant="Bulk" size={17} className="text-primary" />} {title}
      </div>
      {children}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-[var(--elev-2)]">
      {label != null && <div className="mb-1 font-semibold">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsView() {
  const { activeWorkspaceId } = useWorkspace();
  const skip = activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip";
  const tasks = useQuery(api.flux_tasks.list, skip as any);
  const statuses = useQuery(api.flux_taskStatuses.list, skip as any);
  const docs = useQuery(api.flux_documents.list, skip as any);
  const projects = useQuery(api.projects.list, skip as any);

  const loading = tasks === undefined || statuses === undefined;

  const data = useMemo(() => {
    const ts = tasks ?? [];
    const sts = statuses ?? [];
    const doneKeys = new Set(sts.filter((s: any) => s.isDone).map((s: any) => s.key));
    const completed = ts.filter((t: any) => doneKeys.has(t.status)).length;
    const total = ts.length;
    const rate = total ? Math.round((completed / total) * 100) : 0;

    const byStatus = sts.map((s: any) => ({
      name: s.label,
      value: ts.filter((t: any) => t.status === s.key).length,
      color: s.color,
    }));

    const prioOrder = ["urgent", "high", "medium", "low", "none"];
    const byPriority = prioOrder.map((k) => ({
      name: PRIORITY_META[k].label,
      value: ts.filter((t: any) => (t.priority ?? "none") === k).length,
      color: PRIORITY_META[k].color,
    })).filter((d) => d.value > 0);

    // weekly created (last 8 weeks)
    const WEEK = 7 * 86400000;
    const now = Date.now();
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = now - (7 - i) * WEEK + WEEK;
      const start = end - WEEK;
      const created = ts.filter((t: any) => t._creationTime >= start && t._creationTime < end).length;
      const done = ts.filter((t: any) => doneKeys.has(t.status) && t._creationTime >= start && t._creationTime < end).length;
      const d = new Date(end - WEEK);
      return { name: `${d.getDate()}/${d.getMonth() + 1}`, created, done };
    });

    // heatmap last 18 weeks (by creation day)
    const DAY = 86400000;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const startDow = (today.getDay() + 6) % 7;
    const gridStart = today.getTime() - startDow * DAY - 17 * 7 * DAY;
    const counts: Record<string, number> = {};
    for (const t of ts) {
      const d = new Date(t._creationTime); d.setHours(0, 0, 0, 0);
      const key = d.getTime();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const cells: { level: number; count: number; date: number }[] = [];
    for (let i = 0; i < 18 * 7; i++) {
      const day = gridStart + i * DAY;
      const c = counts[day] ?? 0;
      const level = c === 0 ? 0 : c === 1 ? 1 : c <= 2 ? 2 : c <= 4 ? 3 : 4;
      cells.push({ level, count: c, date: day });
    }

    const active = (projects ?? []).filter((p: any) => p.status !== "archived").length;

    return {
      total, completed, rate, byStatus, byPriority, weeks, cells,
      docCount: (docs ?? []).length,
      projectCount: active,
      inProgress: ts.filter((t: any) => !doneKeys.has(t.status)).length,
    };
  }, [tasks, statuses, docs, projects]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6" data-testid="analytics-view">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Chart2 variant="Bulk" size={24} className="text-primary" /> Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Live overview of your workspace activity.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1f9d76]" /> Temps réel
        </span>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard Icon={TaskSquare} label="Tâches totales" value={data.total} tint="#2f7ea6" />
        <KpiCard Icon={TickCircle} label="Terminées" value={data.completed} sub={`${data.rate}%`} tint="#1f9d76" />
        <KpiCard Icon={DocumentText} label="Documents" value={data.docCount} tint="#e55a42" />
        <KpiCard Icon={Briefcase} label="Projets actifs" value={data.projectCount} tint="#d98324" />
      </div>

      {/* Completion progress bar */}
      <div className="tx-card mt-4 p-5">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2"><Flash variant="Bulk" size={17} className="text-primary" /> Taux d'achèvement</span>
          <span className="tabular text-muted-foreground">{data.completed}/{data.total}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${data.rate}%` }} />
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">{data.rate}% des tâches sont terminées · {data.inProgress} en cours</div>
      </div>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Tâches par statut" icon={Chart2}>
          {data.byStatus.some((d) => d.value > 0) ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.byStatus} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {data.byStatus.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5">
                {data.byStatus.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="ml-auto font-semibold tabular">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Par priorité" icon={TrendUp}>
          {data.byPriority.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byPriority} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "color-mix(in oklch, var(--muted) 60%, transparent)" }} />
                  <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={22}>
                    {data.byPriority.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Débit hebdomadaire" icon={TrendUp}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weeks} margin={{ left: -18, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e55a42" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#e55a42" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f9d76" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1f9d76" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="created" name="Créées" stroke="#e55a42" strokeWidth={2} fill="url(#gCreated)" />
                <Area type="monotone" dataKey="done" name="Terminées" stroke="#1f9d76" strokeWidth={2} fill="url(#gDone)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Contribution heatmap */}
      <div className="tx-card mt-4 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Flash variant="Bulk" size={17} className="text-primary" /> Activité (18 dernières semaines)
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ width: "max-content" }} data-testid="analytics-heatmap">
            {data.cells.map((c, i) => (
              <span key={i} title={`${c.count} · ${new Date(c.date).toLocaleDateString()}`} className={`h-3 w-3 rounded-[3px] tx-heat-${c.level}`} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          Moins {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`h-3 w-3 rounded-[3px] tx-heat-${l}`} />)} Plus
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-52 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <Chart2 variant="Bulk" size={30} className="opacity-40" />
      Pas encore de données
    </div>
  );
}
