"use client";

import { Toaster, ToasterProps } from "sonner";
import { useTheme } from "next-themes";

export function ToasterProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme as ToasterProps["theme"]}
      toastOptions={{
        classNames: {
          toast:
            "rounded-2xl! border! border-border! bg-card! text-foreground! shadow-lg!",
          title: "text-sm! font-medium!",
          description: "text-muted-foreground!",
          success: "[&_[data-icon]]:text-primary!",
          error: "[&_[data-icon]]:text-destructive!",
          actionButton: "bg-primary! text-primary-foreground!",
          closeButton: "bg-card! border-border!",
        },
      }}
    />
  );
}
