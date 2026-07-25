import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { BottomSheet } from "@/src/components/ui/bottom-sheet";
import { Icons } from "@/src/components/ui/icons";
import { Press } from "@/src/components/ui/press";
import { Txt } from "@/src/components/ui/txt";
import { useToast } from "@/src/components/ui/toast";
import { useActions, useProjects, useStatuses, useWorkspaceMembers } from "@/src/data/hooks";
import { useT } from "@/src/i18n/i18n-provider";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing, tones } from "@/src/theme/tokens";

const DAY = 86_400_000;

const WHEN = [
  { id: "today", label: "common.today", offset: 0 },
  { id: "tomorrow", label: "common.tomorrow", offset: 1 },
  { id: "week", label: "tasks.nextWeek", offset: 7 },
  { id: "none", label: "common.noDate", offset: -1 },
] as const;

const PRIORITIES = [
  { id: "none", label: "priority.none", tone: tones.ocean },
  { id: "low", label: "priority.low", tone: tones.ocean },
  { id: "medium", label: "priority.medium", tone: tones.amber },
  { id: "high", label: "priority.high", tone: tones.coral },
  { id: "urgent", label: "priority.urgent", tone: tones.red },
] as const;

type TaskData = {
  id: string;
  title: string;
  priority: string;
  dueDate?: number | null;
  status: string;
  projectId?: string | null;
  assigneeId?: string | null;
};

