import { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { motion, radius } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressBar({
  value,
  tone,
  height = 6,
  track,
  style,
}: {
  /** 0..100 */
  value: number;
  tone: string;
  height?: number;
  track?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(100, value)), { duration: motion.slow });
  }, [value, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View
      style={[
        { height, borderRadius: radius.pill, backgroundColor: track ?? c.secondary, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View style={[{ height, borderRadius: radius.pill, backgroundColor: tone }, fill]} />
    </View>
  );
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  tone,
  track,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(100, value)) / 100, { duration: motion.slow });
  }, [progress, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track ?? c.secondary}
          strokeWidth={stroke}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>{children}</View>
    </View>
  );
}
