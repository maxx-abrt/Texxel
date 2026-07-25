import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuickAddSheet } from "@/src/components/tasks/quick-add-sheet";
import { DayStrip, DayTimeline } from "@/src/components/tasks/schedule";
import { TaskCard } from "@/src/components/tasks/task-card";
import { FloatingAction, HeaderActions } from "@/src/components/ui/chrome";
import { Icons } from "@/src/components/ui/icons";
import { ChipRow, type ChipOption } from "@/src/components/ui/pill";
import { Press } from "@/src/components/ui/press";
import { Screen, ScreenHeader, TAB_BAR_HEIGHT } from "@/src/components/ui/screen";
import { SkeletonCard } from "@/src/components/ui/skeleton";
import { EmptyState } from "@/src/components/ui/states";
import { useToast } from "@/src/components/ui/toast";
import { Txt } from "@/src/components/ui/txt";
import { useActions, useEvents, useNotifications, useStatuses, useTasks } from "@/src/data/hooks";
import { useWorkspace } from "@/src/data/workspace-provider";
import { useT } from "@/src/i18n/i18n-provider";
import { isSameDay, startOfDay } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing } from "@/src/theme/tokens";
import type { VmTask } from "@/src/data/types";

type Mode = "list" | "schedule";

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const { c, accent, onAccent, tint } = useTheme();
  const { profile } = useWorkspace();

  const [mode, setMode] = useState<Mode>("list");
  const [filter, setFilter] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [compact, setCompact] = useState(true);
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const [quickAdd, setQuickAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const tasks = useTasks();
  const statuses = useStatuses();
  const events = useEvents(day);
  const notifications = useNotifications();
  const { toggleTaskStatus } = useActions();

  const unread = notifications.data.filter((n) => !n.read).length;

  const isMine = useCallback(
    (task: VmTask) => {
      const who = task.assignee?.name?.trim().toLowerCase();
      if (!who) return false;
      return who === profile.name?.trim().toLowerCase() || who === profile.email?.trim().toLowerCase();
    },
    [profile.email, profile.name],
  );

  const scope = useMemo(
    () => (onlyMine ? tasks.data.filter(isMine) : tasks.data),
    [isMine, onlyMine, tasks.data],
  );

  const chips = useMemo<ChipOption[]>(() => {
    const open = scope.filter((task) => !task.isDone).length;
    const today = scope.filter((task) => task.dueDate && isSameDay(task.dueDate, Date.now())).length;
    return [
      { id: "all", label: t("common.all"), count: scope.length },
      { id: "today", label: t("tasks.filterToday"), count: today },
      { id: "open", label: t("tasks.filterOpen"), count: open },
      ...statuses.data.map((status) => ({
        id: status.key,
        label: status.label,
        count: scope.filter((task) => task.status === status.key).length,
      })),
    ];
  }, [scope, statuses.data, t]);

  const visible = useMemo(() => {
    const filtered =
      filter === "all"
        ? scope
        : filter === "open"
          ? scope.filter((task) => !task.isDone)
          : filter === "today"
            ? scope.filter((task) => task.dueDate && isSameDay(task.dueDate, Date.now()))
            : scope.filter((task) => task.status === filter);
    return [...filtered].sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
    });
  }, [filter, scope]);

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

  const toggleStyle = (active: boolean) => ({
    width: 40,
    height: 38,
    borderRadius: radius.lg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: active ? tint(accent, 0.4) : c.border,
    backgroundColor: active ? tint(accent, 0.14) : c.card,
  });

  return (
    <Screen testID="tasks-screen">
      <ScreenHeader
        title={t("tasks.title")}
        subtitle={onlyMine ? t("tasks.showingMine") : t("tasks.shown", { count: visible.length })}
        right={<HeaderActions unread={unread} />}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              backgroundColor: c.muted,
              borderRadius: radius.pill,
              padding: 4,
              gap: 4,
            }}
          >
            {(["list", "schedule"] as Mode[]).map((value) => {
              const active = value === mode;
              return (
                <Press
                  key={value}
                  testID={`tasks-mode-${value}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setMode(value)}
                  scaleTo={0.97}
                  style={{
                    flex: 1,
                    height: 34,
                    borderRadius: radius.pill,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    backgroundColor: active ? accent : "transparent",
                  }}
                >
                  {value === "list" ? (
                    <Icons.tasks size={16} color={active ? onAccent : c.mutedForeground} variant="Bulk" />
                  ) : (
                    <Icons.calendar size={16} color={active ? onAccent : c.mutedForeground} variant="Bulk" />
                  )}
                  <Txt variant="label" color={active ? onAccent : c.mutedForeground}>
                    {value === "list" ? t("tasks.list") : t("tasks.schedule")}
                  </Txt>
                </Press>
              );
            })}
          </View>

          {mode === "list" ? (
            <>
              <Press
                testID="tasks-only-mine"
                accessibilityRole="switch"
                accessibilityLabel={t("tasks.onlyMine")}
                accessibilityState={{ checked: onlyMine }}
                haptic="light"
                onPress={() => setOnlyMine((value) => !value)}
                style={toggleStyle(onlyMine)}
              >
                <Icons.user size={17} color={onlyMine ? accent : c.mutedForeground} variant="Bulk" />
              </Press>
              <Press
                testID="tasks-density-toggle"
                accessibilityRole="switch"
                accessibilityLabel={compact ? t("tasks.comfortableView") : t("tasks.compactView")}
                accessibilityState={{ checked: compact }}
                haptic="light"
                onPress={() => setCompact((value) => !value)}
                style={toggleStyle(compact)}
              >
                {compact ? (
                  <Icons.list size={17} color={accent} variant="Bulk" />
                ) : (
                  <Icons.category size={17} color={c.mutedForeground} variant="Bulk" />
                )}
              </Press>
            </>
          ) : null}
        </View>

        {mode === "list" ? (
          <ChipRow options={chips} value={filter} onChange={setFilter} testIDPrefix="task-filter" />
        ) : (
          <DayStrip day={day} onChange={setDay} />
        )}
      </ScreenHeader>

      {mode === "list" ? (
        <ScrollView
          testID="tasks-list"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.mutedForeground} />}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 100,
            gap: compact ? spacing.sm : spacing.md,
          }}
        >
          {tasks.loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : visible.length === 0 ? (
            <EmptyState
              testID="tasks-empty"
              icon={<Icons.tickCircle size={24} color={accent} variant="Bulk" />}
              title={t("tasks.nothingHere")}
              description={t("tasks.nothingHereBody")}
              actionLabel={t("tasks.new")}
              onAction={() => setQuickAdd(true)}
            />
          ) : (
            visible.map((task, index) => (
              <Animated.View key={task.id} entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(300)}>
                <TaskCard task={task} compact={compact} onToggle={(item) => onToggle(item.id, item.isDone)} />
              </Animated.View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          testID="tasks-schedule"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 100,
          }}
        >
          <Animated.View entering={FadeIn.duration(260)}>
            <DayTimeline day={day} events={events.data} onCreate={() => setQuickAdd(true)} />
          </Animated.View>
        </ScrollView>
      )}

      <FloatingAction testID="tasks-new-fab" label={t("tasks.new")} onPress={() => setQuickAdd(true)} />
      <QuickAddSheet visible={quickAdd} onClose={() => setQuickAdd(false)} />
    </Screen>
  );
}
