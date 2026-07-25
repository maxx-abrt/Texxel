import type { ReactNode } from "react";
import { View } from "react-native";

import { radius, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";
import { useT } from "@/src/i18n/i18n-provider";
import { Press } from "./press";
import { Txt } from "./txt";

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  testID,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const { c, accent, onAccent, accentTint } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: c.border,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accentTint,
          }}
        >
          {icon}
        </View>
      ) : null}
      <Txt variant="bodyStrong" align="center">
        {title}
      </Txt>
      {description ? (
        <Txt variant="caption" muted align="center" style={{ maxWidth: 260 }}>
          {description}
        </Txt>
      ) : null}
      {actionLabel && onAction ? (
        <Press
          testID={`${testID ?? "empty"}-action`}
          onPress={onAction}
          haptic="medium"
          style={{
            marginTop: spacing.xs,
            paddingHorizontal: spacing.lg,
            height: 40,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accent,
          }}
        >
          <Txt variant="label" color={onAccent}>
            {actionLabel}
          </Txt>
        </Press>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  const { c } = useTheme();
  return (
    <View
      testID="error-state"
      style={{
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Txt variant="bodyStrong">{t("common.somethingWrong")}</Txt>
      <Txt variant="caption" muted>
        {message}
      </Txt>
      {onRetry ? (
        <Press
          testID="error-retry-button"
          onPress={onRetry}
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: spacing.lg,
            height: 36,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.secondary,
          }}
        >
          <Txt variant="label">{t("common.retry")}</Txt>
        </Press>
      ) : null}
    </View>
  );
}
