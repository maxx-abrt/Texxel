import * as Haptics from "expo-haptics";
import { useCallback, type ReactNode } from "react";
import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Feedback = "light" | "medium" | "heavy" | "success" | "none";

type Props = Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far the surface sinks on press. */
  scaleTo?: number;
  haptic?: Feedback;
};

/**
 * The single press primitive: a calm 0.96 spring plus contextual haptics.
 * Used everywhere so touch feedback is identical across the app.
 */
export function Press({ children, style, scaleTo = 0.96, haptic = "light", onPressIn, ...rest }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = useCallback<NonNullable<PressableProps["onPressIn"]>>(
    (event) => {
      scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320, mass: 0.5 });
      fireHaptic(haptic);
      onPressIn?.(event);
    },
    [haptic, onPressIn, scale, scaleTo],
  );

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={(event) => {
        scale.value = withSpring(1, { damping: 16, stiffness: 260, mass: 0.5 });
        rest.onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function fireHaptic(kind: Feedback) {
  if (kind === "none") return;
  try {
    if (kind === "success") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    const style =
      kind === "heavy"
        ? Haptics.ImpactFeedbackStyle.Heavy
        : kind === "medium"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light;
    void Haptics.impactAsync(style);
  } catch {
    // Haptics are unavailable on web / simulators — never let it break a tap.
  }
}
