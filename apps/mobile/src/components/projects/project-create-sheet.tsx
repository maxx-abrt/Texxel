import { useState } from "react";
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

export function ProjectCreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c, tint } = useTheme();
  const t = useT();
  const toast = useToast();
  const { addProject, live } = useActions();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState<"planning" | "active" | "completed" | "on_hold">("planning");
  const [color, setColor] = useState<string>(tones.coral);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = name.trim();
    if (!value) return;
    if (!live) {
      toast(t("project.signInCreate"), "info");
      onClose();
      return;
    }
    setSaving(true);
    try {
      const id = await addProject({
        name: value,
        client: client.trim() || t("project.internalClient"),
        status,
        color,
      });
      if (id) {
        toast(t("home.projectCreated"), "success");
        setName("");
        setClient("");
        setStatus("planning");
        setColor(tones.coral);
        onClose();
      } else {
        toast(t("home.projectCreateFailed"), "error");
      }
    } catch {
      toast(t("home.projectCreateFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("project.new")} testID="project-create-sheet">
      <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" muted>
            {t("project.name")}
          </Txt>
          <TextInput
            testID="project-create-name-input"
            value={name}
            onChangeText={setName}
            placeholder={t("project.name")}
            placeholderTextColor={c.mutedForeground}
            autoFocus
            returnKeyType="done"
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
            testID="project-create-client-input"
            value={client}
            onChangeText={setClient}
            placeholder={t("common.optional")}
            placeholderTextColor={c.mutedForeground}
            returnKeyType="done"
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
                  testID={`project-create-status-${option.id}`}
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
                  testID={`project-create-color-${colorOption}`}
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
          testID="project-create-submit"
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
            {saving ? t("project.creating") : t("common.create")}
          </Txt>
        </Press>
      </View>
    </BottomSheet>
  );
}
