import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
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

/** Settle spring: quick, barely-there overshoot. Used for taps and release. */
const SPRING_CONFIG = { damping: 18, stiffness: 190, mass: 0.7 };
/** Catch-up spring: how fast the pill slides under a finger that grabbed it off-center. */
const GRAB_SPRING = { damping: 20, stiffness: 260, mass: 0.6 };
/** Snap-back spring when the drag is cancelled. */
const CANCEL_SPRING = { damping: 15, stiffness: 150, mass: 0.8 };

/** How wide (in tab slots) the magnetic well around each tab center is. */
const MAGNET_RANGE = 0.34;
/** Max fraction of the distance-to-center the magnet can eat, at zero velocity. */
const MAGNET_STRENGTH = 0.55;
/** Above this |velocityX| (px/s) magnetism is fully off, so fast flicks never feel sticky. */
const MAGNET_VELOCITY_CUTOFF = 900;
/** Drag this far above the bar to cancel navigation. */
const CANCEL_Y_THRESHOLD = -80;
/** Velocity (px/s) that maps to the maximum liquid stretch. */
const VELOCITY_FOR_MAX_STRETCH = 2400;

const PILL_INSET_X = 4;
const PILL_INSET_Y = 6;

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
 * One frosted slab (real blur on iOS/Android via `dimezisBlurView`, backdrop-filter on web)
 * built from stacked glass layers — base tint, top-down refraction, specular top edge,
 * bright outer rim and a dark inner rim — so it reads as a single piece of glass rather
 * than five buttons. An accent droplet lives inside the glass and deforms as it travels:
 * it stretches along its direction of motion, squashes on the cross axis, skews with
 * velocity and rubber-bands at the ends.
 *
 * Two interactions coexist:
 * - Tap (`Press`): instant navigation, droplet springs across.
 * - Drag (`Gesture.Pan`): the droplet is pinned to the *absolute* finger position, so it
 *   sits exactly under the fingertip with no offset. If you grab it away from its center,
 *   a decaying catch-up offset slides it under your finger instead of snapping. Magnetic
 *   wells at each tab center are velocity-aware (disabled while flicking), a light haptic
 *   fires on every crossing, and navigation only commits on release. Dragging far above
 *   the bar cancels and springs back.
 *
 * All gesture math runs on the UI thread; JS is only touched for haptics and navigation.
 */
function LiquidTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { c, accent, isDark, shadow, animate } = useTheme();
  const [barWidth, setBarWidth] = useState(0);

  /** Droplet position in tab units (0 .. TABS.length - 1). Single source of truth. */
  const progress = useSharedValue(state.index);
  /** Signed horizontal velocity of the finger, decayed to 0 on release. */
  const velocity = useSharedValue(0);
  /** 0 -> 1 while a drag is active, animated so lift/glow fade in smoothly. */
  const dragLift = useSharedValue(0);
  /** Offset between where the finger grabbed and the droplet center; springs to 0. */
  const grabOffset = useSharedValue(0);

  const isDragging = useSharedValue(false);
  const lastCrossed = useSharedValue(state.index);
  const cancelled = useSharedValue(false);
  const animateSV = useSharedValue(animate);
  const currentIndexSV = useSharedValue(state.index);
  const isInternalNav = useSharedValue(false);

  const inset = 5;
  const tabCount = TABS.length;
  const slot = barWidth > 0 ? (barWidth - inset * 2) / tabCount : 0;
  const slotSV = useSharedValue(0);

  const navigate = (name: string) => navigation.navigate(name);
  const tapHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  useEffect(() => {
    slotSV.value = slot;
  }, [slot, slotSV]);

  useEffect(() => {
    animateSV.value = animate;
  }, [animate, animateSV]);

  useEffect(() => {
    currentIndexSV.value = state.index;
  }, [state.index, currentIndexSV]);

  useEffect(() => {
    // The drag release already animated `progress`; skip the redundant spring.
    if (isInternalNav.value) {
      isInternalNav.value = false;
      return;
    }
    progress.value = animate
      ? withSpring(state.index, SPRING_CONFIG)
      : withTiming(state.index, { duration: 0 });
  }, [animate, progress, state.index, isInternalNav]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Small activation window: enough to not steal taps, small enough to feel immediate.
        .activeOffsetX([-8, 8])
        .failOffsetY([-140, 140])
        .shouldCancelWhenOutside(false)
        .enabled(slot > 0)
        .onBegin((e) => {
          isDragging.value = true;
          cancelled.value = false;
          velocity.value = 0;
          lastCrossed.value = Math.round(progress.value);
          dragLift.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });

          // Where the finger is, in tab units, at the moment of grab.
          const fingerIndex = (e.x - inset) / slotSV.value - 0.5;
          // Remember the gap so the droplet can slide under the finger instead of jumping.
          grabOffset.value = progress.value - fingerIndex;
          grabOffset.value = withSpring(0, GRAB_SPRING);
        })
        .onUpdate((e) => {
          if (slotSV.value === 0) return;

          // Pulled far above the bar: abandon the drag and return home.
          if (e.translationY < CANCEL_Y_THRESHOLD) {
            if (!cancelled.value) {
              cancelled.value = true;
              velocity.value = withTiming(0, { duration: 220 });
              progress.value = animateSV.value
                ? withSpring(currentIndexSV.value, CANCEL_SPRING)
                : withTiming(currentIndexSV.value, { duration: 0 });
            }
            return;
          }
          if (cancelled.value) return;

          velocity.value = e.velocityX;

          // Absolute finger tracking: the droplet center is the fingertip, always.
          let index = (e.x - inset) / slotSV.value - 0.5 + grabOffset.value;

          // Velocity-aware magnetism: strong when settling, absent when flicking.
          const speed = Math.abs(e.velocityX);
          const magnet =
            MAGNET_STRENGTH * (1 - Math.min(1, speed / MAGNET_VELOCITY_CUTOFF));
          if (magnet > 0) {
            const nearest = Math.round(Math.max(0, Math.min(tabCount - 1, index)));
            const dist = index - nearest;
            if (Math.abs(dist) < MAGNET_RANGE) {
              const falloff = 1 - Math.abs(dist) / MAGNET_RANGE;
              index -= dist * magnet * falloff * falloff;
            }
          }

          // Rubber band past the ends instead of a hard stop.
          if (index < 0) {
            const over = -index;
            index = -(over / (1 + over * 2.4));
          } else if (index > tabCount - 1) {
            const over = index - (tabCount - 1);
            index = tabCount - 1 + over / (1 + over * 2.4);
          }

          progress.value = index;

          // Light haptic every time a tab boundary is crossed.
          const crossed = Math.round(Math.max(0, Math.min(tabCount - 1, index)));
          if (crossed !== lastCrossed.value) {
            lastCrossed.value = crossed;
            runOnJS(tapHaptic)();
          }
        })
        .onFinalize(() => {
          isDragging.value = false;
          dragLift.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
          velocity.value = withTiming(0, { duration: 260 });

          if (cancelled.value) {
            progress.value = animateSV.value
              ? withSpring(currentIndexSV.value, CANCEL_SPRING)
              : withTiming(currentIndexSV.value, { duration: 0 });
            return;
          }

          const target = Math.max(0, Math.min(tabCount - 1, Math.round(progress.value)));
          progress.value = animateSV.value
            ? withSpring(target, SPRING_CONFIG)
            : withTiming(target, { duration: 0 });

          if (target !== currentIndexSV.value) {
            const route = TABS[target];
            if (route) {
              isInternalNav.value = true;
              runOnJS(navigate)(route.name);
            }
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slot > 0, tabCount, inset],
  );

  /** Signed, normalized velocity used for stretch/skew. */
  const flow = useDerivedValue(() => {
    const v = velocity.value / VELOCITY_FOR_MAX_STRETCH;
    return Math.max(-1, Math.min(1, v));
  });

  const dropletStyle = useAnimatedStyle(() => {
    // Distance from the nearest tab center: the droplet is most deformed mid-flight.
    const clamped = Math.max(0, Math.min(tabCount - 1, progress.value));
    const travel = Math.abs(clamped - Math.round(clamped)) * 2; // 0 .. 1
    const speed = Math.abs(flow.value);

    const stretch = travel * 0.14 + speed * 0.16;
    const squash = travel * 0.05 + speed * 0.07;

    return {
      width: Math.max(0, slotSV.value - PILL_INSET_X * 2),
      transform: [
        { translateX: progress.value * slotSV.value + PILL_INSET_X },
        { translateY: -dragLift.value * 1.5 },
        { scaleX: 1 + stretch },
        { scaleY: 1 - squash },
        { skewX: `${-flow.value * 3.5}deg` },
      ],
    };
  });

  /** Specular sheen inside the droplet drifts against the motion — fake refraction. */
  const dropletSheenStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.abs(flow.value) * 0.35,
    transform: [{ translateX: -flow.value * 9 }],
  }));

  /** Soft accent glow under the droplet, strongest while dragging. */
  const glowStyle = useAnimatedStyle(() => ({
    width: Math.max(0, slotSV.value - PILL_INSET_X * 2),
    opacity: 0.32 + dragLift.value * 0.38,
    transform: [
      { translateX: progress.value * slotSV.value + PILL_INSET_X },
      { scale: 1.12 + dragLift.value * 0.1 },
    ],
  }));

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
          intensity={isDark ? 60 : 78}
          tint={isDark ? "dark" : "light"}
          blurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
          style={{ backgroundColor: alpha(c.card, isDark ? 0.38 : 0.46) }}
        >
          {/* Refraction body: light gathers at the top, thickens and darkens at the bottom. */}
          <LinearGradient
            pointerEvents="none"
            colors={[
              alpha("#ffffff", isDark ? 0.2 : 0.85),
              alpha("#ffffff", isDark ? 0.06 : 0.24),
              "rgba(255,255,255,0)",
              alpha("#000000", isDark ? 0.16 : 0.05),
            ]}
            locations={[0, 0.28, 0.62, 1]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: TAB_BAR_HEIGHT,
            }}
          />
          {/* Grazing highlight across the very top edge — the giveaway of thick glass. */}
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(255,255,255,0)",
              alpha("#ffffff", isDark ? 0.5 : 0.95),
              "rgba(255,255,255,0)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: "absolute", left: 24, right: 24, top: 0, height: 1 }}
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
                borderColor: alpha("#ffffff", isDark ? 0.14 : 0.66),
              }}
            >
              {/* Inner dark rim: reads as the glass wall's own thickness. */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 1,
                  right: 1,
                  top: 1,
                  bottom: 1,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: alpha("#000000", isDark ? 0.24 : 0.06),
                }}
              />

              {slot > 0 ? (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: "absolute",
                        left: inset,
                        top: PILL_INSET_Y,
                        bottom: PILL_INSET_Y,
                        borderRadius: radius.pill,
                        backgroundColor: alpha(accent, isDark ? 0.22 : 0.14),
                      },
                      glowStyle,
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: "absolute",
                        left: inset,
                        top: PILL_INSET_Y,
                        bottom: PILL_INSET_Y,
                        borderRadius: radius.pill,
                        backgroundColor: alpha(accent, isDark ? 0.3 : 0.17),
                        borderWidth: 1,
                        borderColor: alpha(accent, isDark ? 0.46 : 0.28),
                        overflow: "hidden",
                      },
                      dropletStyle,
                    ]}
                  >
                    <Animated.View
                      style={[
                        { position: "absolute", left: -12, right: -12, top: 0, bottom: 0 },
                        dropletSheenStyle,
                      ]}
                    >
                      <LinearGradient
                        colors={[alpha("#ffffff", isDark ? 0.22 : 0.55), "rgba(255,255,255,0)"]}
                        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 18 }}
                      />
                      <LinearGradient
                        colors={["rgba(255,255,255,0)", alpha("#ffffff", isDark ? 0.1 : 0.3)]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
                      />
                    </Animated.View>
                  </Animated.View>
                </>
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
                    dragLift={dragLift}
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
  dragLift,
  focused,
  icon,
  label,
  testID,
  onPress,
}: {
  index: number;
  progress: SharedValue<number>;
  dragLift: SharedValue<number>;
  focused: boolean;
  icon: IconName;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const { c, accent } = useTheme();
  const Icon = Icons[icon];

  /** 0 when the droplet is a full slot away, 1 when centered — eased for a crisper handoff. */
  const nearness = useDerivedValue(() => {
    const linear = Math.max(0, 1 - Math.abs(progress.value - index));
    return linear * linear * (3 - 2 * linear);
  });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(nearness.value, [0, 1], [0, -2.5 - dragLift.value]) },
      { scale: 1 + nearness.value * 0.08 },
    ],
  }));

  // Two stacked layers crossfade, so color/weight track the droplet continuously
  // during a drag instead of popping when navigation finally commits.
  const restingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(nearness.value, [0, 0.55, 1], [1, 0.5, 0]),
  }));
  const activeStyle = useAnimatedStyle(() => ({ opacity: nearness.value }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(nearness.value, [0, 1], [0.62, 1]),
  }));

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
        <View style={{ width: 21, height: 21, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={[{ position: "absolute" }, restingStyle]}>
            <Icon size={21} color={c.mutedForeground} variant="Bulk" />
          </Animated.View>
          <Animated.View style={[{ position: "absolute" }, activeStyle]}>
            <Icon size={21} color={accent} variant="Bold" />
          </Animated.View>
        </View>

        <Animated.View style={labelStyle}>
          <View>
            <Animated.View style={restingStyle}>
              <Txt
                variant="caption"
                numberOfLines={1}
                color={c.mutedForeground}
                style={{ fontSize: 10, lineHeight: 13, textAlign: "center" }}
              >
                {label}
              </Txt>
            </Animated.View>
            <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0 }, activeStyle]}>
              <Txt
                variant="caption"
                numberOfLines={1}
                color={accent}
                style={{ fontSize: 10, lineHeight: 13, textAlign: "center" }}
              >
                {label}
              </Txt>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Press>
  );
}
