import { useRouter } from "expo-router";
import { View } from "react-native";

import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Txt } from "@/src/components/ui/txt";
import type { VmDoc } from "@/src/data/types";
import { useT } from "@/src/i18n/i18n-provider";
import { timeAgo } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing } from "@/src/theme/tokens";

export function DocRow({
  doc,
  depth = 0,
  expanded,
  hasChildren,
  onToggleExpand,
}: {
  doc: VmDoc;
  depth?: number;
  expanded?: boolean;
  hasChildren?: boolean;
  onToggleExpand?: () => void;
}) {
  const router = useRouter();
  const t = useT();
  const { c, tint } = useTheme();

  return (
    <Press
      testID={`doc-row-${doc.id}`}
      accessibilityRole="button"
      onPress={() => {
        if (doc.isFolder) onToggleExpand?.();
        else router.push(`/doc/${doc.id}`);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingRight: spacing.md,
        paddingLeft: spacing.md + depth * 18,
        borderRadius: radius.lg,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      {doc.isFolder ? (
        <Press
          testID={`doc-expand-${doc.id}`}
          hitSlop={10}
          haptic="none"
          onPress={onToggleExpand}
          style={{ width: 20, alignItems: "center" }}
        >
          <Icons.chevronRight
            size={15}
            color={c.mutedForeground}
            variant="Linear"
            style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}
          />
        </Press>
      ) : (
        <View style={{ width: 20 }} />
      )}

      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tint(doc.tone),
        }}
      >
        {doc.icon ? (
          <Txt style={{ fontSize: 16 }}>{doc.icon}</Txt>
        ) : doc.isFolder ? (
          <Icons.folder size={17} color={doc.tone} variant="Bulk" />
        ) : (
          <Icons.doc size={17} color={doc.tone} variant="Bulk" />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {doc.title}
        </Txt>
        <Txt variant="caption" muted numberOfLines={1}>
          {doc.isFolder
            ? `${hasChildren ? t("common.folder") : t("common.emptyFolder")} · ${timeAgo(doc.updatedAt)}`
            : `${doc.excerpt || t("common.emptyDocument")}`}
        </Txt>
      </View>

      {!doc.isFolder ? (
        <Txt variant="caption" muted>
          {timeAgo(doc.updatedAt)}
        </Txt>
      ) : null}
    </Press>
  );
}
