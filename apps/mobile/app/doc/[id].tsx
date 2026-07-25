import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BlockEditor } from "@/src/components/editor/block-editor";
import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Screen, ScreenHeader } from "@/src/components/ui/screen";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useToast } from "@/src/components/ui/toast";
import { Txt } from "@/src/components/ui/txt";
import { useActions, useDoc } from "@/src/data/hooks";
import { useT } from "@/src/i18n/i18n-provider";
import { parseDocument, serializeDocument, type NativeBlock } from "@/src/lib/blocks";
import { timeAgo } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing } from "@/src/theme/tokens";

const AUTOSAVE_MS = 900;

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const { c, accent, tint } = useTheme();

  const doc = useDoc(id);
  const { saveDocument, live } = useActions();

  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<NativeBlock[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const hydrated = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate once per document so remote updates never clobber local typing.
  useEffect(() => {
    if (!doc.data || hydrated.current === doc.data.id) return;
    hydrated.current = doc.data.id;
    setTitle(doc.data.title);
    setBlocks(parseDocument(doc.data.content));
    setDirty(false);
  }, [doc.data]);

  const persist = useCallback(
    async (nextTitle: string, nextBlocks: NativeBlock[]) => {
      if (!id) return;
      if (!live) {
        setDirty(false);
        return;
      }
      setSaving(true);
      try {
        await saveDocument(id, { title: nextTitle, content: serializeDocument(nextBlocks) });
        setDirty(false);
      } catch {
        toast(t("doc.saveFailed"), "error");
      } finally {
        setSaving(false);
      }
    },
    [id, live, saveDocument, t, toast],
  );

  const schedule = useCallback(
    (nextTitle: string, nextBlocks: NativeBlock[]) => {
      setDirty(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(nextTitle, nextBlocks), AUTOSAVE_MS);
    },
    [persist],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onChangeTitle = useCallback(
    (value: string) => {
      setTitle(value);
      schedule(value, blocks);
    },
    [blocks, schedule],
  );

  const onChangeBlocks = useCallback(
    (next: NativeBlock[]) => {
      setBlocks(next);
      schedule(title, next);
    },
    [schedule, title],
  );

  const words = useMemo(
    () => blocks.reduce((sum, b) => sum + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0),
    [blocks],
  );

  const status = saving
    ? t("common.saving")
    : dirty
      ? t("common.unsaved")
      : live
        ? t("common.saved")
        : t("doc.demoReadOnly");

  if (doc.loading) {
    return (
      <Screen testID="doc-loading">
        <ScreenHeader onBack={() => router.back()} title={t("search.document")} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="70%" height={30} />
          <Skeleton width="90%" height={14} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="60%" height={14} />
        </View>
      </Screen>
    );
  }

  if (!doc.data) {
    return (
      <Screen testID="doc-missing">
        <ScreenHeader onBack={() => router.back()} title={t("search.document")} />
        <View style={{ padding: spacing.xl, alignItems: "center", gap: spacing.md }}>
          <Icons.doc size={30} color={c.mutedForeground} variant="Bulk" />
          <Txt variant="bodyStrong">{t("doc.notAvailable")}</Txt>
          <Txt variant="caption" muted align="center">
            {t("doc.notAvailableBody")}
          </Txt>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="doc-screen">
      <ScreenHeader
        onBack={() => router.back()}
        title={title || t("common.untitled")}
        subtitle={`${t("doc.words", { count: words })} · ${timeAgo(doc.data.updatedAt)}`}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                height: 30,
                borderRadius: radius.pill,
                backgroundColor: dirty || saving ? tint(accent, 0.16) : c.muted,
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color={accent} />
              ) : (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: dirty ? accent : c.mutedForeground,
                  }}
                />
              )}
              <Txt variant="caption" color={dirty || saving ? accent : c.mutedForeground}>
                {status}
              </Txt>
            </View>
            {dirty ? (
              <Press
                testID="doc-save-button"
                haptic="medium"
                onPress={() => {
                  if (timer.current) clearTimeout(timer.current);
                  void persist(title, blocks);
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.ink,
                }}
              >
                <Icons.tickCircle size={18} color={c.onInk} variant="Bulk" />
              </Press>
            ) : null}
          </View>
        }
      />

      <BlockEditor
        title={title}
        onChangeTitle={onChangeTitle}
        blocks={blocks}
        onChangeBlocks={onChangeBlocks}
        editable
        contentBottomPadding={insets.bottom + 120}
        header={
          doc.data.icon ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              <Txt style={{ fontSize: 40, lineHeight: 46 }}>{doc.data.icon}</Txt>
            </View>
          ) : (
            <View style={{ height: spacing.lg }} />
          )
        }
      />
    </Screen>
  );
}
