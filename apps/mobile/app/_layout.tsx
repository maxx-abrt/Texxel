import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import { CoreProvider, WorkspaceProvider as CoreWorkspaceProvider, type CoreTokenFetcher } from "@a2e/core";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useConvexAuthBridge } from "@/src/auth/auth-provider";
import { getAccessToken } from "@/src/auth/session-store";
import { ToastProvider } from "@/src/components/ui/toast";
import { CONVEX_CORE_URL, CONVEX_URL } from "@/src/config";
import { WorkspaceLinkBridge } from "@/src/data/use-workspace-link";
import { WorkspaceProvider } from "@/src/data/workspace-provider";
import { useAppFonts } from "@/src/hooks/use-app-fonts";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { I18nProvider } from "@/src/i18n/i18n-provider";
import { ThemeProvider, useTheme } from "@/src/theme/theme-provider";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

const convex = new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false });

// Token fetcher for the A2E Core client (second Convex deployment) — reuses
// the same WorkOS session as the main client; core trusts this app's issuer.
const coreFetchToken: CoreTokenFetcher = () => getAccessToken(false);

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useAppFonts();
  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ThemeProvider>
            <I18nProvider>
            <AuthProvider>
              <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthBridge}>
                {/* Shared A2E core client (second Convex deployment) — same WorkOS token. */}
                <CoreProvider url={CONVEX_CORE_URL} fetchToken={coreFetchToken}>
                  <CoreWorkspaceProvider>
                    <WorkspaceProvider>
                      {/* Reconcile local ↔ core workspaces on login (idempotent). */}
                      <WorkspaceLinkBridge />
                      <ToastProvider>
                        <ThemedShell />
                      </ToastProvider>
                    </WorkspaceProvider>
                  </CoreWorkspaceProvider>
                </CoreProvider>
              </ConvexProviderWithAuth>
            </AuthProvider>
            </I18nProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function ThemedShell() {
  const { c, isDark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
        <Stack.Screen name="auth" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen name="inbox" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="search" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      </Stack>
    </View>
  );
}
