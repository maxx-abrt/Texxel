import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/src/auth/auth-provider";
import { Txt } from "@/src/components/ui/txt";
import { useTheme } from "@/src/theme/theme-provider";

/** Boot gate: keychain restore → tabs or the sign-in screen. */
export default function Index() {
  const { status } = useAuth();
  const { c, accent } = useTheme();

  if (status === "loading") {
    return (
      <View
        testID="boot-screen"
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: c.background }}
      >
        <Txt variant="display" color={accent}>
          Bureau
        </Txt>
        <ActivityIndicator color={c.mutedForeground} />
      </View>
    );
  }

  if (status === "authenticated") return <Redirect href="/(tabs)" />;
  return <Redirect href="/sign-in" />;
}
