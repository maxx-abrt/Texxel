import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DocRow } from "@/src/components/docs/doc-row";
import { FloatingAction, HeaderActions } from "@/src/components/ui/chrome";
import { Icons } from "@/src/components/ui/icons";
import { ChipRow, type ChipOption } from "@/src/components/ui/pill";
import { Press } from "@/src/components/ui/press";
import { Screen, ScreenHeader, TAB_BAR_HEIGHT } from "@/src/components/ui/screen";
import { SkeletonCard } from "@/src/components/ui/skeleton";
import { EmptyState } from "@/src/components/ui/states";
import { useToast } from "@/src/components/ui/toast";
import { Txt } from "@/src/components/ui/txt";
import { useActions, useDocs, useNotifications } from "@/src/data/hooks";
import type { VmDoc } from "@/src/data/types";
import { useT } from "@/src/i18n/i18n-provider";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing } from "@/src/theme/tokens";

export default function DocsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { c, accent } = useTheme();

  const docs = useDocs();
  const notifications = useNotifications();
  const { addDocument } = useActions();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const unread = notifications.data.filter((n) => !n.read).length;

  const childrenOf = useMemo(() => {
    const map = new Map<string, VmDoc[]>();
    for (const doc of docs.data) {
      const key = doc.parentId ?? "__root__";
      const list = map.get(key) ?? [];
      list.push(doc);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || b.updatedAt - a.updatedAt);
    }
    return map;
  }, [docs.data]);

  const chips = useMemo<ChipOption[]>(
    () => [
      { id: "all", label: t("common.all"), count: docs.data.length },
      { id: "recent", label: t("docs.recent") },
      { id: "docs", label: t("docs.documents"), count: docs.data.filter((d) => !d.isFolder).length },
      { id: "folders", label: t("docs.folders"), count: docs.data.filter((d) => d.isFolder).length },
    ],
    [docs.data, t],
  );

  /** Flatten the tree, honouring folder expansion, search and the chip filter. */
  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (search) {
      return docs.data
        .filter((d) => d.title.toLowerCase().includes(search) || d.excerpt.toLowerCase().includes(search))
        .map((doc) => ({ doc, depth: 0 }));
    }
    if (filter === "recent") {
      return [...docs.data]
        .filter((d) => !d.isFolder)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12)
        .map((doc) => ({ doc, depth: 0 }));
    }
    if (filter === "docs") {
      return docs.data.filter((d) => !d.isFolder).map((doc) => ({ doc, depth: 0 }));
    }
    if (filter === "folders") {
      return docs.data.filter((d) => d.isFolder).map((doc) => ({ doc, depth: 0 }));
    }

    const out: { doc: VmDoc; depth: number }[] = [];
    const walk = (parent: string, depth: number) => {
      for (const doc of childrenOf.get(parent) ?? []) {
        out.push({ doc, depth });
        if (doc.isFolder && expanded[doc.id]) walk(doc.id, depth + 1);
      }
    };
    walk("__root__", 0);
    return out;
  }, [childrenOf, docs.data, expanded, filter, query]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  const createDoc = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await addDocument(t("common.untitled"));
      if (!id) {
        toast(t("docs.signInCreate"), "info");
        return;
      }
      router.push(`/doc/${id}`);
    } catch {
      toast(t("docs.createFailed"), "error");
    } finally {
      setCreating(false);
    }
  }, [addDocument, creating, router, t, toast]);

  return (
    <Screen testID="docs-screen">
      <ScreenHeader
        title={t("docs.title")}
        subtitle={t("docs.count", { count: docs.data.filter((d) => !d.isFolder).length })}
        right={<HeaderActions unread={unread} />}
      >
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: c.muted,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.lg,
              height: 44,
            }}
          >
            <Icons.search size={17} color={c.mutedForeground} variant="Bulk" />
            <TextInput
              testID="docs-search-input"
              value={query}
              onChangeText={setQuery}
              placeholder={t("docs.searchPlaceholder")}
              placeholderTextColor={c.mutedForeground}
              returnKeyType="search"
              style={{
                flex: 1,
                color: c.foreground,
                fontFamily: "PlusJakartaSans-Medium",
                fontSize: 14,
                paddingVertical: 0,
              }}
            />
            {query.length > 0 ? (
              <Press testID="docs-search-clear" hitSlop={8} haptic="none" onPress={() => setQuery("")}>
                <Icons.close size={17} color={c.mutedForeground} variant="Bulk" />
              </Press>
            ) : null}
          </View>
        </View>

        <ChipRow options={chips} value={filter} onChange={setFilter} testIDPrefix="doc-filter" />
      </ScreenHeader>

      <ScrollView
        testID="docs-list"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.mutedForeground} />}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 100,
          gap: spacing.sm,
        }}
      >
        {docs.loading ? (
          <>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </>
        ) : rows.length === 0 ? (
          <EmptyState
            testID="docs-empty"
            icon={<Icons.note size={24} color={accent} variant="Bulk" />}
            title={query ? t("docs.noMatches") : t("docs.empty")}
            description={query ? t("docs.noMatchesBody") : t("docs.emptyBody")}
            actionLabel={query ? undefined : t("docs.new")}
            onAction={query ? undefined : createDoc}
          />
        ) : (
          rows.map(({ doc, depth }, index) => (
            <Animated.View key={doc.id} entering={FadeInDown.delay(Math.min(index, 10) * 30).duration(280)}>
              <DocRow
                doc={doc}
                depth={depth}
                expanded={expanded[doc.id]}
                hasChildren={(childrenOf.get(doc.id)?.length ?? 0) > 0}
                onToggleExpand={() => setExpanded((prev) => ({ ...prev, [doc.id]: !prev[doc.id] }))}
              />
            </Animated.View>
          ))
        )}

        {rows.length > 0 ? (
          <Txt variant="caption" muted align="center" style={{ marginTop: spacing.lg }}>
            {t("docs.syncNote")}
          </Txt>
        ) : null}
      </ScrollView>

      <FloatingAction testID="docs-new-fab" label={t("docs.new")} onPress={createDoc} />
    </Screen>
  );
}
