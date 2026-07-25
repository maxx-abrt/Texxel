import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
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

const SPRING_CONFIG = { damping: 16, stiffness: 170, mass: 0.75 };
const MAGNETIC_THRESHOLD = 0.15;
const CANCEL_Y_THRESHOLD = -80;

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
 * Liquid-glass tab bar with hybrid navigation.
 *
 * A single frosted slab (real blur on iOS and Android via `dimezisBlurView`)
 * with a specular sheen on top, and an accent "droplet" that springs between
 * destinations. Icons lift and labels brighten as the droplet reaches them, so
 * the whole bar reads as one piece of glass rather than five buttons.
 *
 * Two interaction modes coexist on the bar:
 * - Tap (Press): instant navigation + spring droplet to the tapped tab.
 * - Drag & release (Gesture.Pan): droplet follows finger with magnetic
 *   attraction near tab centers, haptic on each crossing, navigation only on
 *   release. Cancel if finger drags too far above the bar.
 */
function LiquidTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { c, accent, isDark, shadow, animate } = useTheme();
  const [barWidth, setBarWidth] = useState(0);

  const progress = useSharedValue(state.index);
  const isDragging = useSharedValue(false);
  const dragOrigin = useSharedValue(state.index);
  const lastCrossed = useSharedValue(state.index);
  const cancelled = useSharedValue(false);
  const animateSV = useSharedValue(animate);
  const currentIndexSV = useSharedValue(state.index);
  const isInternalNav = useSharedValue(false);

  const inset = 5;
  const slot = barWidth > 0 ? (barWidth - inset * 2) / TABS.length : 0;
  const tabCount = TABS.length;

  const navigate = (name: string) => navigation.navigate(name);

  useEffect(() => {
    animateSV.value = animate;
  }, [animate, animateSV]);

  useEffect(() => {
    currentIndexSV.value = state.index;
  }, [state.index, currentIndexSV]);

  useEffect(() => {
    // If the drag release already animated progress, skip the redundant spring.
    if (isInternalNav.value) {
      isInternalNav.value = false;
      return;
    }
    progress.value = animate
      ? withSpring(state.index, SPRING_CONFIG)
      : withTiming(state.index, { duration: 0 });
  }, [animate, progress, state.index, isInternalNav]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .enabled(slot > 0)
    .onBegin(() => {
      isDragging.value = true;
      dragOrigin.value = progress.value;
      lastCrossed.value = Math.round(progress.value);
      cancelled.value = false;
    })
    .onUpdate((e) => {
      if (slot === 0) return;

      // Cancel if finger drags too far above the bar.
      if (e.translationY < CANCEL_Y_THRESHOLD) {
        if (!cancelled.value) {
          cancelled.value = true;
          progress.value = animateSV.value
            ? withSpring(currentIndexSV.value, SPRING_CONFIG)
            : withTiming(currentIndexSV.value, { duration: 0 });
        }
        return;
      }

      if (cancelled.value) return;

      // Compute raw active index from finger translation.
      let activeIndex = dragOrigin.value + e.translationX / slot;
      activeIndex = Math.max(0, Math.min(tabCount - 1, activeIndex));

      // Magnetic attraction: pull toward nearest tab center when close.
      const nearestInt = Math.round(activeIndex);
      const distToInt = Math.abs(activeIndex - nearestInt);
      if (distToInt < MAGNETIC_THRESHOLD) {
        const pullStrength = (1 - distToInt / MAGNETIC_THRESHOLD) * 0.35;
        activeIndex = activeIndex + (nearestInt - activeIndex) * pullStrength;
      }

      progress.value = activeIndex;

      // Haptic on crossing a tab boundary.
      const crossed = Math.round(activeIndex);
      if (crossed !== lastCrossed.value && crossed >= 0 && crossed < tabCount) {
        lastCrossed.value = crossed;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    })
    .onEnd(() => {
      isDragging.value = false;

      if (cancelled.value) {
        progress.value = animateSV.value
          ? withSpring(currentIndexSV.value, SPRING_CONFIG)
          : withTiming(currentIndexSV.value, { duration: 0 });
        return;
      }

      const targetIndex = Math.max(0, Math.min(tabCount - 1, Math.round(progress.value)));
      progress.value = animateSV.value
        ? withSpring(targetIndex, SPRING_CONFIG)
        : withTiming(targetIndex, { duration: 0 });

      if (targetIndex !== currentIndexSV.value) {
        const route = TABS[targetIndex];
        if (route) {
          isInternalNav.value = true;
          runOnJS(navigate)(route.name);
        }
      }
    });

  const dropletStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - Math.round(progress.value));
    const stretch = isDragging.value ? distance * 0.16 : distance * 0.24;
    const squash = isDragging.value ? distance * 0.04 : distance * 0.06;
    return {
      width: slot,
      transform: [
        { translateX: progress.value * slot },
        { scaleX: 1 + stretch },
        { scaleY: 1 - squash },
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
          blurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
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

          <GestureDetector gesture={pan}>
            <Animated.View
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
            </Animated.View>
          </GestureDetector>
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
