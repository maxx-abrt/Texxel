import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import { EdgeStoreProvider } from "@/lib/edgestore";
import { ToasterProvider } from "@/components/providers/toaster-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { PaletteProvider } from "@/components/providers/palette-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Texxel",
  description:
    "The connected workspace where tasks, teams, and ideas come together.",
  icons: {
    icon: [
      {
        media: "(prefers-color-scheme: light)",
        url: "/logo.svg",
        href: "/logo.svg",
      },
      {
        media: "(prefers-color-scheme: dark)",
        url: "/logo-dark.svg",
        href: "/logo-dark.svg",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ConvexClientProvider>
          <EdgeStoreProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
              storageKey="texxel-theme"
            >
              <LocaleProvider>
                <PaletteProvider>
                  <ToasterProvider />
                  <ModalProvider />
                  {children}
                </PaletteProvider>
              </LocaleProvider>
            </ThemeProvider>
          </EdgeStoreProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
