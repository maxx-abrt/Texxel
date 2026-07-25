import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { AvatarStack } from "@/src/components/ui/avatar";
import { Press } from "@/src/components/ui/press";
import { ProgressBar } from "@/src/components/ui/progress";
import { Txt } from "@/src/components/ui/txt";
import type { VmProject } from "@/src/data/types";
import { useT } from "@/src/i18n/i18n-provider";
import type { TranslationKey } from "@/src/i18n/translations";
import { useTheme } from "@/src/theme/theme-provider";
import { mix, radius, spacing } from "@/src/theme/tokens";

export const PROJECT_CARD_WIDTH = 210;

const STATUS_LABEL: Record<VmProject["status"], TranslationKey> = {
  planning: "project.planning",
  active: "project.active",
  completed: "project.completed",
  on_hold: "project.onHold",
};

export function ProjectCard({ project }: { project: VmProject }) {
  const router = useRouter();
  const t = useT();
  const { c, isDark, shadow, toneText } = useTheme();
  const pct = project.total > 0 ? Math.round((project.done / project.total) * 100) : 0;
  const top = mix(project.tone, c.card, isDark ? 0.22 : 0.16);
  const bottom = mix(project.tone, c.card, isDark ? 0.1 : 0.06);

  return (
    <Press
      testID={`project-card-${project.id}`}
      accessibilityRole="button"
      onPress={() => router.push(`/project/${project.id}`)}
      style={[{ width: PROJECT_CARD_WIDTH, borderRadius: radius.xl }, shadow(1)]}
    >
      <LinearGradient
        colors={[top, bottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: mix(project.tone, c.border, 0.18),
          padding: spacing.lg,
          gap: spacing.md,
          minHeight: 156,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: radius.pill,
              backgroundColor: mix(project.tone, c.card, 0.25),
            }}
          >
            <Txt variant="caption" color={toneText(project.tone)}>
              {t(STATUS_LABEL[project.status])}
            </Txt>
          </View>
          <Txt variant="label" color={toneText(project.tone)}>
            {pct}%
          </Txt>
        </View>

        <View style={{ flex: 1 }}>
          <Txt variant="section" numberOfLines={2}>
            {project.name}
          </Txt>
          <Txt variant="caption" muted numberOfLines={1} style={{ marginTop: 2 }}>
            {project.client}
          </Txt>
        </View>

        <ProgressBar value={pct} tone={project.tone} track={mix(project.tone, c.card, 0.28)} />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AvatarStack people={project.members} size={22} />
          <Txt variant="caption" muted>
            {t("project.tasksCount", { done: project.done, total: project.total })}
          </Txt>
        </View>
      </LinearGradient>
    </Press>
  );
}

export function NewProjectCard({ onPress }: { onPress: () => void }) {
  const t = useT();
  const { c } = useTheme();
  return (
    <Press
      testID="project-card-new"
      accessibilityRole="button"
      accessibilityLabel={t("home.newProject")}
      onPress={onPress}
      style={{
        width: 132,
        minHeight: 156,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: c.borderStrong,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.secondary,
        }}
      >
        <Txt variant="title" muted style={{ fontSize: 22, lineHeight: 26 }}>
          +
        </Txt>
      </View>
      <Txt variant="caption" muted>
        {t("home.newProject")}
      </Txt>
    </Press>
  );
}
