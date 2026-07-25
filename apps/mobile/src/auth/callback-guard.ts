/**
 * Guards against double-processing of the WorkOS auth code.
 *
 * On iOS, `ASWebAuthenticationSession` intercepts the redirect before the app
 * sees it, so `signIn()` in the auth provider handles the code. On Android,
 * the redirect goes through the intent filter and expo-router navigates to
 * `/auth`, where `app/auth.tsx` handles it. In rare cases both paths could
 * fire, so this module coordinates between them.
 */

let codeProcessed = false;

export function isCodeProcessed(): boolean {
  return codeProcessed;
}

export function markCodeProcessed(): void {
  codeProcessed = true;
}

export function resetCodeProcessed(): void {
  codeProcessed = false;
}
