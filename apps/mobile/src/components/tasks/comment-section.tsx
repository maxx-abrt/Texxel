import { useState } from "react";
import { Image, TextInput, View } from "react-native";

import { Press } from "@/src/components/ui/press";
import { Txt } from "@/src/components/ui/txt";
import { useToast } from "@/src/components/ui/toast";
import { useActions, useTaskComments } from "@/src/data/hooks";
import { useT } from "@/src/i18n/i18n-provider";
import { timeAgo } from "@/src/lib/format";
import { useTheme } from "@/src/theme/theme-provider";
import { radius, spacing } from "@/src/theme/tokens";

export function CommentSection({ taskId }: { taskId: string }) {
  const { c, accent, onAccent } = useTheme();
  const t = useT();
  const toast = useToast();
  const { addTaskComment, live } = useActions();
  const { data: comments, loading } = useTaskComments(taskId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    if (!live) {
      toast(t("tasks.signInUpdate"), "info");
      return;
    }
    setSending(true);
    try {
      await addTaskComment(taskId, value);
      setText("");
    } catch {
      toast(t("common.somethingWrong"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Txt variant="overline" muted>
        {t("tasks.comments")}
      </Txt>

      {loading ? null : comments.length === 0 ? (
        <Txt variant="caption" muted>
          {t("tasks.noComments")}
        </Txt>
      ) : (
        <View style={{ gap: spacing.md }}>
          {comments.map((comment) => (
            <View
              key={comment.id}
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "flex-start",
              }}
            >
              {comment.authorImage ? (
                <Image
                  source={{ uri: comment.authorImage }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.pill,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.pill,
                    backgroundColor: c.secondary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt variant="caption" muted>
                    {(comment.authorName ?? "?")[0]?.toUpperCase()}
                  </Txt>
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <Txt variant="label">{comment.authorName ?? "—"}</Txt>
                  <Txt variant="caption" muted>
                    {timeAgo(comment.createdAt)}
                  </Txt>
                </View>
                <Txt variant="body" style={{ flexShrink: 1 }}>
                  {comment.content}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <TextInput
          testID="comment-input"
          value={text}
          onChangeText={setText}
          placeholder={t("tasks.writeComment")}
          placeholderTextColor={c.mutedForeground}
          style={{
            flex: 1,
            backgroundColor: c.muted,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            minHeight: 44,
            color: c.foreground,
            fontFamily: "PlusJakartaSans-Medium",
            fontSize: 14,
          }}
        />
        <Press
          testID="comment-send"
          onPress={send}
          haptic="light"
          disabled={sending || text.trim().length === 0}
          style={{
            height: 44,
            paddingHorizontal: spacing.md,
            borderRadius: radius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: text.trim().length === 0 ? c.muted : accent,
          }}
        >
          <Txt variant="label" color={text.trim().length === 0 ? c.mutedForeground : onAccent}>
            {t("tasks.send")}
          </Txt>
        </Press>
      </View>
    </View>
  );
}
