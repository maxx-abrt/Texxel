// Reads public env vars without depending on @types/node (keeps the package
// consumable from Next.js, plain React and Expo alike).
declare const process: { env?: Record<string, string | undefined> } | undefined

export function readEnv(...keys: string[]): string | undefined {
  if (typeof process === "undefined") return undefined
  for (const key of keys) {
    const value = process?.env?.[key]
    if (value) return value
  }
  return undefined
}

export const CORE_URL_ENV_KEYS = ["NEXT_PUBLIC_CONVEX_CORE_URL", "EXPO_PUBLIC_CONVEX_CORE_URL"] as const
