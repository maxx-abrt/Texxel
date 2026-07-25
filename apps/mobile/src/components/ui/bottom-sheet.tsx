import { useEffect, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/src/i18n/i18n-provider";
import { radius, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";
import { Txt } from "./txt";

/**
 * Bottom sheet.
 *
 * Mounted in a native `Modal` so it always paints above the floating tab bar,
 * with a drag-to-dismiss handle. Purpose-built (rather than pulling a sheet
 * library) to stay on Reanimated 4 without extra native deps.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeightRatio = 0.75,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeightRatio?: number;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const { c, shadow } = useTheme();
  const t = useT();
  const translateY = useSharedValue(600);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 220, mass: 0.7 });
      backdrop.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(600, { duration: 180 });
      backdrop.value = withTiming(0, { duration: 160 });
    }
  }, [backdrop, translateY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 110 || event.velocityY > 900) {
        translateY.value = withTiming(600, { duration: 180 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }} testID={testID}>
        <Animated.View style={[{ ...StyleSheetAbsolute, backgroundColor: c.overlay }, backdropStyle]}>
          <Pressable
            testID="sheet-backdrop"
            accessibilityLabel={t("common.close")}
            style={{ flex: 1 }}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            {
              backgroundColor: c.card,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: c.border,
              paddingBottom: insets.bottom + spacing.lg,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
            },
            shadow(3),
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={{ paddingTop: spacing.md, paddingBottom: spacing.sm, alignItems: "center" }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong }} />
              {title ? (
                <Txt variant="bodyStrong" style={{ marginTop: spacing.md }}>
                  {title}
                </Txt>
              ) : null}
            </View>
          </GestureDetector>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetAbsolute = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
