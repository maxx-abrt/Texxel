import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, tones } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";
import { Icons } from "./icons";
import { Txt } from "./txt";

type ToastKind = "info" | "success" | "error";
type Toast = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

/** App-wide toasts. Bureau never uses `Alert` — feedback is always in-surface. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { c, shadow } = useTheme();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const tone = toast?.kind === "success" ? tones.mint : toast?.kind === "error" ? c.destructive : tones.ocean;
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(180)}
          pointerEvents="none"
          testID="app-toast"
          style={[
            {
              position: "absolute",
              top: insets.top + spacing.sm,
              left: spacing.lg,
              right: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: c.card,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: c.border,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
            },
            shadow(2),
          ]}
        >
          <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: tone }} />
          {toast.kind === "error" ? <Icons.danger size={18} color={tone} variant="Bulk" /> : null}
          <Txt variant="label" style={{ flex: 1 }} numberOfLines={2}>
            {toast.message}
          </Txt>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
