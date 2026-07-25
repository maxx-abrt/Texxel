import { handleMobileAuthHandoff } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleMobileAuthHandoff(request);
}
