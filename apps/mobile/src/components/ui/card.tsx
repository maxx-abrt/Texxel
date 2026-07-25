import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { radius, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";
import { Txt } from "./txt";

export function Card({
  children,
  style,
  padded = true,
  elevation = 1,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevation?: 0 | 1 | 2;
  testID?: string;
}) {
  const { c, shadow } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: c.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: c.border,
        },
        padded ? { padding: spacing.lg } : null,
        elevation > 0 ? shadow(elevation as 1 | 2) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  style,
}: {
  title: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: spacing.md,
          paddingHorizontal: spacing.xs,
        },
        style,
      ]}
    >
      <Txt variant="section">{title}</Txt>
      {action}
    </View>
  );
}

export function IconTile({
  children,
  tone,
  size = 40,
  solid = false,
  style,
}: {
  children: ReactNode;
  tone: string;
  size?: number;
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { tint } = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.36,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: solid ? tone : tint(tone),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
