import { useMemo } from "react";
import { ScrollView, View } from "react-native";

import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Txt } from "@/src/components/ui/txt";
import type { VmEvent } from "@/src/data/types";
import { formatTime, hourLabel, startOfDay, weekdayShort } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { alpha, radius, spacing } from "@/src/theme/tokens";

const HOUR_HEIGHT = 68;
const START_HOUR = 7;
const END_HOUR = 22;
const GUTTER = 62;

/** Horizontal day selector — 14 days from three days ago. */
export function DayStrip({
  day,
  onChange,
}: {
  day: number;
  onChange: (day: number) => void;
}) {
  const { c, accent, onAccent } = useTheme();
  const base = startOfDay(Date.now()) - 3 * 86_400_000;
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => base + i * 86_400_000), [base]);
  const selected = startOfDay(day);

  return (
    <View style={{ height: 82, justifyContent: "center" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
      >
        {days.map((value) => {
          const active = value === selected;
          const date = new Date(value);
          const isToday = value === startOfDay(Date.now());
          return (
            <Press
              key={value}
              testID={`day-${new Date(value).toISOString().slice(0, 10)}`}
              accessibilityState={{ selected: active }}
              onPress={() => onChange(value)}
              scaleTo={0.94}
              style={{
                width: 54,
                height: 66,
                flexShrink: 0,
                borderRadius: radius.lg,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                backgroundColor: active ? accent : c.card,
                borderWidth: 1,
                borderColor: active ? accent : c.border,
              }}
            >
              <Txt variant="caption" color={active ? alpha(onAccent, 0.8) : c.mutedForeground}>
                {weekdayShort(date.getTime())}
              </Txt>
              <Txt variant="section" color={active ? onAccent : c.foreground}>
                {date.getDate()}
              </Txt>
              {isToday ? (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: active ? onAccent : accent,
                  }}
                />
              ) : (
                <View style={{ height: 4 }} />
              )}
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Hour-grid timeline with dark event blocks, mirroring the web planner. */
export function DayTimeline({
  day,
  events,
  onCreate,
}: {
  day: number;
  events: VmEvent[];
  onCreate: () => void;
}) {
  const { c, shadow } = useTheme();
  const dayStart = startOfDay(day) + START_HOUR * 3_600_000;
  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i),
    [],
  );

  const positioned = events
    .map((event) => {
      const top = ((event.start - dayStart) / 3_600_000) * HOUR_HEIGHT;
      const height = Math.max(58, ((event.end - event.start) / 3_600_000) * HOUR_HEIGHT - 6);
      return { event, top, height, compact: height < 76 };
    })
    .filter((item) => item.top > -HOUR_HEIGHT && item.top < (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT);

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <View style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT + 24 }}>
        {hours.map((hour, index) => (
          <View
            key={hour}
            style={{
              position: "absolute",
              top: index * HOUR_HEIGHT,
              left: 0,
              right: 0,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <Txt variant="caption" muted style={{ width: GUTTER - spacing.md }}>
              {hourLabel(hour)}
            </Txt>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          </View>
        ))}

        {positioned.map(({ event, top, height, compact }) => (
          <View
            key={event.id}
            testID={`timeline-event-${event.id}`}
            style={[
              {
                position: "absolute",
                top: top + 4,
                left: GUTTER,
                right: 0,
                height,
                borderRadius: radius.lg,
                backgroundColor: c.ink,
                paddingVertical: compact ? spacing.sm : spacing.md,
                paddingHorizontal: spacing.md,
                paddingLeft: spacing.md + 6,
                overflow: "hidden",
                justifyContent: "center",
              },
              shadow(1),
            ]}
          >
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                backgroundColor: event.tone,
              }}
            />
            <Txt variant="caption" color={alpha(c.onInk, 0.65)}>
              {formatTime(event.start)}
            </Txt>
            <Txt variant="bodyStrong" color={c.onInk} numberOfLines={1}>
              {event.title}
            </Txt>
            {event.meta && !compact ? (
              <Txt variant="caption" color={alpha(c.onInk, 0.55)} numberOfLines={1}>
                {event.meta}
              </Txt>
            ) : null}
          </View>
        ))}
      </View>

      <Press
        testID="timeline-create-button"
        onPress={onCreate}
        style={{
          marginTop: spacing.md,
          marginLeft: GUTTER,
          height: 52,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: c.borderStrong,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
        }}
      >
        <Txt variant="label" muted>
          Create new task
        </Txt>
        <Icons.add size={18} color={c.mutedForeground} variant="Linear" />
      </Press>
    </View>
  );
}
