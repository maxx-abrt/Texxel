import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons, type IconName } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { TAB_BAR_HEIGHT } from "@/src/components/ui/screen";
import { Txt } from "@/src/components/ui/txt";
import { useT } from "@/src/i18n/i18n-provider";
import type { TranslationKey } from "@/src/i18n/translations";
import { useTheme } from "@/src/theme/theme-provider";
import { alpha, radius, spacing } from "@/src/theme/tokens";

const TABS: { name: string; label: TranslationKey; icon: IconName }[] = [
  { name: "index", label: "tabs.home", icon: "home" },
  { name: "tasks", label: "tabs.tasks", icon: "tasks" },
  { name: "docs", label: "tabs.docs", icon: "note" },
  { name: "analytics", label: "tabs.insights", icon: "analytics" },
  { name: "profile", label: "tabs.you", icon: "user" },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      tabBar={(props) => <LiquidTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

/**
 * Liquid-glass tab bar.
 *
 * A single frosted slab (real blur on iOS and Android via `dimezisBlurView`)
 * with a specular sheen on top, and an accent "droplet" that springs between
 * destinations. Icons lift and labels brighten as the droplet reaches them, so
 * the whole bar reads as one piece of glass rather than five buttons.
 */
function LiquidTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { c, accent, isDark, shadow, animate } = useTheme();
  const [barWidth, setBarWidth] = useState(0);

  const progress = useSharedValue(state.index);
  const inset = 5;
  const slot = barWidth > 0 ? (barWidth - inset * 2) / TABS.length : 0;

  useEffect(() => {
    progress.value = animate
      ? withSpring(state.index, { damping: 16, stiffness: 170, mass: 0.75 })
      : withTiming(state.index, { duration: 0 });
  }, [animate, progress, state.index]);

  const dropletStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - Math.round(progress.value));
    return {
      width: slot,
      transform: [
        { translateX: progress.value * slot },
        // Slight stretch while travelling — the "liquid" part.
        { scaleX: 1 + distance * 0.24 },
        { scaleY: 1 - distance * 0.06 },
      ],
    };
  });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: spacing.lg,
        right: spacing.lg,
        bottom: Math.max(insets.bottom, spacing.md),
      }}
    >
      <View style={[{ borderRadius: radius.pill, overflow: "hidden" }, shadow(3)]}>
        <BlurView
          intensity={isDark ? 55 : 70}
          tint={isDark ? "dark" : "light"}
          experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
          style={{ backgroundColor: alpha(c.card, isDark ? 0.42 : 0.5) }}
        >
          {/* Specular highlight: bright at the top edge, gone by the middle. */}
          <LinearGradient
            pointerEvents="none"
            colors={[
              alpha("#ffffff", isDark ? 0.16 : 0.75),
              alpha("#ffffff", isDark ? 0.05 : 0.18),
              "rgba(255,255,255,0)",
            ]}
            locations={[0, 0.35, 1]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, height: TAB_BAR_HEIGHT }}
          />

          <View
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              height: TAB_BAR_HEIGHT,
              paddingHorizontal: inset,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: alpha("#ffffff", isDark ? 0.12 : 0.6),
            }}
          >
            {slot > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    left: inset,
                    top: 6,
                    bottom: 6,
                    borderRadius: radius.pill,
                    backgroundColor: alpha(accent, isDark ? 0.3 : 0.17),
                    borderWidth: 1,
                    borderColor: alpha(accent, isDark ? 0.42 : 0.26),
                    overflow: "hidden",
                  },
                  dropletStyle,
                ]}
              >
                <LinearGradient
                  colors={[alpha("#ffffff", isDark ? 0.18 : 0.5), "rgba(255,255,255,0)"]}
                  style={{ position: "absolute", left: 0, right: 0, top: 0, height: 18 }}
                />
              </Animated.View>
            ) : null}

            {state.routes.map((route, index) => {
              const tab = TABS.find((item) => item.name === route.name);
              if (!tab) return null;
              const focused = state.index === index;

              return (
                <TabItem
                  key={route.key}
                  index={index}
                  progress={progress}
                  focused={focused}
                  icon={tab.icon}
                  label={t(tab.label)}
                  testID={`tab-${tab.name === "index" ? "home" : tab.name}`}
                  onPress={() => {
                    if (focused) return;
                    navigation.navigate(route.name);
                  }}
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

function TabItem({
  index,
  progress,
  focused,
  icon,
  label,
  testID,
  onPress,
}: {
  index: number;
  progress: SharedValue<number>;
  focused: boolean;
  icon: IconName;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const { c, accent } = useTheme();
  const Icon = Icons[icon];

  const contentStyle = useAnimatedStyle(() => {
    const nearness = Math.max(0, 1 - Math.abs(progress.value - index));
    return {
      transform: [{ translateY: interpolate(nearness, [0, 1], [0, -2]) }, { scale: 1 + nearness * 0.07 }],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const nearness = Math.max(0, 1 - Math.abs(progress.value - index));
    return { opacity: interpolate(nearness, [0, 1], [0.62, 1]) };
  });

  return (
    <Press
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      haptic={focused ? "none" : "light"}
      scaleTo={0.94}
      onPress={onPress}
      style={{ flex: 1, height: TAB_BAR_HEIGHT - 12, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={[{ alignItems: "center", gap: 2 }, contentStyle]}>
        <Icon size={21} color={focused ? accent : c.mutedForeground} variant={focused ? "Bold" : "Bulk"} />
        <Animated.View style={labelStyle}>
          <Txt
            variant="caption"
            numberOfLines={1}
            color={focused ? accent : c.mutedForeground}
            style={{ fontSize: 10, lineHeight: 13 }}
          >
            {label}
          </Txt>
        </Animated.View>
      </Animated.View>
    </Press>
  );
}
