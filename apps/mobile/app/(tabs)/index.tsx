import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NewProjectCard, ProjectCard } from "@/src/components/home/project-card";
import { ProjectCreateSheet } from "@/src/components/projects/project-create-sheet";
import { QuickAddSheet } from "@/src/components/tasks/quick-add-sheet";
import { TaskCard } from "@/src/components/tasks/task-card";
import { Avatar } from "@/src/components/ui/avatar";
import { SectionTitle } from "@/src/components/ui/card";
import { FloatingAction, HeaderActions } from "@/src/components/ui/chrome";
import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { ProgressRing } from "@/src/components/ui/progress";
import { Screen, ScreenHeader, TAB_BAR_HEIGHT } from "@/src/components/ui/screen";
import { SkeletonCard } from "@/src/components/ui/skeleton";
import { EmptyState } from "@/src/components/ui/states";
import { useToast } from "@/src/components/ui/toast";
import { Txt } from "@/src/components/ui/txt";
import { useActions, useDocs, useEvents, useNotifications, useProjects, useTasks } from "@/src/data/hooks";
import { useWorkspace } from "@/src/data/workspace-provider";
import { useT } from "@/src/i18n/i18n-provider";
import { formatLongDate, formatTime, greeting, isSameDay } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { alpha, radius, spacing, tones } from "@/src/theme/tokens";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { c, accent, tint, shadow } = useTheme();
  const { profile, workspace } = useWorkspace();

  const tasks = useTasks();
  const projects = useProjects();
  const docs = useDocs();
  const events = useEvents(Date.now());
  const notifications = useNotifications();
  const { toggleTaskStatus } = useActions();

  const [quickAdd, setQuickAdd] = useState(false);
  const [projectCreate, setProjectCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const unread = notifications.data.filter((n) => !n.read).length;

  const stats = useMemo(() => {
    const all = tasks.data;
    const dueToday = all.filter((t) => t.dueDate && isSameDay(t.dueDate, Date.now()));
    const done = all.filter((t) => t.isDone);
    const active = all.filter((t) => !t.isDone);
    const completion = all.length > 0 ? Math.round((done.length / all.length) * 100) : 0;
    return { dueToday: dueToday.length, done: done.length, active: active.length, completion };
  }, [tasks.data]);

  const priority = useMemo(() => {
    const rank = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 } as const;
    return tasks.data
      .filter((t) => !t.isDone)
      .sort((a, b) => {
        const byPriority = rank[a.priority] - rank[b.priority];
        if (byPriority !== 0) return byPriority;
        return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
      })
      .slice(0, 3);
  }, [tasks.data]);

  const upcoming = useMemo(
    () => events.data.filter((e) => e.end >= Date.now()).slice(0, 3),
    [events.data],
  );

  const recentDocs = useMemo(
    () => docs.data.filter((d) => !d.isFolder).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5),
    [docs.data],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  const onToggle = useCallback(
    async (taskId: string, isDone: boolean) => {
      const ok = await toggleTaskStatus(taskId, isDone ? "todo" : "done");
      if (!ok) toast(t("tasks.signInUpdate"), "info");
    },
    [t, toast, toggleTaskStatus],
  );

  return (
    <Screen testID="home-screen">
      <ScreenHeader
        bordered={false}
        left={
          <Press testID="home-avatar-button" onPress={() => router.push("/(tabs)/profile")} hitSlop={8}>
            <Avatar name={profile.name ?? profile.email ?? "Bureau"} image={profile.image} size={42} />
          </Press>
        }
        right={<HeaderActions unread={unread} />}
      >
        <View style={{ position: "absolute", left: 70, top: insets.top + spacing.sm + 2 }}>
          <Txt variant="label">{greeting()}</Txt>
          <Txt variant="caption" muted numberOfLines={1}>
            {formatLongDate(Date.now())}
          </Txt>
        </View>
      </ScreenHeader>

      <ScrollView
        testID="home-scroll"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.mutedForeground} />}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 100,
          gap: spacing.xl,
        }}
      >
        <Animated.View entering={FadeInDown.duration(420)}>
          <Txt variant="display">{t("home.headline1")}</Txt>
          <Txt variant="display" color={c.mutedForeground}>
            {t("home.headline2")}
          </Txt>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(420)}>
          <View
            testID="focus-card"
            style={[
              {
                backgroundColor: c.ink,
                borderRadius: radius.xxl,
                padding: spacing.xl,
                gap: spacing.lg,
                overflow: "hidden",
              },
              shadow(2),
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xl }}>
              <ProgressRing
                value={stats.completion}
                size={78}
                stroke={7}
                tone={accent}
                track={alpha(c.onInk, 0.16)}
              >
                <Txt variant="title" color={c.onInk} style={{ fontSize: 19 }}>
                  {stats.completion}%
                </Txt>
              </ProgressRing>

              <View style={{ flex: 1, gap: 6 }}>
                <Txt variant="overline" color={alpha(c.onInk, 0.6)}>
                  {t("home.focus")}
                </Txt>
                <Txt variant="section" color={c.onInk}>
                  {stats.dueToday > 0 ? t("home.dueToday", { count: stats.dueToday }) : t("home.nothingDue")}
                </Txt>
                <Txt variant="caption" color={alpha(c.onInk, 0.6)}>
                  {workspace?.name ?? t("common.workspace")} · {t("home.openCount", { count: stats.active })}
                </Txt>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {[
                { label: t("home.statOpen"), value: stats.active, tone: tones.amber },
                { label: t("home.statDone"), value: stats.done, tone: tones.mint },
                { label: t("home.statProjects"), value: projects.data.length, tone: tones.ocean },
              ].map((item) => (
                <View
                  key={item.label}
                  style={{
                    flex: 1,
                    borderRadius: radius.lg,
                    backgroundColor: alpha(c.onInk, 0.08),
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                    gap: 2,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.tone }} />
                    <Txt variant="caption" color={alpha(c.onInk, 0.62)}>
                      {item.label}
                    </Txt>
                  </View>
                  <Txt variant="title" color={c.onInk} style={{ fontSize: 21 }}>
                    {item.value}
                  </Txt>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={{ gap: spacing.md }}>
          <SectionTitle
            title={t("common.projects")}
            action={
              <Press testID="home-see-projects" onPress={() => router.push("/(tabs)/analytics")} hitSlop={8}>
                <Txt variant="label" color={accent}>
                  {t("home.seeAll")}
                </Txt>
              </Press>
            }
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.xs, paddingVertical: 2 }}
          >
            {projects.loading
              ? [0, 1].map((i) => (
                  <View key={i} style={{ width: 210 }}>
                    <SkeletonCard lines={3} />
                  </View>
                ))
              : projects.data.map((project) => <ProjectCard key={project.id} project={project} />)}
            <NewProjectCard onPress={() => setProjectCreate(true)} />
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(420)} style={{ gap: spacing.md }}>
          <SectionTitle
            title={t("home.needsYou")}
            action={
              <Press testID="home-see-tasks" onPress={() => router.push("/(tabs)/tasks")} hitSlop={8}>
                <Txt variant="label" color={accent}>
                  {t("home.allTasks")}
                </Txt>
              </Press>
            }
          />
          {tasks.loading ? (
            <View style={{ gap: spacing.md }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : priority.length === 0 ? (
            <EmptyState
              testID="home-tasks-empty"
              icon={<Icons.tickCircle size={24} color={accent} variant="Bulk" />}
              title={t("home.inboxZero")}
              description={t("home.inboxZeroBody")}
              actionLabel={t("tasks.new")}
              onAction={() => setQuickAdd(true)}
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              {priority.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={(t) => onToggle(t.id, t.isDone)} />
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(420)} style={{ gap: spacing.md }}>
          <SectionTitle
            title={t("home.today")}
            action={
              <Press testID="home-see-schedule" onPress={() => router.push("/(tabs)/tasks")} hitSlop={8}>
                <Txt variant="label" color={accent}>
                  {t("home.schedule")}
                </Txt>
              </Press>
            }
          />
          {upcoming.length === 0 ? (
            <EmptyState
              testID="home-schedule-empty"
              icon={<Icons.calendar size={24} color={accent} variant="Bulk" />}
              title={t("home.clearCalendar")}
              description={t("home.clearCalendarBody")}
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {upcoming.map((event) => (
                <View
                  key={event.id}
                  testID={`home-event-${event.id}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    backgroundColor: c.card,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: spacing.md,
                  }}
                >
                  <View style={{ width: 4, height: 38, borderRadius: 2, backgroundColor: event.tone }} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {event.title}
                    </Txt>
                    {event.meta ? (
                      <Txt variant="caption" muted numberOfLines={1}>
                        {event.meta}
                      </Txt>
                    ) : null}
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: radius.pill,
                      backgroundColor: tint(event.tone, 0.14),
                    }}
                  >
                    <Txt variant="caption" color={event.tone}>
                      {formatTime(event.start)}
                    </Txt>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(420)} style={{ gap: spacing.md }}>
          <SectionTitle
            title={t("home.pickUp")}
            action={
              <Press testID="home-see-docs" onPress={() => router.push("/(tabs)/docs")} hitSlop={8}>
                <Txt variant="label" color={accent}>
                  {t("tabs.docs")}
                </Txt>
              </Press>
            }
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.xs, paddingVertical: 2 }}
          >
            {recentDocs.map((doc) => (
              <Press
                key={doc.id}
                testID={`home-doc-${doc.id}`}
                onPress={() => router.push(`/doc/${doc.id}`)}
                style={[
                  {
                    width: 176,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.card,
                    padding: spacing.lg,
                    gap: spacing.sm,
                    minHeight: 132,
                  },
                  shadow(1),
                ]}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.md,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: tint(doc.tone),
                  }}
                >
                  {doc.icon ? (
                    <Txt style={{ fontSize: 17 }}>{doc.icon}</Txt>
                  ) : (
                    <Icons.doc size={18} color={doc.tone} variant="Bulk" />
                  )}
                </View>
                <Txt variant="bodyStrong" numberOfLines={2}>
                  {doc.title}
                </Txt>
                <Txt variant="caption" muted numberOfLines={2} style={{ flex: 1 }}>
                  {doc.excerpt || t("common.emptyDocument")}
                </Txt>
              </Press>
            ))}
          </ScrollView>
        </Animated.View>
      </ScrollView>

      <FloatingAction testID="home-new-task-fab" label={t("tasks.new")} onPress={() => setQuickAdd(true)} />
      <QuickAddSheet visible={quickAdd} onClose={() => setQuickAdd(false)} />
      <ProjectCreateSheet visible={projectCreate} onClose={() => setProjectCreate(false)} />
    </Screen>
  );
}
