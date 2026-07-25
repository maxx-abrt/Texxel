import { Image } from "expo-image";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { radius, tones } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/theme-provider";
import { Txt } from "./txt";

const TONE_CYCLE = [tones.coral, tones.ocean, tones.mint, tones.amber, tones.violet, tones.rose];

export function initialsOf(value?: string | null): string {
  if (!value) return "?";
  const parts = value.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TONE_CYCLE[hash % TONE_CYCLE.length];
}

type Props = {
  name?: string | null;
  image?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  ring?: boolean;
  testID?: string;
};

export function Avatar({ name, image, size = 36, style, ring, testID }: Props) {
  const { c, tint, toneText } = useTheme();
  const label = initialsOf(name);
  const tone = toneFor(label);

  return (
    <View
      testID={testID}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tint(tone, 0.22),
          overflow: "hidden",
        },
        ring ? { borderWidth: 2, borderColor: c.card } : null,
        style,
      ]}
    >
      {image ? (
        <Image source={{ uri: image }} style={{ width: size, height: size }} contentFit="cover" transition={160} />
      ) : (
        <Txt
          variant="label"
          color={toneText(tone)}
          style={{ fontSize: Math.max(10, size * 0.36), lineHeight: Math.max(12, size * 0.42) }}
        >
          {label}
        </Txt>
      )}
    </View>
  );
}

export function AvatarStack({
  people,
  size = 22,
  max = 3,
}: {
  people: { name?: string | null; image?: string | null }[];
  size?: number;
  max?: number;
}) {
  const { c } = useTheme();
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name ?? "x"}-${i}`}
          name={p.name}
          image={p.image}
          size={size}
          ring
          style={i > 0 ? { marginLeft: -size * 0.32 } : null}
        />
      ))}
      {extra > 0 ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radius.pill,
            marginLeft: -size * 0.32,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.secondary,
            borderWidth: 2,
            borderColor: c.card,
          }}
        >
          <Txt variant="caption" muted style={{ fontSize: size * 0.36 }}>
            +{extra}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
