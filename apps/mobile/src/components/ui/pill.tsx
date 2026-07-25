import type { ReactNode } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";

import { radius, spacing, tones } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";
import { Press } from "./press";
import { Txt } from "./txt";

export function Badge({
  children,
  tone = tones.coral,
  style,
}: {
  children: ReactNode;
  tone?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { tint, toneText } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderRadius: radius.pill,
          paddingHorizontal: 10,
          paddingVertical: 4,
          backgroundColor: tint(tone, 0.16),
        },
        style,
      ]}
    >
      <Txt variant="caption" color={toneText(tone)} numberOfLines={1}>
        {children}
      </Txt>
    </View>
  );
}

export function Dot({ tone, size = 6 }: { tone: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size, backgroundColor: tone }} />;
}

export type ChipOption = { id: string; label: string; count?: number };

/**
 * Sticky filter row.
 * One horizontal scroller — chips never wrap, never resize when selected,
 * and keep their intrinsic width (`flexShrink: 0`).
 */
export function ChipRow({
  options,
  value,
  onChange,
  testIDPrefix = "chip",
}: {
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
  testIDPrefix?: string;
}) {
  const { c, accent, onAccent } = useTheme();

  return (
    <View style={{ height: 56, justifyContent: "center" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((option) => {
          const active = option.id === value;
          return (
            <Press
              key={option.id}
              testID={`${testIDPrefix}-${option.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.id)}
              scaleTo={0.94}
              style={{
                height: 36,
                flexShrink: 0,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: active ? accent : c.border,
                backgroundColor: active ? accent : c.card,
              }}
            >
              <Txt variant="label" color={active ? onAccent : c.mutedForeground}>
                {option.label}
              </Txt>
              {option.count !== undefined ? (
                <Txt variant="caption" color={active ? onAccent : c.mutedForeground}>
                  {option.count}
                </Txt>
              ) : null}
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}