export function TaskEditSheet({
  visible,
  onClose,
  task,
}: {
  visible: boolean;
  onClose: () => void;
  task: TaskData | null;
}) {
  const { c, accent, onAccent, tint } = useTheme();
  const t = useT();
  const toast = useToast();
  const { editTask, live } = useActions();
  const { data: statuses } = useStatuses();
  const { data: projects } = useProjects();
  const { data: members } = useWorkspaceMembers();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [when, setWhen] = useState("none");
  const [status, setStatus] = useState<string>("");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task && visible) {
      setTitle(task.title);
      setPriority(task.priority || "medium");
      setStatus(task.status || "");
      setProjectId(task.projectId ?? undefined);
      setAssigneeId(task.assigneeId ?? undefined);
      if (task.dueDate) {
        const diff = task.dueDate - Date.now();
        if (diff < DAY / 2) setWhen("today");
        else if (diff < DAY * 1.5) setWhen("tomorrow");
        else if (diff < DAY * 7) setWhen("week");
        else setWhen("none");
      } else {
        setWhen("none");
      }
    }
  }, [task, visible]);

  const submit = async () => {
    if (!task) return;
    const value = title.trim();
    if (!value) return;
    if (!live) {
      toast(t("tasks.signInUpdate"), "info");
      onClose();
      return;
    }
    setSaving(true);
    try {
      const offset = WHEN.find((w) => w.id === when)?.offset ?? -1;
      const dueDate = offset >= 0 ? Date.now() + offset * DAY : undefined;
      await editTask(task.id, {
        title: value,
        priority: priority as "none" | "low" | "medium" | "high" | "urgent",
        dueDate,
        status: status || undefined,
        projectId: projectId || undefined,
        assigneeId: assigneeId || undefined,
      });
      toast(t("tasks.updated"), "success");
      onClose();
    } catch {
      toast(t("tasks.updateFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("tasks.edit")} testID="task-edit-sheet" maxHeightRatio={0.85}>
      <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
        <TextInput
          testID="task-edit-title-input"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor={c.mutedForeground}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
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

        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" muted>
            {t("tasks.when")}
          </Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {WHEN.map((option) => {
              const active = option.id === when;
              return (
                <Press
                  key={option.id}
                  testID={`task-edit-when-${option.id}`}
                  onPress={() => setWhen(option.id)}
                  style={{
                    height: 36,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    justifyContent: "center",
                    backgroundColor: active ? accent : c.muted,
                  }}
                >
                  <Txt variant="label" color={active ? onAccent : c.mutedForeground}>
                    {t(option.label)}
                  </Txt>
                </Press>
              );
            })}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" muted>
            {t("tasks.priority")}
          </Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {PRIORITIES.map((option) => {
              const active = option.id === priority;
              return (
                <Press
                  key={option.id}
                  testID={`task-edit-priority-${option.id}`}
                  onPress={() => setPriority(option.id)}
                  style={{
                    height: 36,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    backgroundColor: active ? tint(option.tone, 0.2) : c.muted,
                  }}
                >
                  <Icons.flag size={14} color={option.tone} variant="Bulk" />
                  <Txt variant="label" color={active ? option.tone : c.mutedForeground}>
                    {t(option.label)}
                  </Txt>
                </Press>
              );
            })}
          </View>
        </View>

        {statuses.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Txt variant="overline" muted>
              {t("tasks.status")}
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {statuses.map((s) => {
                const active = s.key === status;
                return (
                  <Press
                    key={s.key}
                    testID={`task-edit-status-${s.key}`}
                    onPress={() => setStatus(active ? "" : s.key)}
                    style={{
                      height: 36,
                      paddingHorizontal: 14,
                      borderRadius: radius.pill,
                      justifyContent: "center",
                      backgroundColor: active ? tint(s.color, 0.2) : c.muted,
                    }}
                  >
                    <Txt variant="label" color={active ? s.color : c.mutedForeground}>
                      {s.label}
                    </Txt>
                  </Press>
                );
              })}
            </View>
          </View>
        ) : null}

        {projects.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Txt variant="overline" muted>
              {t("tasks.selectProject")}
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Press
                testID="task-edit-project-none"
                onPress={() => setProjectId(undefined)}
                style={{
                  height: 36,
                  paddingHorizontal: 14,
                  borderRadius: radius.pill,
                  justifyContent: "center",
                  backgroundColor: !projectId ? accent : c.muted,
                }}
              >
                <Txt variant="label" color={!projectId ? onAccent : c.mutedForeground}>
                  {t("tasks.noProject")}
                </Txt>
              </Press>
              {projects.map((p) => {
                const active = p.id === projectId;
                return (
                  <Press
                    key={p.id}
                    testID={`task-edit-project-${p.id}`}
                    onPress={() => setProjectId(p.id)}
                    style={{
                      height: 36,
                      paddingHorizontal: 14,
                      borderRadius: radius.pill,
                      justifyContent: "center",
                      backgroundColor: active ? tint(p.tone, 0.2) : c.muted,
                    }}
                  >
                    <Txt variant="label" color={active ? p.tone : c.mutedForeground} numberOfLines={1}>
                      {p.name}
                    </Txt>
                  </Press>
                );
              })}
            </View>
          </View>
        ) : null}

        {members.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Txt variant="overline" muted>
              {t("tasks.assignTo")}
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Press
                testID="task-edit-assignee-none"
                onPress={() => setAssigneeId(undefined)}
                style={{
                  height: 36,
                  paddingHorizontal: 14,
                  borderRadius: radius.pill,
                  justifyContent: "center",
                  backgroundColor: !assigneeId ? accent : c.muted,
                }}
              >
                <Txt variant="label" color={!assigneeId ? onAccent : c.mutedForeground}>
                  {t("tasks.unassigned")}
                </Txt>
              </Press>
              {members.map((m) => {
                const active = m.userId === assigneeId;
                const label = m.name ?? m.email ?? "—";
                return (
                  <Press
                    key={m.userId}
                    testID={`task-edit-assignee-${m.userId}`}
                    onPress={() => setAssigneeId(active ? undefined : m.userId)}
                    style={{
                      height: 36,
                      paddingHorizontal: 14,
                      borderRadius: radius.pill,
                      justifyContent: "center",
                      backgroundColor: active ? accent : c.muted,
                    }}
                  >
                    <Txt variant="label" color={active ? onAccent : c.mutedForeground} numberOfLines={1}>
                      {label}
                    </Txt>
                  </Press>
                );
              })}
            </View>
          </View>
        ) : null}

        <Press
          testID="task-edit-submit"
          onPress={submit}
          haptic="medium"
          disabled={saving || title.trim().length === 0}
          style={{
            height: 50,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: title.trim().length === 0 ? c.muted : c.ink,
            marginTop: spacing.xs,
          }}
        >
          <Txt variant="bodyStrong" color={title.trim().length === 0 ? c.mutedForeground : c.onInk}>
            {saving ? t("common.saving") : t("common.save")}
          </Txt>
        </Press>
      </View>
    </BottomSheet>
  );
}
