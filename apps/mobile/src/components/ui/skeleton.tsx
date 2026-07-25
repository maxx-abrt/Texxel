import { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { radius } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";

export function Skeleton({
  width,
  height = 14,
  round = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        { width: width ?? "100%", height, borderRadius: round, backgroundColor: c.secondary },
        animated,
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: c.border,
        padding: 16,
        gap: 10,
      }}
    >
      <Skeleton width="55%" height={16} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "40%" : "85%"} height={11} />
      ))}
    </View>
  );
}
