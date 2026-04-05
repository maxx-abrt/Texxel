"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Download,
  FileText,
  FolderKanban,
  Heart,
  LayoutGrid,
  List,
  Plus,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "all", label: "All Templates", icon: LayoutGrid },
  { id: "project_management", label: "Project Management", icon: FolderKanban },
  { id: "engineering", label: "Engineering", icon: Zap },
  { id: "design", label: "Design", icon: Sparkles },
  { id: "marketing", label: "Marketing", icon: TrendingUp },
  { id: "sales", label: "Sales", icon: Users },
  { id: "hr", label: "HR & People", icon: Users },
  { id: "education", label: "Education", icon: BookOpen },
  { id: "personal", label: "Personal", icon: Star },
  { id: "startup", label: "Startup", icon: Zap },
] as const;

const SORT_OPTIONS = [
  { id: "popular", label: "Most Popular" },
  { id: "newest", label: "Newest" },
  { id: "featured", label: "Featured" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  project_management: "from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400",
  engineering: "from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  design: "from-violet-500/10 to-violet-500/5 text-violet-600 dark:text-violet-400",
  marketing: "from-orange-500/10 to-orange-500/5 text-orange-600 dark:text-orange-400",
  sales: "from-cyan-500/10 to-cyan-500/5 text-cyan-600 dark:text-cyan-400",
  hr: "from-pink-500/10 to-pink-500/5 text-pink-600 dark:text-pink-400",
  education: "from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400",
  personal: "from-indigo-500/10 to-indigo-500/5 text-indigo-600 dark:text-indigo-400",
  startup: "from-red-500/10 to-red-500/5 text-red-600 dark:text-red-400",
  other: "from-slate-500/10 to-slate-500/5 text-slate-600 dark:text-slate-400",
};

// ─── Template Card ───────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  onLike,
  isLiked,
}: {
  template: any;
  onUse: () => void;
  onLike: () => void;
  isLiked: boolean;
}) {
  const router = useRouter();
  const colorClass = CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.other;

  const includes: string[] = [];
  if (template.includeProject) includes.push("Project");
  if (template.includeTasks) includes.push("Tasks");
  if (template.includeDocuments) includes.push("Docs");

  return (
    <div
      className="group relative rounded-xl border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 cursor-pointer"
      onClick={() => router.push(`/templates/${template._id}`)}
    >
      {/* Cover image or gradient */}
      {template.coverImage ? (
        <div className="h-36 overflow-hidden">
          <img
            src={template.coverImage}
            alt={template.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
      ) : (
        <div className={cn("h-28 bg-gradient-to-br flex items-center justify-center", colorClass)}>
          <div className="text-4xl opacity-60">
            {template.icon ?? "📋"}
          </div>
        </div>
      )}

      {/* Featured badge */}
      {template.isFeatured && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          <Star className="h-2.5 w-2.5 fill-current" /> Featured
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {template.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {template.description}
            </p>
          </div>
        </div>

        {/* Tags */}
        {includes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {includes.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {(template.tags ?? []).slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                className="rounded-md bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary/70"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            {template.authorImage ? (
              <img src={template.authorImage} alt="" className="h-5 w-5 rounded-full" />
            ) : (
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                {template.authorName?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
              {template.authorName}
            </span>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground">
            <button
              onClick={(e) => { e.stopPropagation(); onLike(); }}
              className={cn(
                "flex items-center gap-1 text-[11px] transition-colors hover:text-red-500",
                isLiked && "text-red-500",
              )}
            >
              <Heart className={cn("h-3 w-3", isLiked && "fill-current")} />
              {template.likesCount > 0 && template.likesCount}
            </button>
            <span className="flex items-center gap-1 text-[11px]">
              <Download className="h-3 w-3" />
              {template.usageCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ search, category }: { search: string; category: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <BookOpen className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <h3 className="text-sm font-semibold mb-1">No templates found</h3>
      <p className="text-xs text-muted-foreground max-w-[280px]">
        {search
          ? `No templates match "${search}". Try a different search term.`
          : category !== "all"
            ? "No templates in this category yet. Be the first to create one!"
            : "The marketplace is empty. Create the first template to share with the community!"}
      </p>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"popular" | "newest" | "featured">("featured");

  const featured = useQuery(api.templates.getFeatured);
  const templates = useQuery(api.templates.browse, {
    category: category === "all" ? undefined : category as any,
    search: search || undefined,
    sort,
  });

  const useTemplateMutation = useMutation(api.templates.useTemplate);
  const toggleLikeMutation = useMutation(api.templates.toggleLike);

  const handleUseTemplate = async (templateId: Id<"templates">) => {
    try {
      const result = await useTemplateMutation({ templateId });
      const parts: string[] = [];
      if (result.projectId) parts.push("1 project");
      if (result.taskIds.length) parts.push(`${result.taskIds.length} tasks`);
      if (result.documentIds.length) parts.push(`${result.documentIds.length} docs`);
      toast.success(`Template applied! Created ${parts.join(", ")}`);

      if (result.projectId) {
        router.push(`/projects/${result.projectId}`);
      } else if (result.documentIds.length > 0) {
        router.push(`/documents/${result.documentIds[0]}`);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to use template");
    }
  };

  const handleToggleLike = async (templateId: Id<"templates">) => {
    try {
      await toggleLikeMutation({ templateId });
    } catch {
      toast.error("Failed to update like");
    }
  };

  const showFeatured = !search && category === "all" && sort === "featured" && (featured?.length ?? 0) > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">

        {/* Hero header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Template Gallery</h1>
              <p className="text-sm text-muted-foreground">
                Discover and share project templates with the community
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="pl-9 h-9 rounded-lg"
              />
            </div>
            <Button
              onClick={() => router.push("/templates/new")}
              size="sm"
              className="gap-2 h-9 rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" /> Publish Template
            </Button>
          </div>
        </div>

        {/* Category pills + sort */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition-all shrink-0",
                  category === cat.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
                )}
              >
                <cat.icon className="h-3 w-3" />
                {cat.label}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 rounded-lg border p-0.5 shrink-0">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id as any)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all whitespace-nowrap",
                  sort === opt.id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Featured section */}
        {showFeatured && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Star className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold">Featured Templates</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(featured ?? []).slice(0, 4).map((t) => (
                <TemplateCard
                  key={t._id}
                  template={t}
                  onUse={() => handleUseTemplate(t._id)}
                  onLike={() => handleToggleLike(t._id)}
                  isLiked={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* All templates grid */}
        <section>
          {!showFeatured && (
            <div className="flex items-center gap-2 mb-5">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">
                {category === "all" ? "All Templates" : CATEGORIES.find((c) => c.id === category)?.label ?? "Templates"}
              </h2>
              {templates && (
                <span className="text-xs text-muted-foreground ml-1">({templates.length})</span>
              )}
            </div>
          )}

          {templates === undefined ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border overflow-hidden">
                  <Skeleton className="h-28" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState search={search} category={category} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <TemplateCard
                  key={t._id}
                  template={t}
                  onUse={() => handleUseTemplate(t._id)}
                  onLike={() => handleToggleLike(t._id)}
                  isLiked={false}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
