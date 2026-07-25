import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Screen, ScreenHeader } from "@/src/components/ui/screen";
import { EmptyState } from "@/src/components/ui/states";
import { Txt } from "@/src/components/ui/txt";
import { useDocs, useProjects, useTasks } from "@/src/data/hooks";
import { useT } from "@/src/i18n/i18n-provider";
import { relativeDay, timeAgo } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing, tones } from "@/src/theme/tokens";

type Hit = {  id: string;
  kind: "task" | "doc" | "project";
  title: string;
  subtitle: string;
  tone: string;
  href: string;
};

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { c, accent, tint } = useTheme();

  const tasks = useTasks();
  const docs = useDocs();
  const projects = useProjects();
  const [query, setQuery] = useState("");

  const hits = useMemo<Hit[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const out: Hit[] = [];

    for (const task of tasks.data) {
      if (task.title.toLowerCase().includes(needle)) {
        out.push({
          id: task.id,
          kind: "task",
          title: task.title,
          subtitle: `${task.statusLabel}${task.dueDate ? ` · ${relativeDay(task.dueDate)}` : ""}`,
          tone: task.statusColor,
          href: `/task/${task.id}`,
        });
      }
    }
    for (const doc of docs.data) {
      if (doc.title.toLowerCase().includes(needle) || doc.excerpt.toLowerCase().includes(needle)) {
        out.push({
          id: doc.id,
          kind: "doc",
          title: doc.title,
          subtitle: `${t("search.document")} · ${timeAgo(doc.updatedAt)}`,
          tone: doc.tone,
          href: `/doc/${doc.id}`,
        });
      }
    }
    for (const project of projects.data) {
      if (project.name.toLowerCase().includes(needle) || project.client.toLowerCase().includes(needle)) {
        out.push({
          id: project.id,
          kind: "project",
          title: project.name,
          subtitle: `${t("search.project")} · ${project.client}`,
          tone: project.tone,
          href: `/project/${project.id}`,
        });
      }
    }
    return out.slice(0, 40);
  }, [docs.data, projects.data, query, t, tasks.data]);

  const suggestions = useMemo(
    () => [
      ...tasks.data.filter((t) => !t.isDone).slice(0, 3).map((t) => t.title),
      ...docs.data.filter((d) => !d.isFolder).slice(0, 2).map((d) => d.title),
    ],
    [docs.data, tasks.data],
  );

  return (
    <Screen testID="search-screen">
      <ScreenHeader onBack={() => router.back()} title={t("search.title")}>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: c.muted,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.lg,
              height: 48,
            }}
          >
            <Icons.search size={18} color={c.mutedForeground} variant="Bulk" />
            <TextInput
              testID="search-input"
              value={query}
              onChangeText={setQuery}
              placeholder={t("search.placeholder")}
              placeholderTextColor={c.mutedForeground}
              autoFocus
              returnKeyType="search"
              style={{
                flex: 1,
                color: c.foreground,
                fontFamily: "PlusJakartaSans-Medium",
                fontSize: 15,
                paddingVertical: 0,
              }}
            />
          </View>
        </View>
      </ScreenHeader>

      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.sm,
        }}
      >
        {query.trim().length === 0 ? (
          <View style={{ gap: spacing.md }}>
            <Txt variant="overline" muted>
              {t("search.jumpBack")}
            </Txt>
            {suggestions.map((text) => (
              <Press
                key={text}
                testID={`search-suggestion-${text.slice(0, 12)}`}
                onPress={() => setQuery(text)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                }}
              >
                <Icons.clock size={17} color={c.mutedForeground} variant="Bulk" />
                <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {text}
                </Txt>
                <Icons.chevronRight size={15} color={c.mutedForeground} variant="Linear" />
              </Press>
            ))}
          </View>
        ) : hits.length === 0 ? (
          <EmptyState
            testID="search-empty"
            icon={<Icons.search size={24} color={accent} variant="Bulk" />}
            title={t("search.noResults")}
            description={t("search.noResultsBody", { query: query.trim() })}
          />
        ) : (
          hits.map((hit, index) => (
            <Animated.View key={`${hit.kind}-${hit.id}`} entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(280)}>
              <Press
                testID={`search-hit-${hit.id}`}
                onPress={() => router.push(hit.href as never)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.card,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.md,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: tint(hit.tone),
                  }}
                >
                  {hit.kind === "task" ? (
                    <Icons.tasks size={17} color={hit.tone} variant="Bulk" />
                  ) : hit.kind === "doc" ? (
                    <Icons.doc size={17} color={hit.tone} variant="Bulk" />
                  ) : (
                    <Icons.grid size={17} color={hit.tone} variant="Bulk" />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {hit.title}
                  </Txt>
                  <Txt variant="caption" muted numberOfLines={1}>
                    {hit.subtitle}
                  </Txt>
                </View>
                <Icons.chevronRight size={15} color={c.mutedForeground} variant="Linear" />
              </Press>
            </Animated.View>
          ))
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}
