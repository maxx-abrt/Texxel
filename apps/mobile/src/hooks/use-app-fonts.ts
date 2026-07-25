import { useFonts } from "expo-font";

/**
 * Plus Jakarta Sans — the Bureau typeface (same as the web app).
 * Bundled locally so it works in Expo Go, dev builds and production alike.
 */
export function useAppFonts(): readonly [boolean, Error | null] {
  return useFonts({
    "PlusJakartaSans-Regular": require("../../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("../../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("../../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakartaSans-Bold": require("../../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });
}
