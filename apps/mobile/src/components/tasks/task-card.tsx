import { useRouter } from "expo-router";
import { View } from "react-native";

import { Avatar } from "@/src/components/ui/avatar";
import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Txt } from "@/src/components/ui/txt";
import { relativeDay } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing, tones } from "@/src/theme/tokens";
import type { VmTask } from "@/src/data/types";

const PRIORITY_TONE: Record<VmTask["priority"], string | null> = {
  urgent: tones.red,
  high: tones.coral,
  medium: tones.amber,
  low: tones.ocean,
  none: null,
};

export function TaskCard({
  task,
  onToggle,
  compact = false,
}: {
  task: VmTask;
  onToggle?: (task: VmTask) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const { c, shadow, tint } = useTheme();
  const priorityTone = PRIORITY_TONE[task.priority];

  const checkbox = onToggle ? (
    <Press
      testID={`task-toggle-${task.id}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.isDone }}
      hitSlop={10}
      haptic="success"
      onPress={() => onToggle(task)}
      style={{
        width: compact ? 22 : 24,
        height: compact ? 22 : 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: task.isDone ? 0 : 1.6,
        borderColor: c.borderStrong,
        backgroundColor: task.isDone ? tones.mint : "transparent",
      }}
    >
      {task.isDone ? <Icons.tickCircle size={compact ? 14 : 16} color="#ffffff" variant="Bold" /> : null}
    </Press>
  ) : null;

  /** Dense single-line row — the default in the Tasks tab. */
  if (compact) {
    return (
      <Press
        testID={`task-card-${task.id}`}
        accessibilityRole="button"
        onPress={() => router.push(`/task/${task.id}`)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: c.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.md,
        }}
      >
        {checkbox}
        <View style={{ width: 3, height: 26, borderRadius: 2, backgroundColor: task.statusColor }} />

        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt
            variant="bodyStrong"
            numberOfLines={1}
            style={task.isDone ? { textDecorationLine: "line-through", opacity: 0.55 } : null}
          >
            {task.title}
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Txt variant="caption" color={task.statusColor} numberOfLines={1}>
              {task.statusLabel}
            </Txt>
            {task.projectName ? (
              <>
                <Txt variant="caption" muted>
                  ·
                </Txt>
                <Txt variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
                  {task.projectName}
                </Txt>
              </>
            ) : null}
            {task.dueDate ? (
              <>
                <Txt variant="caption" muted>
                  ·
                </Txt>
                <Txt variant="caption" muted numberOfLines={1}>
                  {relativeDay(task.dueDate)}
                </Txt>
              </>
            ) : null}
          </View>
        </View>

        {priorityTone ? <Icons.flag size={14} color={priorityTone} variant="Bulk" /> : null}
        {task.assignee ? <Avatar name={task.assignee.name} image={task.assignee.image} size={22} /> : null}
      </Press>
    );
  }

  return (
    <Press
      testID={`task-card-${task.id}`}
      accessibilityRole="button"
      onPress={() => router.push(`/task/${task.id}`)}
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: tint(task.statusColor, 0.14),
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: task.statusColor }} />
          <Txt variant="caption" color={task.statusColor}>
            {task.statusLabel}
          </Txt>
        </View>

        {priorityTone ? <Icons.flag size={15} color={priorityTone} variant="Bulk" /> : null}

        <View style={{ flex: 1 }} />
        {task.assignee ? <Avatar name={task.assignee.name} image={task.assignee.image} size={24} /> : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        {checkbox}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt
            variant="bodyStrong"
            numberOfLines={2}
            style={task.isDone ? { textDecorationLine: "line-through", opacity: 0.55 } : null}
          >
            {task.title}
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
            {task.projectName ? (
              <Txt variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
                {task.projectName}
              </Txt>
            ) : null}
            {task.projectName && task.dueDate ? <Txt variant="caption" muted>·</Txt> : null}
            {task.dueDate ? (
              <Txt variant="caption" muted>
                {relativeDay(task.dueDate)}
              </Txt>
            ) : null}
          </View>
        </View>

        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.ink,
          }}
        >
          <Icons.chevronRight size={17} color={c.onInk} variant="Linear" />
        </View>
      </View>
    </Press>
  );
}
