import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { usePushTokenMutations, useWorkspace } from "@a2e/core";
import { coreFlags } from "@/src/core-flags";

/**
 * Registers the device for push notifications with the A2E Core deployment.
 *
 * Requires `expo-notifications` to be installed. If the package is not
 * available, this hook is a no-op.
 *
 * Usage: mount once near the root of the authenticated app.
 *   usePushRegistration();
 *
 * Setup:
 *   npx expo install expo-notifications
 *   Add the push notifications plugin to app.json:
 *     "plugins": ["expo-notifications"]
 */
export function usePushRegistration() {
  const { activeWorkspaceId } = useWorkspace();
  const { register, unregister } = usePushTokenMutations();
  const registeredToken = useRef<string | null>(null);

  useEffect(() => {
    if (!coreFlags.notifications || !activeWorkspaceId) return;

    // Dynamically import expo-notifications so the hook doesn't crash
    // if the package isn't installed yet.
    let cancelled = false;
    import("expo-notifications")
      .then(async (Notifications) => {
        if (cancelled || !Notifications?.getExpoPushTokenAsync) return;

        // Request permissions (iOS only — Android grants on install).
        if (Platform.OS === "ios") {
          const granted = await Notifications.requestPermissionsAsync();
          if (!granted.granted) return;
        }

        const token = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        });
        if (cancelled || !token?.data) return;

        // Avoid re-registering the same token.
        if (registeredToken.current === token.data) return;
        registeredToken.current = token.data;

        await register({
          workspaceId: activeWorkspaceId as any,
          token: token.data,
          platform: Platform.OS as "ios" | "android",
          appKey: "bureau",
        }).catch(() => {});
      })
      .catch(() => {
        // expo-notifications not installed — push is a no-op until added.
      });

    return () => {
      cancelled = true;
      // Unregister on logout/workspace switch.
      if (registeredToken.current) {
        unregister({ token: registeredToken.current }).catch(() => {});
        registeredToken.current = null;
      }
    };
  }, [activeWorkspaceId, register, unregister]);
}
