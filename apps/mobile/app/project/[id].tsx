import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProjectEditSheet } from "@/src/components/projects/project-edit-sheet";
import { TaskCard } from "@/src/components/tasks/task-card";
import { TaskCreateSheet } from "@/src/components/tasks/task-create-sheet";
import { AvatarStack } from "@/src/components/ui/avatar";
import { SectionTitle } from "@/src/components/ui/card";
import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { ProgressBar } from "@/src/components/ui/progress";
import { Screen, ScreenHeader } from "@/src/components/ui/screen";
import { EmptyState } from "@/src/components/ui/states";
import { useToast } from "@/src/components/ui/toast";
import { Txt } from "@/src/components/ui/txt";
import { useActions, useProjects, useTasks } from "@/src/data/hooks";
import { useT } from "@/src/i18n/i18n-provider";
import { relativeDay } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { alpha, radius, spacing } from "@/src/theme/tokens";

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const { c, shadow } = useTheme();

  const projects = useProjects();
  const tasks = useTasks();
  const { toggleTaskStatus } = useActions();

  const [editing, setEditing] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  const project = projects.data.find((p) => p.id === id) ?? null;
  const projectTasks = useMemo(() => tasks.data.filter((t) => t.projectId === id), [id, tasks.data]);

  if (!project) {
    return (
      <Screen testID="project-missing">
        <ScreenHeader onBack={() => router.back()} title={t("project.one")} />
        <View style={{ padding: spacing.xl, alignItems: "center", gap: spacing.md }}>
          <Icons.grid size={30} color={c.mutedForeground} variant="Bulk" />
          <Txt variant="bodyStrong">{t("project.notFound")}</Txt>
        </View>
      </Screen>
    );
  }

  const pct = project.total > 0 ? Math.round((project.done / project.total) * 100) : 0;

  return (
    <Screen testID="project-screen">
      <ScreenHeader
        onBack={() => router.back()}
        title={project.name}
        subtitle={project.client}
        right={
          <Press testID="project-edit-btn" onPress={() => setEditing(true)} hitSlop={8}>
            <Icons.edit size={22} color={c.foreground} variant="Linear" />
          </Press>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.xl,
        }}
      >
        <Animated.View entering={FadeInDown.duration(380)}>
          <View
            testID="project-hero"
            style={[
              { backgroundColor: c.ink, borderRadius: radius.xxl, padding: spacing.xl, gap: spacing.lg },
              shadow(2),
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Txt variant="overline" color={alpha(c.onInk, 0.6)}>
                {t("project.progress")}
              </Txt>
              <Txt variant="title" color={c.onInk}>
                {pct}%
              </Txt>
            </View>
            <ProgressBar value={pct} tone={project.tone} track={alpha(c.onInk, 0.16)} height={8} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AvatarStack people={project.members} size={24} />
              <Txt variant="caption" color={alpha(c.onInk, 0.65)}>
                {t("project.tasksCount", { done: project.done, total: project.total })} ·{" "}
                {project.dueDate ? relativeDay(project.dueDate) : t("project.noDeadline")}
              </Txt>
            </View>
          </View>
        </Animated.View>

        <View style={{ gap: spacing.md }}>
          <SectionTitle title={t("tasks.title")} />
          {projectTasks.length === 0 ? (
            <EmptyState
              testID="project-tasks-empty"
              icon={<Icons.tasks size={24} color={project.tone} variant="Bulk" />}
              title={t("project.noTasks")}
              description={t("project.noTasksBody")}
            />
          ) : (
            projectTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={async (item) => {
                  const ok = await toggleTaskStatus(item.id, item.isDone ? "todo" : "done");
                  if (!ok) toast(t("tasks.signInUpdate"), "info");
                }}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Press
        testID="project-add-task-btn"
        onPress={() => setAddingTask(true)}
        haptic="medium"
        style={{
          position: "absolute",
          right: spacing.lg,
          bottom: insets.bottom + spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          height: 48,
          paddingHorizontal: spacing.lg,
          borderRadius: 999,
          backgroundColor: c.ink,
        }}
      >
        <Icons.add size={20} color={c.onInk} variant="Bulk" />
        <Txt variant="bodyStrong" color={c.onInk}>
          {t("tasks.new")}
        </Txt>
      </Press>
      <ProjectEditSheet
        visible={editing}
        onClose={() => setEditing(false)}
        project={
          project
            ? { id: project.id, name: project.name, client: project.client, status: project.status, color: project.tone }
            : null
        }
      />
      <TaskCreateSheet
        visible={addingTask}
        onClose={() => setAddingTask(false)}
        presetProjectId={id}
      />
    </Screen>
  );
}
