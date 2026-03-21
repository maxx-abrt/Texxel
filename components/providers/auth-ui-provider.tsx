"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";

interface AuthUIWrapperProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function AuthUIWrapper({ children, redirectTo = "/onboarding" }: AuthUIWrapperProps) {
  return (
    <NeonAuthUIProvider
      authClient={authClient as any}
      redirectTo={redirectTo}
      social={{ providers: ["google"] }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
