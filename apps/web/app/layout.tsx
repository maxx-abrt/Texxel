import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { HtmlLang } from "./html-lang";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    icons: {
      icon: [
        { url: "/favicon-32.png" },
        { url: "/favicon-dark-32.png", media: "(prefers-color-scheme: dark)" },
      ],
      apple: "/apple-touch-icon.png",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers>
          <HtmlLang />
          {children}
        </Providers>
      </body>
    </html>
  );
}
