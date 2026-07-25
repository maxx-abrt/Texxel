import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Screen, ScreenHeader } from "@/src/components/ui/screen";
import { SkeletonCard } from "@/src/components/ui/skeleton";
import { EmptyState } from "@/src/components/ui/states";
import { useToast } from "@/src/components/ui/toast";
import { Txt } from "@/src/components/ui/txt";
import { useActions, useNotifications } from "@/src/data/hooks";
import { useT } from "@/src/i18n/i18n-provider";
import { timeAgo } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing, tones } from "@/src/theme/tokens";

const TYPE_TONE: Record<string, { tone: string; icon: "user" | "calendar" | "doc" | "tasks" | "notification" }> = {
  mention: { tone: tones.violet, icon: "user" },
  event: { tone: tones.ocean, icon: "calendar" },
  file: { tone: tones.amber, icon: "doc" },
  task_assigned: { tone: tones.coral, icon: "tasks" },
  member: { tone: tones.mint, icon: "user" },
};

export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const { c, accent, tint } = useTheme();

  const notifications = useNotifications();
  const { readAllNotifications } = useActions();

  const grouped = useMemo(() => {
    const unread = notifications.data.filter((n) => !n.read);
    const read = notifications.data.filter((n) => n.read);
    return { unread, read };
  }, [notifications.data]);

  return (
    <Screen testID="inbox-screen">
      <ScreenHeader
        onBack={() => router.back()}
        title={t("inbox.title")}
        subtitle={t("inbox.unread", { count: grouped.unread.length })}
        right={
          grouped.unread.length > 0 ? (
            <Press
              testID="inbox-mark-all"
              haptic="light"
              onPress={async () => {
                const ok = await readAllNotifications();
                toast(ok ? t("inbox.caughtUp") : t("inbox.signIn"), ok ? "success" : "info");
              }}
              style={{
                height: 34,
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                justifyContent: "center",
                backgroundColor: tint(accent, 0.16),
              }}
            >
              <Txt variant="label" color={accent}>
                {t("inbox.readAll")}
              </Txt>
            </Press>
          ) : null
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.sm,
        }}
      >
        {notifications.loading ? (
          <>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </>
        ) : notifications.data.length === 0 ? (
          <EmptyState
            testID="inbox-empty"
            icon={<Icons.notification size={24} color={accent} variant="Bulk" />}
            title={t("inbox.empty")}
            description={t("inbox.emptyBody")}
          />
        ) : (
          notifications.data.map((item, index) => {
            const meta = TYPE_TONE[item.type] ?? { tone: tones.ocean, icon: "notification" as const };
            const Icon = Icons[meta.icon];
            return (
              <Animated.View key={item.id} entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}>
                <View
                  testID={`notification-${item.id}`}
                  style={{
                    flexDirection: "row",
                    gap: spacing.md,
                    padding: spacing.lg,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: item.read ? c.border : tint(accent, 0.35),
                    backgroundColor: item.read ? c.card : tint(accent, 0.06),
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: radius.md,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tint(meta.tone),
                    }}
                  >
                    <Icon size={18} color={meta.tone} variant="Bulk" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <Txt variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                        {item.title}
                      </Txt>
                      <Txt variant="caption" muted>
                        {timeAgo(item.createdAt)}
                      </Txt>
                    </View>
                    {item.message ? (
                      <Txt variant="caption" muted numberOfLines={2}>
                        {item.message}
                      </Txt>
                    ) : null}
                  </View>
                  {!item.read ? (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent, marginTop: 6 }} />
                  ) : null}
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
