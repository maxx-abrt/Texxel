import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/auth-provider";
import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Grain } from "@/src/components/ui/screen";
import { Txt } from "@/src/components/ui/txt";
import { useT } from "@/src/i18n/i18n-provider";
import type { TranslationKey } from "@/src/i18n/translations";
import { useTheme } from "@/src/theme/theme-provider";
import { alpha, radius, spacing, tones } from "@/src/theme/tokens";

const HIGHLIGHTS = [
  { icon: Icons.note, tone: tones.coral, title: "auth.f1t", body: "auth.f1b" },
  { icon: Icons.tasks, tone: tones.mint, title: "auth.f2t", body: "auth.f2b" },
  { icon: Icons.analytics, tone: tones.ocean, title: "auth.f3t", body: "auth.f3b" },
] as const;

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { status, signIn, signingIn, error } = useAuth();
  const { c, accent, onAccent, isDark, shadow, tint, scale } = useTheme();

  if (status === "authenticated") return <Redirect href="/(tabs)" />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }} testID="sign-in-screen">
      <LinearGradient
        colors={[tint(accent, 0.2), c.background, c.background]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 420 }}
      />
      <Grain opacity={0.6} />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.xxl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: radius.lg,
              backgroundColor: accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt variant="title" color={onAccent} style={{ fontSize: 26 }}>
              B
            </Txt>
          </View>
          <Txt variant="display" style={{ marginTop: spacing.xl, fontSize: 34 * scale, lineHeight: 38 * scale }}>
            {t("auth.headline1")}
          </Txt>
          <Txt variant="display" color={c.mutedForeground} style={{ fontSize: 34 * scale, lineHeight: 38 * scale }}>
            {t("auth.headline2")}
          </Txt>
          <Txt variant="body" muted style={{ marginTop: spacing.md, maxWidth: 320 }}>
            {t("auth.subtitle")}
          </Txt>
        </Animated.View>

        <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
          {HIGHLIGHTS.map((item, i) => (
            <Animated.View
              key={item.title}
              entering={FadeInDown.delay(120 + i * 70).duration(420)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                backgroundColor: alpha(c.card, isDark ? 0.7 : 0.8),
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: c.border,
                padding: spacing.lg,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tint(item.tone),
                }}
              >
                <item.icon size={22} color={item.tone} variant="Bulk" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{t(item.title)}</Txt>
                <Txt variant="caption" muted style={{ marginTop: 2 }}>
                  {t(item.body)}
                </Txt>
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={{ flex: 1, minHeight: spacing.xl }} />

        {error ? (
          <View
            testID="sign-in-error"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: tint(c.destructive, 0.12),
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            <Icons.danger size={18} color={c.destructive} variant="Bulk" />
            <Txt variant="caption" color={c.destructive} style={{ flex: 1 }}>
              {t(error as TranslationKey)}
            </Txt>
          </View>
        ) : null}

        <Animated.View entering={FadeInUp.delay(340).duration(420)} style={{ gap: spacing.md }}>
          <Press
            testID="sign-in-workos-button"
            accessibilityRole="button"
            onPress={signIn}
            disabled={signingIn}
            haptic="medium"
            style={[
              {
                height: 54,
                borderRadius: radius.pill,
                backgroundColor: c.ink,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.md,
                opacity: signingIn ? 0.7 : 1,
              },
              shadow(2),
            ]}
          >
            {signingIn ? (
              <ActivityIndicator color={c.onInk} />
            ) : (
              <Icons.user size={20} color={c.onInk} variant="Bulk" />
            )}
            <Txt variant="bodyStrong" color={c.onInk}>
              {signingIn ? t("auth.opening") : t("auth.continue")}
            </Txt>
          </Press>

          <Txt variant="caption" muted align="center" style={{ marginTop: spacing.xs }}>
            {t("auth.ssoNote")}
          </Txt>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
