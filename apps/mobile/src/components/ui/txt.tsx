import { Text as RNText, type TextProps, type TextStyle } from "react-native";

import { boldFamilyFor, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";

type Variant = keyof typeof type;

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  /** Shortcut for `color: mutedForeground`. */
  muted?: boolean;
  align?: TextStyle["textAlign"];
};

/**
 * Every piece of copy in Bureau goes through this so the type scale stays
 * honest — and so the Display size / Bold text accessibility preferences apply
 * everywhere without touching a single screen.
 */
export function Txt({ variant = "body", color, muted, align, style, ...rest }: Props) {
  const { c, scale, boldText } = useTheme();
  const base = type[variant];
  const fontFamily = boldText ? (boldFamilyFor[base.fontFamily as string] ?? base.fontFamily) : base.fontFamily;

  return (
    <RNText
      {...rest}
      style={[
        base,
        {
          fontFamily,
          fontSize: Math.round((base.fontSize as number) * scale * 10) / 10,
          lineHeight: Math.round((base.lineHeight as number) * scale * 10) / 10,
          color: color ?? (muted ? c.mutedForeground : c.foreground),
        },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
