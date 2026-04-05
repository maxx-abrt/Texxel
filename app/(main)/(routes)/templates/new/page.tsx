"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  Image,
  Loader2,
  Plus,
  Sparkles,
  Tag,
  X,
} from "lucide-react";

const CATEGORIES = [
  { id: "project_management", label: "Project Management" },
  { id: "engineering", label: "Engineering" },
  { id: "design", label: "Design" },
  { id: "marketing", label: "Marketing" },
  { id: "sales", label: "Sales" },
  { id: "hr", label: "HR & People" },
  { id: "education", label: "Education" },
  { id: "personal", label: "Personal" },
  { id: "startup", label: "Startup" },
  { id: "other", label: "Other" },
] as const;

const CATEGORY_FR: Record<string, string> = {
  project_management: "Gestion de projet",
  engineering: "Ingénierie",
  design: "Design",
  marketing: "Marketing",
  sales: "Ventes",
  hr: "RH & Personnel",
  education: "Éducation",
  personal: "Personnel",
  startup: "Startup",
  other: "Autre",
};

export default function NewTemplatePage() {
  const router = useRouter();
  const t = useTranslations("templates");
  const tc = useTranslations("common");

  const createTemplate = useMutation(api.templates.create);
  const myTasks = useQuery(api.tasks.getMyTasks, {});
  const myDocs = useQuery(api.documents.getSidebar, { parentDocument: undefined });
  const myProjects = useQuery(api.projects.getMyProjects, {});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [category, setCategory] = useState<string>("project_management");
  const [icon, setIcon] = useState("📋");
  const [color, setColor] = useState("#6366f1");
  const [coverImage, setCoverImage] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  // Content selection
  const [includeProject, setIncludeProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [includeTasks, setIncludeTasks] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 8) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const toggleTask = (id: string) => {
    const next = new Set(selectedTaskIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedTaskIds(next);
  };

  const toggleDoc = (id: string) => {
    const next = new Set(selectedDocIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedDocIds(next);
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast.error(t("titleRequired")); return; }
    if (!description.trim()) { toast.error(t("descRequired")); return; }

    setIsCreating(true);
    try {
      // Build tasks data
      let tasksData: string | undefined;
      if (includeTasks && selectedTaskIds.size > 0 && myTasks) {
        const selected = myTasks.filter((t) => selectedTaskIds.has(t._id));
        tasksData = JSON.stringify(
          selected.map((t) => ({
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            labels: t.labels,
          })),
        );
      }

      // Build documents data
      let documentsData: string | undefined;
      if (includeDocuments && selectedDocIds.size > 0 && myDocs) {
        const selected = myDocs.filter((d) => selectedDocIds.has(d._id));
        documentsData = JSON.stringify(
          selected.map((d) => ({
            title: d.title,
            icon: d.icon,
            content: (d as any).content,
          })),
        );
      }

      // Build project data
      let projectData: string | undefined;
      if (includeProject && selectedProjectId && myProjects) {
        const proj = myProjects.find((p) => p?._id === selectedProjectId);
        if (proj) {
          projectData = JSON.stringify({
            name: proj.name,
            description: proj.description,
            icon: proj.icon,
            color: proj.color,
          });
        }
      }

      const id = await createTemplate({
        title: title.trim(),
        description: description.trim(),
        longDescription: longDescription.trim() || undefined,
        category: category as any,
        icon: icon || undefined,
        color: color || undefined,
        coverImage: coverImage.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        includeTasks: includeTasks && selectedTaskIds.size > 0,
        includeDocuments: includeDocuments && selectedDocIds.size > 0,
        includeProject: includeProject && !!selectedProjectId,
        tasksData,
        documentsData,
        projectData,
        isPublished,
      });

      toast.success(t("created"));
      router.push(`/templates/${id}`);
    } catch (err: any) {
      toast.error(err.message ?? t("createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 md:px-10">

        {/* Back */}
        <button
          onClick={() => router.push("/templates")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> {t("backToTemplates")}
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">{t("publishTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("publishDesc")}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                step === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : step > s
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {step > s ? <Check className="h-3 w-3" /> : null}
              {t(`step${s}` as any)}
            </button>
          ))}
        </div>

        {/* Step 1: Basic info */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid gap-5">
              {/* Icon & Title */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => {
                    const emojis = ["📋", "🚀", "💡", "🎯", "⚡", "📊", "🎨", "📝", "🔥", "✨", "📦", "🗂️"];
                    const idx = emojis.indexOf(icon);
                    setIcon(emojis[(idx + 1) % emojis.length]);
                  }}
                  className="h-14 w-14 shrink-0 rounded-xl border-2 border-dashed flex items-center justify-center text-2xl hover:border-primary/30 transition-colors"
                >
                  {icon}
                </button>
                <div className="flex-1 space-y-2">
                  <Label>{t("templateName")}</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("templateNamePlaceholder")}
                    className="h-10 text-base font-medium"
                  />
                </div>
              </div>

              {/* Short description */}
              <div className="space-y-2">
                <Label>{t("shortDesc")}</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("shortDescPlaceholder")}
                  rows={2}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                />
              </div>

              {/* Long description */}
              <div className="space-y-2">
                <Label>{t("longDesc")} <span className="text-muted-foreground font-normal">({tc("optional")})</span></Label>
                <textarea
                  value={longDescription}
                  onChange={(e) => setLongDescription(e.target.value)}
                  placeholder={t("longDescPlaceholder")}
                  rows={4}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left",
                        category === cat.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "hover:border-primary/30 text-muted-foreground",
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover image URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5" /> {t("coverImage")} <span className="text-muted-foreground font-normal">({tc("optional")})</span>
                </Label>
                <Input
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="h-9"
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> {t("tags")} <span className="text-muted-foreground font-normal">({tc("optional")})</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder={t("tagPlaceholder")}
                    className="h-8 flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={addTag} className="h-8 px-3">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {tag}
                        <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-red-500 transition-colors">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setStep(2)} disabled={!title.trim() || !description.trim()} className="gap-2">
                {t("next")} <ChevronDown className="h-3 w-3 -rotate-90" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select content */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <p className="text-sm text-muted-foreground">{t("selectContentDesc")}</p>

            {/* Include project */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <FolderKanban className="h-4 w-4 text-violet-500" />
                  <span className="text-sm font-semibold">{t("includeProject")}</span>
                </div>
                <button
                  onClick={() => setIncludeProject(!includeProject)}
                  className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", includeProject ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5", includeProject ? "translate-x-4 ml-0.5" : "translate-x-0.5")} />
                </button>
              </div>
              {includeProject && (
                <div className="rounded-lg border divide-y max-h-40 overflow-y-auto">
                  {(myProjects ?? []).filter(Boolean).map((proj) => (
                    <button
                      key={proj!._id}
                      onClick={() => setSelectedProjectId(selectedProjectId === proj!._id ? null : proj!._id)}
                      className={cn("flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/30", selectedProjectId === proj!._id && "bg-primary/5")}
                    >
                      <div className={cn("h-4 w-4 shrink-0 rounded border transition-colors flex items-center justify-center", selectedProjectId === proj!._id ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                        {selectedProjectId === proj!._id && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <div className="h-4 w-4 rounded" style={{ backgroundColor: proj!.color ?? "#6366f1" }} />
                      <span className="text-sm truncate">{proj!.name}</span>
                    </button>
                  ))}
                  {(myProjects ?? []).length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{t("noProjectsAvailable")}</p>}
                </div>
              )}
            </div>

            {/* Include tasks */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold">{t("includeTasks")}</span>
                  {includeTasks && selectedTaskIds.size > 0 && (
                    <span className="text-xs text-primary font-medium">({selectedTaskIds.size})</span>
                  )}
                </div>
                <button
                  onClick={() => setIncludeTasks(!includeTasks)}
                  className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", includeTasks ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5", includeTasks ? "translate-x-4 ml-0.5" : "translate-x-0.5")} />
                </button>
              </div>
              {includeTasks && (
                <div className="rounded-lg border divide-y max-h-52 overflow-y-auto">
                  {(myTasks ?? []).slice(0, 30).map((task) => (
                    <button
                      key={task._id}
                      onClick={() => toggleTask(task._id)}
                      className={cn("flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/30", selectedTaskIds.has(task._id) && "bg-primary/5")}
                    >
                      <div className={cn("h-4 w-4 shrink-0 rounded border transition-colors flex items-center justify-center", selectedTaskIds.has(task._id) ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                        {selectedTaskIds.has(task._id) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className="text-sm truncate flex-1">{task.title}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{task.status.replace("_", " ")}</span>
                    </button>
                  ))}
                  {(myTasks ?? []).length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{t("noTasksAvailable")}</p>}
                </div>
              )}
            </div>

            {/* Include documents */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold">{t("includeDocs")}</span>
                  {includeDocuments && selectedDocIds.size > 0 && (
                    <span className="text-xs text-primary font-medium">({selectedDocIds.size})</span>
                  )}
                </div>
                <button
                  onClick={() => setIncludeDocuments(!includeDocuments)}
                  className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", includeDocuments ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5", includeDocuments ? "translate-x-4 ml-0.5" : "translate-x-0.5")} />
                </button>
              </div>
              {includeDocuments && (
                <div className="rounded-lg border divide-y max-h-52 overflow-y-auto">
                  {(myDocs ?? []).slice(0, 30).map((doc) => (
                    <button
                      key={doc._id}
                      onClick={() => toggleDoc(doc._id)}
                      className={cn("flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/30", selectedDocIds.has(doc._id) && "bg-primary/5")}
                    >
                      <div className={cn("h-4 w-4 shrink-0 rounded border transition-colors flex items-center justify-center", selectedDocIds.has(doc._id) ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                        {selectedDocIds.has(doc._id) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className="text-sm shrink-0">{doc.icon ?? "📄"}</span>
                      <span className="text-sm truncate flex-1">{doc.title || "Untitled"}</span>
                    </button>
                  ))}
                  {(myDocs ?? []).length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{t("noDocsAvailable")}</p>}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ChevronDown className="h-3 w-3 rotate-90" /> {t("back")}
              </Button>
              <Button onClick={() => setStep(3)} className="gap-2">
                {t("next")} <ChevronDown className="h-3 w-3 -rotate-90" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Publish */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Preview card */}
            <div className="rounded-xl border overflow-hidden">
              <div className={cn("h-24 flex items-center justify-center", coverImage ? "" : "bg-gradient-to-br from-primary/10 to-primary/5")}>
                {coverImage ? (
                  <img src={coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl opacity-60">{icon}</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{title || t("templateNamePlaceholder")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{description || t("shortDescPlaceholder")}</p>
                <div className="flex gap-1.5 mt-3">
                  {includeProject && selectedProjectId && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">Project</span>}
                  {includeTasks && selectedTaskIds.size > 0 && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">{selectedTaskIds.size} Tasks</span>}
                  {includeDocuments && selectedDocIds.size > 0 && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">{selectedDocIds.size} Docs</span>}
                </div>
              </div>
            </div>

            {/* Visibility */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {isPublished ? <Eye className="h-4 w-4 text-emerald-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-semibold">{isPublished ? t("publicTemplate") : t("draftTemplate")}</p>
                    <p className="text-xs text-muted-foreground">{isPublished ? t("publicTemplateDesc") : t("draftTemplateDesc")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPublished(!isPublished)}
                  className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", isPublished ? "bg-emerald-500" : "bg-muted")}
                >
                  <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5", isPublished ? "translate-x-4 ml-0.5" : "translate-x-0.5")} />
                </button>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ChevronDown className="h-3 w-3 rotate-90" /> {t("back")}
              </Button>
              <Button onClick={handleCreate} disabled={isCreating} className="gap-2 px-6">
                {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isCreating ? t("publishing") : t("publishTemplate")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
