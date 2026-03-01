import { AccountView } from "@neondatabase/auth/react";
import { AuthUIWrapper } from "@/components/providers/auth-ui-provider";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ path: "settings" }, { path: "security" }];
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <AuthUIWrapper redirectTo="/documents">
        <AccountView path={path} />
      </AuthUIWrapper>
    </main>
  );
}
