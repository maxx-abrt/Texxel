"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BookOpen,
  CheckSquare,
  Clock,
  Download,
  FileText,
  FolderKanban,
  Heart,
  Share2,
  Star,
  Tag,
  User,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  project_management: "Project Management",
  engineering: "Engineering",
  design: "Design",
  marketing: "Marketing",
  sales: "Sales",
  hr: "HR & People",
  education: "Education",
  personal: "Personal",
  startup: "Startup",
  other: "Other",
};

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as Id<"templates">;

  const template = useQuery(api.templates.getById, { id: templateId });
  const isLiked = useQuery(api.templates.isLiked, { templateId });
  const useTemplateMutation = useMutation(api.templates.useTemplate);
  const toggleLikeMutation = useMutation(api.templates.toggleLike);
  const [isUsing, setIsUsing] = useState(false);

  const handleUse = async () => {
    setIsUsing(true);
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
      } else {
        router.push("/documents");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to use template");
    } finally {
      setIsUsing(false);
    }
  };

  const handleLike = async () => {
    try {
      await toggleLikeMutation({ templateId });
    } catch {
      toast.error("Failed to update like");
    }
  };

  if (template === undefined) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Skeleton className="h-6 w-32 mb-8" />
          <Skeleton className="h-52 w-full rounded-xl mb-6" />
          <Skeleton className="h-8 w-2/3 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Template not found</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/templates")} className="mt-3 gap-2">
            <ArrowLeft className="h-3 w-3" /> Back to templates
          </Button>
        </div>
      </div>
    );
  }

  // Parse preview data
  let taskCount = 0;
  let docCount = 0;
  let taskPreviews: { title: string; status: string; priority: string }[] = [];
  let docPreviews: { title: string; icon?: string }[] = [];

  try {
    if (template.tasksData) {
      const tasks = JSON.parse(template.tasksData);
      taskCount = tasks.length;
      taskPreviews = tasks.slice(0, 6);
    }
  } catch {}
  try {
    if (template.documentsData) {
      const docs = JSON.parse(template.documentsData);
      docCount = docs.length;
      docPreviews = docs.slice(0, 6);
    }
  } catch {}

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">

        {/* Back link */}
        <button
          onClick={() => router.push("/templates")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> Back to templates
        </button>

        {/* Cover image */}
        {template.coverImage && (
          <div className="rounded-xl overflow-hidden mb-8 h-56 md:h-72">
            <img
              src={template.coverImage}
              alt={template.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-8">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{template.icon ?? "📋"}</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {CATEGORY_LABELS[template.category] ?? template.category}
              </span>
              {template.isFeatured && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <Star className="h-2.5 w-2.5 fill-current" /> Featured
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">{template.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{template.description}</p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <Button onClick={handleUse} disabled={isUsing} className="gap-2 h-10 px-6">
              <Download className="h-4 w-4" />
              {isUsing ? "Applying..." : "Use Template"}
            </Button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg border h-9 text-xs font-medium transition-colors",
                  isLiked
                    ? "border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                    : "hover:border-red-200 hover:text-red-500",
                )}
              >
                <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                {template.likesCount}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied!");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border h-9 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
            </div>
          </div>
        </div>

        {/* Author & Stats */}
        <div className="flex items-center gap-6 mb-8 pb-8 border-b">
          <div className="flex items-center gap-2.5">
            {template.authorImage ? (
              <img src={template.authorImage} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {template.authorName?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{template.authorName}</p>
              <p className="text-[11px] text-muted-foreground">Author</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Download className="h-3.5 w-3.5" />
            <span className="text-sm font-medium">{template.usageCount}</span>
            <span className="text-xs">uses</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">
              {new Date(template.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Long description */}
        {template.longDescription && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold mb-3">About this template</h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {template.longDescription}
            </div>
          </section>
        )}

        {/* Preview images */}
        {template.previewImages && template.previewImages.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold mb-3">Preview</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {template.previewImages.map((img: string, i: number) => (
                <div key={i} className="rounded-xl border overflow-hidden">
                  <img src={img} alt={`Preview ${i + 1}`} className="w-full" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* What's included */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-4">What&apos;s included</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {template.includeProject && (
              <div className="rounded-xl border p-4 bg-gradient-to-br from-violet-500/5 to-transparent">
                <FolderKanban className="h-5 w-5 text-violet-500 mb-2" />
                <p className="text-sm font-medium">Project</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ready-to-use project setup</p>
              </div>
            )}
            {template.includeTasks && (
              <div className="rounded-xl border p-4 bg-gradient-to-br from-blue-500/5 to-transparent">
                <CheckSquare className="h-5 w-5 text-blue-500 mb-2" />
                <p className="text-sm font-medium">{taskCount} Tasks</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pre-configured task list</p>
              </div>
            )}
            {template.includeDocuments && (
              <div className="rounded-xl border p-4 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <FileText className="h-5 w-5 text-emerald-500 mb-2" />
                <p className="text-sm font-medium">{docCount} Documents</p>
                <p className="text-xs text-muted-foreground mt-0.5">Template documents & notes</p>
              </div>
            )}
          </div>
        </section>

        {/* Task previews */}
        {taskPreviews.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold mb-3">Tasks preview</h2>
            <div className="rounded-xl border divide-y">
              {taskPreviews.map((task, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  {task.priority && task.priority !== "none" && (
                    <span className={cn(
                      "text-[10px] font-medium capitalize px-1.5 py-0.5 rounded",
                      task.priority === "urgent" && "bg-red-500/10 text-red-500",
                      task.priority === "high" && "bg-orange-500/10 text-orange-500",
                      task.priority === "medium" && "bg-amber-500/10 text-amber-500",
                      task.priority === "low" && "bg-sky-500/10 text-sky-500",
                    )}>
                      {task.priority}
                    </span>
                  )}
                </div>
              ))}
              {taskCount > 6 && (
                <div className="px-4 py-2 text-center text-xs text-muted-foreground">
                  +{taskCount - 6} more tasks
                </div>
              )}
            </div>
          </section>
        )}

        {/* Document previews */}
        {docPreviews.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold mb-3">Documents preview</h2>
            <div className="rounded-xl border divide-y">
              {docPreviews.map((doc, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-sm shrink-0">{doc.icon ?? "📄"}</span>
                  <span className="text-sm flex-1 truncate">{doc.title}</span>
                </div>
              ))}
              {docCount > 6 && (
                <div className="px-4 py-2 text-center text-xs text-muted-foreground">
                  +{docCount - 6} more documents
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold mb-3">Tags</h2>
            <div className="flex flex-wrap gap-1.5">
              {template.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <Tag className="h-2.5 w-2.5" /> {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="border-t pt-8 text-center">
          <Button onClick={handleUse} disabled={isUsing} size="lg" className="gap-2 px-8">
            <Download className="h-4 w-4" />
            {isUsing ? "Applying template..." : "Use this Template"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            This will create a copy of all included items in your workspace
          </p>
        </div>
      </div>
    </div>
  );
}
