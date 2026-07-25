import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { BottomSheet } from "@/src/components/ui/bottom-sheet";
import { Press } from "@/src/components/ui/press";
import { Txt } from "@/src/components/ui/txt";
import { useToast } from "@/src/components/ui/toast";
import { useActions } from "@/src/data/hooks";
import { useT } from "@/src/i18n/i18n-provider";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing, tones } from "@/src/theme/tokens";

const STATUSES = [
  { id: "planning", label: "project.planning", tone: tones.ocean },
  { id: "active", label: "project.active", tone: tones.mint },
  { id: "on_hold", label: "project.onHold", tone: tones.amber },
  { id: "completed", label: "project.completed", tone: tones.violet },
] as const;

const COLOR_OPTIONS = [tones.coral, tones.ocean, tones.mint, tones.amber, tones.violet, tones.rose];

type ProjectData = {
  id: string;
  name: string;
  client: string;
  status: "planning" | "active" | "completed" | "on_hold";
  color?: string;
};

export function ProjectEditSheet({
  visible,
  onClose,
  project,
}: {
  visible: boolean;
  onClose: () => void;
  project: ProjectData | null;
}) {
  const { c, tint } = useTheme();
  const t = useT();
  const toast = useToast();
  const { editProject, live } = useActions();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState<"planning" | "active" | "completed" | "on_hold">("planning");
  const [color, setColor] = useState<string>(tones.coral);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project && visible) {
      setName(project.name);
      setClient(project.client);
      setStatus(project.status);
      setColor(project.color ?? tones.coral);
    }
  }, [project, visible]);

  const submit = async () => {
    if (!project) return;
    const value = name.trim();
    if (!value) return;
    if (!live) {
      toast(t("project.signInCreate"), "info");
      onClose();
      return;
    }
    setSaving(true);
    try {
      const ok = await editProject(project.id, {
        name: value,
        client: client.trim() || t("project.internalClient"),
        status,
        color,
      });
      if (ok) {
        toast(t("project.updated"), "success");
        onClose();
      } else {
        toast(t("common.somethingWrong"), "error");
      }
    } catch {
      toast(t("common.somethingWrong"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("project.edit")} testID="project-edit-sheet">
      <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" muted>
            {t("project.name")}
          </Txt>
          <TextInput
            testID="project-edit-name-input"
            value={name}
            onChangeText={setName}
            placeholderTextColor={c.mutedForeground}
            style={{
              backgroundColor: c.muted,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              minHeight: 52,
              color: c.foreground,
              fontFamily: "PlusJakartaSans-Medium",
              fontSize: 15,
            }}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" muted>
            {t("project.client")}
          </Txt>
          <TextInput
            testID="project-edit-client-input"
            value={client}
            onChangeText={setClient}
            placeholderTextColor={c.mutedForeground}
            style={{
              backgroundColor: c.muted,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              minHeight: 52,
              color: c.foreground,
              fontFamily: "PlusJakartaSans-Medium",
              fontSize: 15,
            }}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" muted>
            {t("project.status")}
          </Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {STATUSES.map((option) => {
              const active = option.id === status;
              return (
                <Press
                  key={option.id}
                  testID={`project-edit-status-${option.id}`}
                  onPress={() => setStatus(option.id)}
                  style={{
                    height: 36,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    justifyContent: "center",
                    backgroundColor: active ? tint(option.tone, 0.2) : c.muted,
                  }}
                >
                  <Txt variant="label" color={active ? option.tone : c.mutedForeground}>
                    {t(option.label)}
                  </Txt>
                </Press>
              );
            })}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" muted>
            {t("common.color")}
          </Txt>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {COLOR_OPTIONS.map((colorOption) => {
              const active = colorOption === color;
              return (
                <Press
                  key={colorOption}
                  testID={`project-edit-color-${colorOption}`}
                  onPress={() => setColor(colorOption)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.pill,
                    backgroundColor: colorOption,
                    borderWidth: active ? 3 : 0,
                    borderColor: c.foreground,
                  }}
                >
                  <View />
                </Press>
              );
            })}
          </View>
        </View>

        <Press
          testID="project-edit-submit"
          onPress={submit}
          haptic="medium"
          disabled={saving || name.trim().length === 0}
          style={{
            height: 50,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: name.trim().length === 0 ? c.muted : c.ink,
            marginTop: spacing.xs,
          }}
        >
          <Txt variant="bodyStrong" color={name.trim().length === 0 ? c.mutedForeground : c.onInk}>
            {saving ? t("common.saving") : t("common.save")}
          </Txt>
        </Press>
      </View>
    </BottomSheet>
  );
}
