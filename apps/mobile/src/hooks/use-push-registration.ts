import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { usePushTokenMutations, useWorkspace } from "@a2e/core";
import { coreFlags } from "@/src/core-flags";

/**
 * Registers the device with A2E Core's shared `pushTokens` table so the suite
 * can fan notifications out to this device (guide §8).
 *
 * STATUS: inert until `expo-notifications` is installed — the package is not in
 * `apps/mobile/package.json` yet, and a static import of a missing module is a
 * Metro build error, so the token acquisition is behind `getExpoPushToken()`
 * which returns `null` today.
 *
 * To activate:
 *   1. npx expo install expo-notifications
 *   2. add "expo-notifications" to app.json → plugins
 *   3. replace the body of `getExpoPushToken()` with:
 *        const Notifications = require("expo-notifications");
 *        if (Platform.OS === "ios") {
 *          const granted = await Notifications.requestPermissionsAsync();
 *          if (!granted.granted) return null;
 *        }
 *        const token = await Notifications.getExpoPushTokenAsync({
 *          projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
 *        });
 *        return token?.data ?? null;
 *
 * Everything else (core registration, dedupe, unregister on logout/switch) is
 * already wired.
 */
async function getExpoPushToken(): Promise<string | null> {
  return null;
}

export function usePushRegistration() {
  const { activeWorkspaceId } = useWorkspace();
  const { register, unregister } = usePushTokenMutations();
  const registeredToken = useRef<string | null>(null);

  useEffect(() => {
    if (!coreFlags.notifications || !activeWorkspaceId) return;

    let cancelled = false;

    void (async () => {
      const token = await getExpoPushToken().catch(() => null);
      if (cancelled || !token) return;

      // Avoid re-registering the same token.
      if (registeredToken.current === token) return;
      registeredToken.current = token;

      // `pushTokens.register` is per device+user (not per workspace) — see the
      // @a2e/core contract; core fans out to every workspace the user is in.
      await register({
        token,
        platform: Platform.OS as "ios" | "android",
        appKey: "bureau",
      }).catch(() => {});
    })();

    return () => {
      cancelled = true;
      // Unregister on logout / workspace switch.
      if (registeredToken.current) {
        unregister({ token: registeredToken.current }).catch(() => {});
        registeredToken.current = null;
      }
    };
  }, [activeWorkspaceId, register, unregister]);
}
