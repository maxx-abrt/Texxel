import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/auth-provider";
import { Avatar } from "@/src/components/ui/avatar";
import { Card, SectionTitle } from "@/src/components/ui/card";
import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Screen, ScreenHeader, TAB_BAR_HEIGHT } from "@/src/components/ui/screen";
import { useToast } from "@/src/components/ui/toast";
import { Txt } from "@/src/components/ui/txt";
import { useDocs, useTasks } from "@/src/data/hooks";
import { useWorkspace } from "@/src/data/workspace-provider";
import { LANGUAGES, useI18n, type LanguageId } from "@/src/i18n/i18n-provider";
import type { TranslationKey } from "@/src/i18n/translations";
import { DISPLAY_SIZES, useTheme, type DisplaySizeId, type ThemeMode as Mode } from "@/src/theme/theme-provider";
import { accentPresets, alpha, radius, readableOn, spacing, type AccentId } from "@/src/theme/tokens";

const THEME_MODES: { id: Mode; label: TranslationKey; icon: "sun" | "moon" | "settings" }[] = [
  { id: "light", label: "settings.themeLight", icon: "sun" },
  { id: "dark", label: "settings.themeDark", icon: "moon" },
  { id: "system", label: "settings.themeAuto", icon: "settings" },
];

const SIZE_LABEL: Record<DisplaySizeId, TranslationKey> = {
  compact: "settings.compact",
  default: "settings.default",
  large: "settings.large",
  xlarge: "settings.xlarge",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { t, language, setLanguage } = useI18n();
  const {
    c,
    accent,
    accentId,
    setAccentId,
    mode,
    setMode,
    tint,
    shadow,
    displaySize,
    setDisplaySize,
    boldText,
    setBoldText,
    highContrast,
    setHighContrast,
    reduceMotion,
    setReduceMotion,
  } = useTheme();
  const { user, signOut } = useAuth();
  const { profile, workspace, workspaces, setWorkspaceId } = useWorkspace();

  const tasks = useTasks();
  const docs = useDocs();
  const [signingOut, setSigningOut] = useState(false);

  const displayName = user?.name ?? profile.name ?? "Bureau";
  const displayEmail = user?.email ?? profile.email ?? "";

  return (
    <Screen testID="profile-screen">
      <ScreenHeader title={t("profile.title")} subtitle={workspace?.name ?? t("common.workspace")} />

      <ScrollView
        testID="profile-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 60,
          gap: spacing.xl,
        }}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <View
            testID="profile-card"
            style={[
              {
                backgroundColor: c.ink,
                borderRadius: radius.xxl,
                padding: spacing.xl,
                gap: spacing.lg,
              },
              shadow(2),
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
              <Avatar name={displayName} image={profile.image} size={56} />
              <View style={{ flex: 1 }}>
                <Txt variant="section" color={c.onInk} numberOfLines={1}>
                  {displayName}
                </Txt>
                <Txt variant="caption" color={alpha(c.onInk, 0.6)} numberOfLines={1}>
                  {displayEmail || t("profile.signedInWorkos")}
                </Txt>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {[
                { label: t("profile.statTasks"), value: tasks.data.length },
                { label: t("profile.statDone"), value: tasks.data.filter((task) => task.isDone).length },
                { label: t("profile.statDocs"), value: docs.data.filter((doc) => !doc.isFolder).length },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    borderRadius: radius.lg,
                    paddingVertical: spacing.md,
                    alignItems: "center",
                    backgroundColor: alpha(c.onInk, 0.08),
                  }}
                >
                  <Txt variant="section" color={c.onInk}>
                    {stat.value}
                  </Txt>
                  <Txt variant="caption" color={alpha(c.onInk, 0.6)} numberOfLines={1}>
                    {stat.label}
                  </Txt>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ gap: spacing.md }}>
          <SectionTitle title={t("common.workspace")} />
          <Card padded={false} testID="workspace-switcher">
            {workspaces.map((item, index) => {
              const active = item.id === workspace?.id;
              return (
                <Press
                  key={item.id}
                  testID={`workspace-${item.id}`}
                  onPress={() => setWorkspaceId(item.id)}
                  haptic="light"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: spacing.lg,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tint(accent),
                    }}
                  >
                    <Icons.workspace size={18} color={accent} variant="Bulk" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {item.name}
                    </Txt>
                    <Txt variant="caption" muted>
                      {item.role} · {item.memberCount}{" "}
                      {item.memberCount === 1 ? t("common.member") : t("common.members")}
                    </Txt>
                  </View>
                  {active ? <Icons.tickCircle size={20} color={accent} variant="Bulk" /> : null}
                </Press>
              );
            })}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={{ gap: spacing.md }}>
          <SectionTitle title={t("profile.appearance")} />
          <Card style={{ gap: spacing.xl }}>
            <View style={{ gap: spacing.md }}>
              <Txt variant="overline" muted>
                {t("profile.theme")}
              </Txt>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {THEME_MODES.map((option) => {
                  const active = option.id === mode;
                  const Icon = Icons[option.icon];
                  return (
                    <Press
                      key={option.id}
                      testID={`theme-${option.id}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => setMode(option.id)}
                      style={{
                        flex: 1,
                        height: 46,
                        borderRadius: radius.lg,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        backgroundColor: active ? c.ink : c.muted,
                      }}
                    >
                      <Icon size={17} color={active ? c.onInk : c.mutedForeground} variant="Bulk" />
                      <Txt variant="label" color={active ? c.onInk : c.mutedForeground} numberOfLines={1}>
                        {t(option.label)}
                      </Txt>
                    </Press>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              <Txt variant="overline" muted>
                {t("profile.accent")}
              </Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                {accentPresets.map((preset) => {
                  const active = preset.id === accentId;
                  return (
                    <Press
                      key={preset.id}
                      testID={`accent-${preset.id}`}
                      accessibilityLabel={preset.name}
                      accessibilityState={{ selected: active }}
                      onPress={() => setAccentId(preset.id as AccentId)}
                      haptic="light"
                      scaleTo={0.9}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.pill,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: preset.hex,
                        borderWidth: active ? 3 : 0,
                        borderColor: c.background,
                      }}
                    >
                      {active ? (
                        <Icons.tickCircle size={20} color={readableOn(preset.hex)} variant="Bold" />
                      ) : null}
                    </Press>
                  );
                })}
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Language, display density and the accessibility switches. Every value
            is persisted the moment it changes. */}
        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={{ gap: spacing.md }}>
          <SectionTitle title={t("settings.display")} />
          <Card testID="settings-card" style={{ gap: spacing.xl }}>
            <View style={{ gap: spacing.sm }}>
              <Txt variant="overline" muted>
                {t("settings.language")}
              </Txt>
              <Txt variant="caption" muted>
                {t("settings.languageHint")}
              </Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 2 }}>
                {LANGUAGES.map((option) => {
                  const active = option.id === language;
                  return (
                    <Press
                      key={option.id}
                      testID={`language-${option.id}`}
                      accessibilityState={{ selected: active }}
                      haptic="light"
                      onPress={() => setLanguage(option.id as LanguageId)}
                      style={{
                        height: 38,
                        paddingHorizontal: 14,
                        borderRadius: radius.pill,
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: active ? accent : c.border,
                        backgroundColor: active ? tint(accent, 0.16) : c.card,
                      }}
                    >
                      <Txt variant="label" color={active ? accent : c.mutedForeground}>
                        {option.id === "system" ? t("settings.themeAuto") : option.native}
                      </Txt>
                    </Press>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Txt variant="overline" muted>
                {t("settings.displaySize")}
              </Txt>
              <Txt variant="caption" muted>
                {t("settings.displaySizeHint")}
              </Txt>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 2 }}>
                {DISPLAY_SIZES.map((option) => {
                  const active = option.id === displaySize;
                  return (
                    <Press
                      key={option.id}
                      testID={`display-size-${option.id}`}
                      accessibilityState={{ selected: active }}
                      haptic="light"
                      onPress={() => setDisplaySize(option.id as DisplaySizeId)}
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: radius.lg,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: active ? accent : c.border,
                        backgroundColor: active ? tint(accent, 0.16) : c.card,
                      }}
                    >
                      <Txt
                        variant="label"
                        numberOfLines={1}
                        color={active ? accent : c.mutedForeground}
                        style={{ fontSize: 9 + option.scale * 4 }}
                      >
                        Aa
                      </Txt>
                      <Txt variant="caption" muted numberOfLines={1} style={{ fontSize: 9 }}>
                        {t(SIZE_LABEL[option.id])}
                      </Txt>
                    </Press>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              <Txt variant="overline" muted>
                {t("settings.accessibility")}
              </Txt>
              <SettingSwitch
                testID="setting-bold-text"
                label={t("settings.boldText")}
                hint={t("settings.boldTextHint")}
                value={boldText}
                onChange={setBoldText}
              />
              <SettingSwitch
                testID="setting-high-contrast"
                label={t("settings.highContrast")}
                hint={t("settings.highContrastHint")}
                value={highContrast}
                onChange={setHighContrast}
              />
              <SettingSwitch
                testID="setting-reduce-motion"
                label={t("settings.reduceMotion")}
                hint={t("settings.reduceMotionHint")}
                value={reduceMotion}
                onChange={setReduceMotion}
              />
            </View>

            <View
              testID="settings-preview"
              style={{
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.muted,
                padding: spacing.lg,
                gap: 4,
              }}
            >
              <Txt variant="overline" color={accent}>
                {t("settings.preview")}
              </Txt>
              <Txt variant="bodyStrong">{t("settings.display")}</Txt>
              <Txt variant="caption" muted>
                {t("settings.previewBody")}
              </Txt>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(400)} style={{ gap: spacing.md }}>
          <SectionTitle title={t("profile.account")} />
          <Card padded={false}>
            <ProfileRow
              testID="profile-open-inbox"
              icon="notification"
              label={t("profile.notifications")}
              onPress={() => router.push("/inbox")}
            />
            <ProfileRow
              testID="profile-open-search"
              icon="search"
              label={t("profile.searchEverything")}
              onPress={() => router.push("/search")}
              bordered
            />
            <ProfileRow
              testID="profile-about"
              icon="book"
              label={t("profile.webApp")}
              hint="texxel.app"
              onPress={() => toast(t("profile.webAppHint"), "info")}
              bordered
            />
          </Card>

          <Press
            testID="sign-out-button"
            onPress={async () => {
              setSigningOut(true);
              await signOut();
              setSigningOut(false);
              router.replace("/sign-in");
            }}
            haptic="medium"
            style={{
              height: 50,
              borderRadius: radius.pill,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
            }}
          >
            <Icons.logout size={18} color={c.destructive} variant="Bulk" />
            <Txt variant="label" color={c.destructive}>
              {signingOut ? t("common.saving") : t("common.signOut")}
            </Txt>
          </Press>

          <Txt variant="caption" muted align="center">
            {t("profile.builtBy")}
          </Txt>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function SettingSwitch({
  label,
  hint,
  value,
  onChange,
  testID,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID: string;
}) {
  const { c, accent, tint } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{label}</Txt>
        <Txt variant="caption" muted>
          {hint}
        </Txt>
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.borderStrong, true: tint(accent, 0.55) }}
        thumbColor={value ? accent : c.card}
        ios_backgroundColor={c.borderStrong}
      />
    </View>
  );
}

function ProfileRow({
  icon,
  label,
  hint,
  onPress,
  bordered,
  testID,
}: {
  icon: "notification" | "search" | "book";
  label: string;
  hint?: string;
  onPress: () => void;
  bordered?: boolean;
  testID: string;
}) {
  const { c } = useTheme();
  const Icon = Icons[icon];
  return (
    <Press
      testID={testID}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: bordered ? 1 : 0,
        borderTopColor: c.border,
      }}
    >
      <Icon size={19} color={c.mutedForeground} variant="Bulk" />
      <Txt variant="body" style={{ flex: 1 }}>
        {label}
      </Txt>
      {hint ? (
        <Txt variant="caption" muted>
          {hint}
        </Txt>
      ) : null}
      <Icons.chevronRight size={16} color={c.mutedForeground} variant="Linear" />
    </Press>
  );
}
