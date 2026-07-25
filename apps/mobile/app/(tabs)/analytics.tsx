import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, SectionTitle } from "@/src/components/ui/card";
import { HeaderActions } from "@/src/components/ui/chrome";
import { Icons } from "@/src/components/ui/icons";
import { ProgressBar } from "@/src/components/ui/progress";
import { Screen, ScreenHeader, TAB_BAR_HEIGHT } from "@/src/components/ui/screen";
import { Txt } from "@/src/components/ui/txt";
import { useHeatmap, useNotifications, useProjects, useStatuses, useTasks } from "@/src/data/hooks";
import { useWorkspace } from "@/src/data/workspace-provider";
import { useT } from "@/src/i18n/i18n-provider";
import type { TranslationKey } from "@/src/i18n/translations";
import { useTheme } from "@/src/theme/theme-provider";
import { mix, radius, spacing, tones } from "@/src/theme/tokens";

const WEEKS = 19;
const CELL = 12;
const GAP = 3;

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { c, accent, tint, shadow, isDark } = useTheme();
  const { workspace } = useWorkspace();

  const tasks = useTasks();
  const projects = useProjects();
  const statuses = useStatuses();
  const heatmap = useHeatmap();
  const notifications = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const unread = notifications.data.filter((n) => !n.read).length;

  const summary = useMemo(() => {
    const total = tasks.data.length;
    const done = tasks.data.filter((t) => t.isDone).length;
    return {
      total,
      done,
      rate: total > 0 ? Math.round((done / total) * 100) : 0,
      activeProjects: projects.data.filter((p) => p.status === "active").length,
    };
  }, [projects.data, tasks.data]);

  const distribution = useMemo(
    () =>
      statuses.data.map((status) => ({
        ...status,
        count: tasks.data.filter((t) => t.status === status.key).length,
      })),
    [statuses.data, tasks.data],
  );

  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const columns: { date: string; value: number }[][] = [];
    for (let w = WEEKS - 1; w >= 0; w -= 1) {
      const column: { date: string; value: number }[] = [];
      for (let d = 0; d < 7; d += 1) {
        const offset = w * 7 + (6 - d);
        const date = new Date(today.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
        column.push({ date, value: heatmap.data.counts[date] ?? 0 });
      }
      columns.push(column);
    }
    return columns;
  }, [heatmap.data.counts]);

  const maxValue = useMemo(
    () => Math.max(1, ...Object.values(heatmap.data.counts)),
    [heatmap.data.counts],
  );

  return (
    <Screen testID="analytics-screen">
      <ScreenHeader
        title={t("insights.title")}
        subtitle={workspace?.name ?? t("common.workspace")}
        right={<HeaderActions unread={unread} />}
      />

      <ScrollView
        testID="analytics-scroll"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 700);
            }}
            tintColor={c.mutedForeground}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 60,
          gap: spacing.xl,
        }}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={{ flexDirection: "row", gap: spacing.md }}>
          <StatTile labelKey="insights.completion" value={`${summary.rate}%`} tone={accent} icon="tickCircle" />
          <StatTile labelKey="insights.tasksDone" value={String(summary.done)} tone={tones.mint} icon="tasks" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ flexDirection: "row", gap: spacing.md }}>
          <StatTile labelKey="insights.activeProjects" value={String(summary.activeProjects)} tone={tones.ocean} icon="grid" />
          <StatTile labelKey="insights.activity" value={String(heatmap.data.total)} tone={tones.violet} icon="activity" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ gap: spacing.md }}>
          <SectionTitle title={t("insights.momentum")} />
          <Card testID="heatmap-card">
            <Txt variant="caption" muted>
              {t("insights.momentumBody", { count: WEEKS })}
            </Txt>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: GAP, paddingVertical: spacing.md }}
            >
              {grid.map((column, i) => (
                <View key={i} style={{ gap: GAP }}>
                  {column.map((cell) => {
                    const intensity = cell.value / maxValue;
                    return (
                      <View
                        key={cell.date}
                        style={{
                          width: CELL,
                          height: CELL,
                          borderRadius: 3,
                          backgroundColor:
                            cell.value === 0
                              ? isDark
                                ? c.muted
                                : c.secondary
                              : mix(accent, c.card, 0.25 + intensity * 0.75),
                        }}
                      />
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Txt variant="caption" muted>
                {t("insights.less")}
              </Txt>
              {[0.15, 0.4, 0.65, 1].map((step) => (
                <View
                  key={step}
                  style={{ width: 10, height: 10, borderRadius: 2.5, backgroundColor: mix(accent, c.card, step) }}
                />
              ))}
              <Txt variant="caption" muted>
                {t("insights.more")}
              </Txt>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={{ gap: spacing.md }}>
          <SectionTitle title={t("insights.whereWork")} />
          <Card testID="distribution-card">
            <View style={{ gap: spacing.lg }}>
              {distribution.map((status) => {
                const pct = summary.total > 0 ? Math.round((status.count / summary.total) * 100) : 0;
                return (
                  <View key={status.key} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.color }} />
                      <Txt variant="label" style={{ flex: 1 }}>
                        {status.label}
                      </Txt>
                      <Txt variant="caption" muted>
                        {status.count} · {pct}%
                      </Txt>
                    </View>
                    <ProgressBar value={pct} tone={status.color} track={tint(status.color, 0.1)} />
                  </View>
                );
              })}
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={{ gap: spacing.md }}>
          <SectionTitle title={t("insights.projectProgress")} />
          <View style={{ gap: spacing.md }}>
            {projects.data.map((project) => {
              const pct = project.total > 0 ? Math.round((project.done / project.total) * 100) : 0;
              return (
                <View
                  key={project.id}
                  testID={`analytics-project-${project.id}`}
                  style={[
                    {
                      backgroundColor: c.card,
                      borderRadius: radius.xl,
                      borderWidth: 1,
                      borderColor: c.border,
                      padding: spacing.lg,
                      gap: spacing.md,
                    },
                    shadow(1),
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: radius.md,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: tint(project.tone),
                      }}
                    >
                      <Icons.grid size={17} color={project.tone} variant="Bulk" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong" numberOfLines={1}>
                        {project.name}
                      </Txt>
                      <Txt variant="caption" muted numberOfLines={1}>
                        {project.client}
                      </Txt>
                    </View>
                    <Txt variant="label" color={project.tone}>
                      {pct}%
                    </Txt>
                  </View>
                  <ProgressBar value={pct} tone={project.tone} />
                </View>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function StatTile({
  labelKey,
  value,
  tone,
  icon,
}: {
  labelKey: TranslationKey;
  value: string;
  tone: string;
  icon: "tickCircle" | "tasks" | "grid" | "activity";
}) {
  const t = useT();
  const { c, tint, shadow } = useTheme();
  const Icon = Icons[icon];
  const label = t(labelKey);
  return (
    <View
      testID={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
      style={[
        {
          flex: 1,
          backgroundColor: c.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: c.border,
          padding: spacing.lg,
          gap: spacing.sm,
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
          backgroundColor: tint(tone),
        }}
      >
        <Icon size={17} color={tone} variant="Bulk" />
      </View>
      <Txt variant="display" style={{ fontSize: 26, lineHeight: 30 }}>
        {value}
      </Txt>
      <Txt variant="caption" muted>
        {label}
      </Txt>
    </View>
  );
}
