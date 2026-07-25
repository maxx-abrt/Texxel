import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/src/components/ui/avatar";
import { Card, SectionTitle } from "@/src/components/ui/card";
import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Screen, ScreenHeader } from "@/src/components/ui/screen";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useToast } from "@/src/components/ui/toast";
import { Txt } from "@/src/components/ui/txt";
import { useActions, useStatuses, useTask } from "@/src/data/hooks";
import { useT } from "@/src/i18n/i18n-provider";
import type { TranslationKey } from "@/src/i18n/translations";
import { formatDay, relativeDay, timeAgo } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing, tones } from "@/src/theme/tokens";

const PRIORITY_LABEL: Record<string, { label: TranslationKey; tone: string }> = {
  urgent: { label: "priority.urgent", tone: tones.red },
  high: { label: "priority.high", tone: tones.coral },
  medium: { label: "priority.medium", tone: tones.amber },
  low: { label: "priority.low", tone: tones.ocean },
  none: { label: "priority.none", tone: tones.ocean },
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const { c, tint, shadow } = useTheme();

  const task = useTask(id);
  const statuses = useStatuses();
  const { toggleTaskStatus } = useActions();

  if (task.loading) {
    return (
      <Screen testID="task-loading">
        <ScreenHeader onBack={() => router.back()} title={t("tasks.one")} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="80%" height={26} />
          <Skeleton width="50%" height={14} />
          <Skeleton height={90} />
        </View>
      </Screen>
    );
  }

  if (!task.data) {
    return (
      <Screen testID="task-missing">
        <ScreenHeader onBack={() => router.back()} title={t("tasks.one")} />
        <View style={{ padding: spacing.xl, alignItems: "center", gap: spacing.md }}>
          <Icons.tasks size={30} color={c.mutedForeground} variant="Bulk" />
          <Txt variant="bodyStrong">{t("tasks.notFound")}</Txt>
        </View>
      </Screen>
    );
  }

  const detail = task.data;
  const priority = PRIORITY_LABEL[detail.priority];

  return (
    <Screen testID="task-detail-screen">
      <ScreenHeader onBack={() => router.back()} title={detail.projectName ?? t("tasks.one")} subtitle={timeAgo(detail.updatedAt)} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.xl,
        }}
      >
        <Animated.View entering={FadeInDown.duration(380)} style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: radius.pill,
                backgroundColor: tint(detail.statusColor, 0.16),
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: detail.statusColor }} />
              <Txt variant="caption" color={detail.statusColor}>
                {detail.statusLabel}
              </Txt>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: radius.pill,
                backgroundColor: tint(priority.tone, 0.14),
              }}
            >
              <Icons.flag size={13} color={priority.tone} variant="Bulk" />
              <Txt variant="caption" color={priority.tone}>
                {t(priority.label)}
              </Txt>
            </View>
          </View>

          <Txt variant="display" style={{ fontSize: 26, lineHeight: 32 }}>
            {detail.title}
          </Txt>

          {detail.description ? (
            <Txt variant="body" muted>
              {detail.description}
            </Txt>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(380)} style={{ gap: spacing.md }}>
          <SectionTitle title={t("tasks.status")} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {statuses.data.map((status) => {
              const active = status.key === detail.status;
              return (
                <Press
                  key={status.key}
                  testID={`task-status-${status.key}`}
                  accessibilityState={{ selected: active }}
                  haptic="medium"
                  onPress={async () => {
                    const ok = await toggleTaskStatus(detail.id, status.key);
                    if (!ok) toast(t("tasks.signInUpdate"), "info");
                  }}
                  style={{
                    height: 40,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: active ? status.color : c.border,
                    backgroundColor: active ? tint(status.color, 0.16) : c.card,
                  }}
                >
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: status.color }} />
                  <Txt variant="label" color={active ? status.color : c.mutedForeground}>
                    {status.label}
                  </Txt>
                </Press>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(380)} style={{ gap: spacing.md }}>
          <SectionTitle title={t("tasks.details")} />
          <Card padded={false} style={shadow(1)}>
            <DetailRow
              icon="calendar"
              label={t("tasks.due")}
              value={detail.dueDate ? `${relativeDay(detail.dueDate)} · ${formatDay(detail.dueDate)}` : t("common.noDate")}
            />
            <DetailRow icon="grid" label={t("tasks.project")} value={detail.projectName ?? t("tasks.noProject")} bordered />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.lg,
                borderTopWidth: 1,
                borderTopColor: c.border,
              }}
            >
              <Icons.user size={18} color={c.mutedForeground} variant="Bulk" />
              <Txt variant="body" muted style={{ flex: 1 }}>
                {t("tasks.assignee")}
              </Txt>
              {detail.assignee ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Avatar name={detail.assignee.name} image={detail.assignee.image} size={24} />
                  <Txt variant="label">{detail.assignee.name ?? t("common.member")}</Txt>
                </View>
              ) : (
                <Txt variant="label" muted>
                  {t("tasks.unassigned")}
                </Txt>
              )}
            </View>
          </Card>
        </Animated.View>

        {detail.labels.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(180).duration(380)} style={{ gap: spacing.md }}>
            <SectionTitle title={t("tasks.labels")} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {detail.labels.map((label) => (
                <View
                  key={label}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: radius.pill,
                    backgroundColor: c.muted,
                  }}
                >
                  <Txt variant="caption" muted>
                    {label}
                  </Txt>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <Press
          testID="task-complete-button"
          haptic="success"
          onPress={async () => {
            const ok = await toggleTaskStatus(detail.id, detail.isDone ? "todo" : "done");
            if (!ok) toast(t("tasks.signInUpdate"), "info");
            else toast(detail.isDone ? t("tasks.reopened") : t("tasks.completed"), "success");
          }}
          style={{
            height: 52,
            borderRadius: radius.pill,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            backgroundColor: detail.isDone ? c.muted : c.ink,
          }}
        >
          <Icons.tickCircle size={19} color={detail.isDone ? c.mutedForeground : c.onInk} variant="Bulk" />
          <Txt variant="bodyStrong" color={detail.isDone ? c.mutedForeground : c.onInk}>
            {detail.isDone ? t("tasks.reopen") : t("tasks.markDone")}
          </Txt>
        </Press>
      </ScrollView>
    </Screen>
  );
}

function DetailRow({
  icon,
  label,
  value,
  bordered,
}: {
  icon: "calendar" | "grid";
  label: string;
  value: string;
  bordered?: boolean;
}) {
  const { c } = useTheme();
  const Icon = Icons[icon];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: bordered ? 1 : 0,
        borderTopColor: c.border,
      }}
    >
      <Icon size={18} color={c.mutedForeground} variant="Bulk" />
      <Txt variant="body" muted style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant="label" numberOfLines={1} style={{ maxWidth: 190 }}>
        {value}
      </Txt>
    </View>
  );
}
