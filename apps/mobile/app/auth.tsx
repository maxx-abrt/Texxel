import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { trpc } from "@/src/api/trpc";
import { adoptSealedSession } from "@/src/auth/session-store";
import { isCodeProcessed, markCodeProcessed } from "@/src/auth/callback-guard";
import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Txt } from "@/src/components/ui/txt";
import { useT } from "@/src/i18n/i18n-provider";
import type { TranslationKey } from "@/src/i18n/translations";
import { useTheme } from "@/src/theme/theme-provider";
import { spacing } from "@/src/theme/tokens";

/**
 * WorkOS AuthKit callback route.
 *
 * On Android, the `bureau://auth?code=...` redirect from WorkOS goes through
 * the app's intent filter and expo-router navigates here. This screen
 * exchanges the code for a session and redirects to the app.
 *
 * On iOS, `ASWebAuthenticationSession` intercepts the redirect before the app
 * sees it, so `signIn()` in the auth provider handles the code — this route
 * is never called.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { c, accent } = useTheme();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    if (isCodeProcessed()) {
      router.replace("/");
      return;
    }

    const code = params.code;
    if (typeof code !== "string" || code.length === 0) {
      setError("auth.errorIncomplete");
      return;
    }

    markCodeProcessed();

    (async () => {
      try {
        const res = await trpc.session.codeExchange.mutate({ code });
        const ok = await adoptSealedSession(res.sealed);
        if (!ok) {
          setError("auth.errorSession");
          return;
        }
        router.replace("/");
      } catch {
        setError("auth.errorNetwork");
      }
    })();
  }, [params.code]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, backgroundColor: c.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            backgroundColor: c.card,
            borderRadius: 12,
            padding: spacing.md,
          }}
        >
          <Icons.danger size={18} color={c.destructive} variant="Bulk" />
          <Txt variant="caption" color={c.destructive}>
            {t(error as TranslationKey)}
          </Txt>
        </View>
        <Press
          onPress={() => router.replace("/sign-in")}
          haptic="medium"
          style={{
            height: 48,
            borderRadius: 24,
            backgroundColor: accent,
            paddingHorizontal: spacing.xl,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt variant="bodyStrong" color="#fff">
            {t("auth.continue")}
          </Txt>
        </Press>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: c.background }}>
      <ActivityIndicator size="large" color={accent} />
      <Txt variant="body" muted>
        {t("auth.opening")}
      </Txt>
    </View>
  );
}
