import { AuthView } from "@neondatabase/auth/react";
import { AuthUIWrapper } from "@/components/providers/auth-ui-provider";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [
    { path: "sign-in" },
    { path: "sign-up" },
    { path: "sign-out" },
    { path: "forgot-password" },
    { path: "reset-password" },
  ];
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <AuthUIWrapper>
        <AuthView path={path} />
      </AuthUIWrapper>
    </main>
  );
}
