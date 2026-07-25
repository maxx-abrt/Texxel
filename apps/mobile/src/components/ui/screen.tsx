import type { ReactNode } from "react";
import { ImageBackground, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/src/i18n/i18n-provider";
import { radius, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";
import { Icons } from "./icons";
import { Press } from "./press";
import { Txt } from "./txt";

/** Height of the floating tab bar; screens pad their scroll content by this. */
export const TAB_BAR_HEIGHT = 62;

const grainSource = require("../../../assets/images/grain.png");

/**
 * Paper grain.
 * A 128px noise tile repeated at very low opacity — the tactile texture that
 * makes the warm palette read as paper rather than flat colour.
 * `ImageBackground` is used because it is the only RN image primitive that
 * supports `resizeMode="repeat"`.
 */
export function Grain({ opacity = 0.5 }: { opacity?: number }) {
  // `resizeMode="repeat"` is a native-only capability; on web the single tile
  // would read as a stray square, so the texture is simply omitted there.
  if (Platform.OS === "web") return null;
  return (
    <ImageBackground
      source={grainSource}
      resizeMode="repeat"
      style={[StyleSheet.absoluteFillObject, { opacity, pointerEvents: "none" }]}
    />
  );
}

export function Screen({
  children,
  style,
  grain = true,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  grain?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={[{ flex: 1, backgroundColor: c.background }, style]}>
      {grain ? <Grain /> : null}
      {children}
    </View>
  );
}

/**
 * Sticky screen header. Rendered as a sibling *above* the scroll view so it
 * never scrolls away, and padded for the notch.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  left,
  right,
  children,
  bordered = true,
  testID,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  bordered?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { c } = useTheme();

  return (
    <View
      testID={testID}
      style={{
        paddingTop: insets.top + spacing.sm,
        backgroundColor: c.background,
        borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: c.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          minHeight: 44,
        }}
      >
        {onBack ? (
          <Press
            testID="header-back-button"
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={onBack}
            style={circleButton(c.card, c.border)}
          >
            <Icons.back size={20} color={c.foreground} variant="Bulk" />
          </Press>
        ) : null}
        {left}
        <View style={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <Txt variant="bodyStrong" numberOfLines={1}>
              {title}
            </Txt>
          ) : null}
          {subtitle ? (
            <Txt variant="caption" muted numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function circleButton(background: string, border: string, size = 40): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: background,
    borderWidth: 1,
    borderColor: border,
  };
}
