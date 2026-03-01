"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CheckSquare,
  FolderKanban,
  FileText,
  Users,
  ArrowRight,
  Sparkles,
  Check,
} from "lucide-react";

const STEPS = ["welcome", "role", "use_case", "team", "done"] as const;
type Step = (typeof STEPS)[number];

const ROLES = [
  { id: "individual", label: "Individual", desc: "Just me, personal use" },
  { id: "team_lead", label: "Team Lead", desc: "Leading a small team" },
  { id: "manager", label: "Manager", desc: "Managing projects & people" },
  { id: "developer", label: "Developer", desc: "Building & shipping software" },
];

const USE_CASES = [
  { id: "tasks", label: "Task Management", icon: CheckSquare, desc: "Track todos & work items" },
  { id: "projects", label: "Projects", icon: FolderKanban, desc: "Plan & execute projects" },
  { id: "notes", label: "Notes & Docs", icon: FileText, desc: "Write & collaborate on docs" },
  { id: "team", label: "Team Collaboration", icon: Users, desc: "Work with your team" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const profile = useQuery(
    api.userProfiles.getMyProfile,
    isAuthenticated ? {} : "skip",
  );
  const createTeam = useMutation(api.teams.create);
  const completeOnboarding = useMutation(api.userProfiles.completeOnboarding);
  const upsertProfile = useMutation(api.userProfiles.upsertProfile);

  // Redirect if already onboarded
  useEffect(() => {
    if (!convexLoading && isAuthenticated && profile?.onboardingCompleted) {
      router.replace("/documents");
    }
  }, [convexLoading, isAuthenticated, profile?.onboardingCompleted, router]);

  // Create profile record when Convex auth is ready
  useEffect(() => {
    if (isAuthenticated && session?.user && profile === null) {
      upsertProfile({
        name: session.user.name ?? undefined,
        email: session.user.email ?? undefined,
      }).catch(() => {});
    }
  }, [isAuthenticated, profile, session?.user?.id]);

  const [step, setStep] = useState<Step>("welcome");
  const [role, setRole] = useState("");
  const [useCases, setUseCases] = useState<string[]>([]);
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Track isAuthenticated in a ref so async polling sees updates
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const stepIdx = STEPS.indexOf(step);
  const progress = ((stepIdx) / (STEPS.length - 1)) * 100;

  const toggleUseCase = (id: string) =>
    setUseCases((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleTeamName = (v: string) => {
    setTeamName(v);
    setTeamSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  // Helper: wait for Convex auth to become ready (polls every 500ms, up to 10s)
  const waitForAuth = async (): Promise<boolean> => {
    if (isAuthenticatedRef.current) return true;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (isAuthenticatedRef.current) return true;
    }
    return false;
  };

  const handleFinish = async () => {
    setIsCreating(true);
    try {
      const ready = await waitForAuth();
      if (!ready) {
        toast.error("Could not connect to the server. Please refresh and try again.");
        setIsCreating(false);
        return;
      }
      if (teamName.trim() && teamSlug.trim()) {
        await createTeam({
          name: teamName.trim(),
          slug: teamSlug.trim(),
          ownerEmail: session?.user?.email ?? "",
          ownerName: session?.user?.name ?? "",
          ownerImage: session?.user?.image ?? undefined,
        });
      }
      await completeOnboarding({ role: role || undefined, useCases: useCases.length ? useCases : undefined });
      router.push("/documents");
    } catch (err) {
      console.error("[onboarding] handleFinish error:", err);
      toast.error("Could not finish onboarding. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSkipToFinish = async () => {
    setIsCreating(true);
    try {
      const ready = await waitForAuth();
      if (!ready) {
        toast.error("Could not connect to the server. Please refresh and try again.");
        setIsCreating(false);
        return;
      }
      await completeOnboarding({ role: role || undefined, useCases: useCases.length ? useCases : undefined });
      router.push("/documents");
    } catch (err) {
      console.error("[onboarding] handleSkipToFinish error:", err);
      toast.error("Could not complete onboarding. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  if (convexLoading || (isAuthenticated && profile === undefined)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">
              Step {stepIdx + 1} of {STEPS.length}
            </span>
            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card shadow-lg p-8">
          {/* Welcome */}
          {step === "welcome" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Welcome, {firstName}! 👋</h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                A2E Thread brings together notes, tasks, projects, and team collaboration in one place. Let&apos;s get you set up in just a minute.
              </p>
              <Button onClick={next} size="lg" className="w-full gap-2">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Role */}
          {step === "role" && (
            <div>
              <h2 className="text-xl font-bold mb-1">What best describes you?</h2>
              <p className="text-muted-foreground text-sm mb-6">We&apos;ll tailor your experience accordingly.</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all hover:border-primary/50",
                      role === r.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card",
                    )}
                  >
                    <p className="font-semibold text-sm">{r.label}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
              <Button onClick={next} disabled={!role} className="w-full gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Use cases */}
          {step === "use_case" && (
            <div>
              <h2 className="text-xl font-bold mb-1">What will you use A2E for?</h2>
              <p className="text-muted-foreground text-sm mb-6">Select all that apply.</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {USE_CASES.map((uc) => {
                  const selected = useCases.includes(uc.id);
                  return (
                    <button
                      key={uc.id}
                      onClick={() => toggleUseCase(uc.id)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-all hover:border-primary/50 relative",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-card",
                      )}
                    >
                      {selected && (
                        <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                      <uc.icon className={cn("h-5 w-5 mb-2", selected ? "text-primary" : "text-muted-foreground")} />
                      <p className="font-semibold text-sm">{uc.label}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{uc.desc}</p>
                    </button>
                  );
                })}
              </div>
              <Button onClick={next} disabled={useCases.length === 0} className="w-full gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Team */}
          {step === "team" && (
            <div>
              <h2 className="text-xl font-bold mb-1">Create your workspace</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Give your team or workspace a name. You can always create more later.
              </p>
              <div className="space-y-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Workspace name</label>
                  <Input
                    placeholder="Acme Corp"
                    value={teamName}
                    onChange={(e) => handleTeamName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">URL slug</label>
                  <div className="flex items-center rounded-md border overflow-hidden">
                    <span className="bg-muted px-3 py-2 text-sm text-muted-foreground border-r">a2e.app/teams/</span>
                    <Input
                      value={teamSlug}
                      onChange={(e) => setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="border-0 rounded-none focus-visible:ring-0"
                      placeholder="acme-corp"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleSkipToFinish} disabled={isCreating || convexLoading} className="flex-1">
                  Skip for now
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={!teamName.trim() || !teamSlug.trim() || isCreating || convexLoading}
                  className="flex-1 gap-2"
                >
                  {isCreating ? "Creating..." : "Create & finish"}
                </Button>
              </div>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You&apos;re all set!</h2>
              <p className="text-muted-foreground mb-8">
                Your workspace is ready. Start creating notes, tasks, and collaborating with your team.
              </p>
              <Button onClick={() => router.push("/documents")} size="lg" className="w-full gap-2">
                Open workspace <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
