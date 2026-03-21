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
import { useTranslations } from "next-intl";
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

const ROLE_IDS = ["individual", "team_lead", "manager", "developer"] as const;
const USE_CASE_IDS = ["tasks", "projects", "notes", "team"] as const;
const USE_CASE_ICONS = [CheckSquare, FolderKanban, FileText, Users] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("onboarding");
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
        toast.error(t("errors.noServer"));
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
      toast.error(t("errors.failed"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleSkipToFinish = async () => {
    setIsCreating(true);
    try {
      const ready = await waitForAuth();
      if (!ready) {
        toast.error(t("errors.noServer"));
        setIsCreating(false);
        return;
      }
      await completeOnboarding({ role: role || undefined, useCases: useCases.length ? useCases : undefined });
      router.push("/documents");
    } catch (err) {
      console.error("[onboarding] handleSkipToFinish error:", err);
      toast.error(t("errors.failed"));
    } finally {
      setIsCreating(false);
    }
  };

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const firstName = session?.user?.name?.split(" ")[0] ?? "";

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
              {t("step")} {stepIdx + 1} {t("of")} {STEPS.length}
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
              <h1 className="text-2xl font-bold mb-2">{t("welcome.title", { name: firstName })} 👋</h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">{t("welcome.desc")}</p>
              <Button onClick={next} size="lg" className="w-full gap-2">
                {t("welcome.cta")} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Role */}
          {step === "role" && (
            <div>
              <h2 className="text-xl font-bold mb-1">{t("role.title")}</h2>
              <p className="text-muted-foreground text-sm mb-6">{t("role.subtitle")}</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {ROLE_IDS.map((id) => (
                  <button
                    key={id}
                    onClick={() => setRole(id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all hover:border-primary/50",
                      role === id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card",
                    )}
                  >
                    <p className="font-semibold text-sm">{t(`role.roles.${id}.label` as any)}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{t(`role.roles.${id}.desc` as any)}</p>
                  </button>
                ))}
              </div>
              <Button onClick={next} disabled={!role} className="w-full gap-2">
                {t("role.continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Use cases */}
          {step === "use_case" && (
            <div>
              <h2 className="text-xl font-bold mb-1">{t("useCase.title")}</h2>
              <p className="text-muted-foreground text-sm mb-6">{t("useCase.subtitle")}</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {USE_CASE_IDS.map((id, i) => {
                  const selected = useCases.includes(id);
                  const Icon = USE_CASE_ICONS[i];
                  return (
                    <button
                      key={id}
                      onClick={() => toggleUseCase(id)}
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
                      <Icon className={cn("h-5 w-5 mb-2", selected ? "text-primary" : "text-muted-foreground")} />
                      <p className="font-semibold text-sm">{t(`useCase.cases.${id}.label` as any)}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{t(`useCase.cases.${id}.desc` as any)}</p>
                    </button>
                  );
                })}
              </div>
              <Button onClick={next} disabled={useCases.length === 0} className="w-full gap-2">
                {t("useCase.continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Team */}
          {step === "team" && (
            <div>
              <h2 className="text-xl font-bold mb-1">{t("team.title")}</h2>
              <p className="text-muted-foreground text-sm mb-6">{t("team.subtitle")}</p>
              <div className="space-y-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("team.workspaceName")}</label>
                  <Input
                    placeholder={t("team.workspacePlaceholder")}
                    value={teamName}
                    onChange={(e) => handleTeamName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("team.urlSlug")}</label>
                  <div className="flex items-center rounded-md border overflow-hidden">
                    <span className="bg-muted px-3 py-2 text-sm text-muted-foreground border-r">{t("team.slugPrefix")}</span>
                    <Input
                      value={teamSlug}
                      onChange={(e) => setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="border-0 rounded-none focus-visible:ring-0"
                      placeholder={t("team.slugPlaceholder")}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleSkipToFinish} disabled={isCreating || convexLoading} className="flex-1">
                  {t("team.skip")}
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={!teamName.trim() || !teamSlug.trim() || isCreating || convexLoading}
                  className="flex-1 gap-2"
                >
                  {isCreating ? t("team.creating") : t("team.createFinish")}
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
              <h2 className="text-2xl font-bold mb-2">{t("done.title")}</h2>
              <p className="text-muted-foreground mb-8">{t("done.desc")}</p>
              <Button onClick={() => router.push("/documents")} size="lg" className="w-full gap-2">
                {t("done.cta")} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
