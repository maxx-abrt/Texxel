import { useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { TAB_BAR_HEIGHT } from "@/src/components/ui/screen";
import { Txt } from "@/src/components/ui/txt";
import { useT } from "@/src/i18n/i18n-provider";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing } from "@/src/theme/tokens";

/**
 * Context action that floats just above the tab bar (16–24pt gap, per spec).
 */
export function FloatingAction({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const insets = useSafeAreaInsets();
  const { accent, onAccent, shadow } = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        right: spacing.lg,
        bottom: Math.max(insets.bottom, spacing.md) + TAB_BAR_HEIGHT + spacing.lg,
      }}
    >
      <Press
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        haptic="medium"
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            height: 48,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.pill,
            backgroundColor: accent,
          },
          shadow(3),
        ]}
      >
        <Icons.add size={20} color={onAccent} variant="Linear" />
        <Txt variant="label" color={onAccent}>
          {label}
        </Txt>
      </Press>
    </View>
  );
}

/** Header cluster shared by the tab screens: search + notifications. */
export function HeaderActions({ unread = 0 }: { unread?: number }) {
  const router = useRouter();
  const t = useT();
  const { c, accent } = useTheme();

  const circle = {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  };

  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <Press
        testID="header-search-button"
        accessibilityLabel={t("common.search")}
        onPress={() => router.push("/search")}
        style={circle}
      >
        <Icons.search size={19} color={c.foreground} variant="Bulk" />
      </Press>
      <Press
        testID="header-inbox-button"
        accessibilityLabel={t("profile.notifications")}
        onPress={() => router.push("/inbox")}
        style={circle}
      >
        <Icons.notification size={19} color={c.foreground} variant="Bulk" />
        {unread > 0 ? (
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 9,
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: accent,
              borderWidth: 1.5,
              borderColor: c.card,
            }}
          />
        ) : null}
      </Press>
    </View>
  );
}
