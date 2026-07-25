import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  TextInput,
  View,
  Platform,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, { LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { BottomSheet } from "@/src/components/ui/bottom-sheet";
import { Icons } from "@/src/components/ui/icons";
import { fireHaptic, Press } from "@/src/components/ui/press";
import { Txt } from "@/src/components/ui/txt";
import { useT } from "@/src/i18n/i18n-provider";
import type { TranslationKey } from "@/src/i18n/translations";
import { BLOCK_MENU, makeBlock, type BlockType, type NativeBlock } from "@/src/lib/blocks";
import { useTheme } from "@/src/theme/theme-provider";
import { font, radius, spacing } from "@/src/theme/tokens";

type Props = {
  title: string;
  onChangeTitle: (title: string) => void;
  blocks: NativeBlock[];
  onChangeBlocks: (blocks: NativeBlock[]) => void;
  editable: boolean;
  header?: React.ReactNode;
  contentBottomPadding: number;
};

const HISTORY_LIMIT = 50;
const TEXT_HISTORY_DEBOUNCE_MS = 800;

const MARKDOWN_TRIGGERS: { pattern: RegExp; type: BlockType }[] = [
  { pattern: /^### $/, type: "heading3" },
  { pattern: /^## $/, type: "heading2" },
  { pattern: /^# $/, type: "heading1" },
  { pattern: /^[-*] $/, type: "bulletListItem" },
  { pattern: /^\d+\. $/, type: "numberedListItem" },
  { pattern: /^> $/, type: "quote" },
  { pattern: /^``` $/, type: "codeBlock" },
  { pattern: /^\[\] $/, type: "checkListItem" },
  { pattern: /^\[ \] $/, type: "checkListItem" },
];

const TRIGGER_CHARS = /^[#*\d.>\[\]` ]*$/;

const LIST_TYPES: BlockType[] = ["bulletListItem", "numberedListItem", "checkListItem"];

function isListType(type: BlockType): boolean {
  return LIST_TYPES.includes(type);
}

/**
 * Notion-style block editor.
 *
 * Each block owns a `TextInput`; Enter splits, Backspace-at-start merges,
 * "/" opens the block menu, markdown prefixes auto-convert, and the gutter
 * handle drags to reorder with live layout animation.
 */
export function BlockEditor({
  title,
  onChangeTitle,
  blocks,
  onChangeBlocks,
  editable,
  header,
  contentBottomPadding,
}: Props) {
  const t = useT();
  const { c } = useTheme();
  const inputs = useRef<Record<string, TextInput | null>>({});
  const heights = useRef<Record<string, number>>({});
  const selections = useRef<Record<string, { start: number; end: number }>>({});
  const pendingSelection = useRef<{ id: string; position: number } | null>(null);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // ── Undo / Redo ──────────────────────────────────────────────
  const historyRef = useRef<{ title: string; blocks: NativeBlock[] }[]>([]);
  const redoRef = useRef<{ title: string; blocks: NativeBlock[] }[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const textHistoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTextSnapshot = useRef<{ title: string; blocks: NativeBlock[] } | null>(null);

  const pushHistory = useCallback(
    (snapshot: { title: string; blocks: NativeBlock[] }) => {
      const entry = { title: snapshot.title, blocks: snapshot.blocks.map((b) => ({ ...b })) };
      historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), entry];
      redoRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    },
    [],
  );

  const pushHistoryDebounced = useCallback(
    (snapshot: { title: string; blocks: NativeBlock[] }) => {
      if (textHistoryTimer.current) clearTimeout(textHistoryTimer.current);
      if (!lastTextSnapshot.current) {
        lastTextSnapshot.current = { title: snapshot.title, blocks: snapshot.blocks.map((b) => ({ ...b })) };
      }
      textHistoryTimer.current = setTimeout(() => {
        if (lastTextSnapshot.current) {
          pushHistory(lastTextSnapshot.current);
          lastTextSnapshot.current = null;
        }
      }, TEXT_HISTORY_DEBOUNCE_MS);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    const current = { title, blocks: blocks.map((b) => ({ ...b })) };
    redoRef.current = [...redoRef.current, current];
    historyRef.current = historyRef.current.slice(0, -1);
    onChangeTitle(prev.title);
    onChangeBlocks(prev.blocks.map((b) => ({ ...b })));
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    fireHaptic("light");
  }, [title, blocks, onChangeTitle, onChangeBlocks]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current[redoRef.current.length - 1];
    const current = { title, blocks: blocks.map((b) => ({ ...b })) };
    historyRef.current = [...historyRef.current, current];
    redoRef.current = redoRef.current.slice(0, -1);
    onChangeTitle(next.title);
    onChangeBlocks(next.blocks.map((b) => ({ ...b })));
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
    fireHaptic("light");
  }, [title, blocks, onChangeTitle, onChangeBlocks]);

  // ── Focus management ─────────────────────────────────────────
  const requestFocus = useCallback((id: string) => {
    setFocusId(id);
    setFocusTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!focusId) return;
    const raf = requestAnimationFrame(() => {
      const ref = inputs.current[focusId];
      if (!ref) return;
      ref.focus();
      if (pendingSelection.current && pendingSelection.current.id === focusId) {
        const pos = pendingSelection.current.position;
        ref.setNativeProps({ selection: { start: pos, end: pos } });
        pendingSelection.current = null;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [focusId, focusTick]);

  // ── Block operations ─────────────────────────────────────────
  const patch = useCallback(
    (id: string, changes: Partial<NativeBlock>) => {
      onChangeBlocks(blocks.map((b) => (b.id === id ? { ...b, ...changes } : b)));
    },
    [blocks, onChangeBlocks],
  );

  const setText = useCallback(
    (id: string, value: string) => {
      const index = blocks.findIndex((b) => b.id === id);
      if (index < 0) return;

      // Slash menu
      if (value === "/" && blocks[index].text === "") {
        setMenuFor(id);
        return;
      }

      // Markdown auto-format: check if the new value matches a trigger
      if (TRIGGER_CHARS.test(value) && blocks[index].type === "paragraph") {
        for (const trigger of MARKDOWN_TRIGGERS) {
          if (trigger.pattern.test(value)) {
            pushHistory({ title, blocks });
            patch(id, { type: trigger.type, text: "" });
            fireHaptic("light");
            return;
          }
        }
      }

      // Newline → split block
      if (value.includes("\n")) {
        const cut = value.indexOf("\n");
        const head = value.slice(0, cut);
        const tail = value.slice(cut + 1);
        const current = blocks[index];

        // Enter on empty list item → exit list to paragraph
        if (head === "" && isListType(current.type)) {
          pushHistory({ title, blocks });
          patch(id, { type: "paragraph" });
          fireHaptic("light");
          return;
        }

        const nextType: BlockType = isListType(current.type) ? current.type : "paragraph";
        const created = makeBlock(nextType, tail);
        const next = [...blocks];
        next[index] = { ...current, text: head };
        next.splice(index + 1, 0, created);
        pushHistory({ title, blocks });
        onChangeBlocks(next);
        requestFocus(created.id);
        fireHaptic("light");
        return;
      }

      // Debounced text history for undo
      pushHistoryDebounced({ title, blocks });
      patch(id, { text: value });
    },
    [blocks, title, onChangeBlocks, patch, pushHistory, pushHistoryDebounced, requestFocus],
  );

  const onKeyPress = useCallback(
    (id: string, event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (event.nativeEvent.key !== "Backspace") return;
      const index = blocks.findIndex((b) => b.id === id);
      if (index <= 0) return;
      const block = blocks[index];
      const sel = selections.current[id];
      const atStart = block.text.length === 0 || (sel && sel.start === 0 && sel.end === 0);

      if (!atStart) return;

      const previous = blocks[index - 1];
      const mergePos = previous.text.length;

      if (block.text.length > 0) {
        // Merge text from current block into previous
        const mergedText = previous.text + block.text;
        const next = blocks.filter((b) => b.id !== id);
        const merged = next.map((b) => (b.id === previous.id ? { ...b, text: mergedText } : b));
        pushHistory({ title, blocks });
        onChangeBlocks(merged);
        pendingSelection.current = { id: previous.id, position: mergePos };
        requestFocus(previous.id);
      } else {
        // Empty block — just remove
        const next = blocks.filter((b) => b.id !== id);
        pushHistory({ title, blocks });
        onChangeBlocks(next);
        pendingSelection.current = { id: previous.id, position: mergePos };
        requestFocus(previous.id);
      }
      fireHaptic("light");
    },
    [blocks, title, onChangeBlocks, pushHistory, requestFocus],
  );

  const onSelectionChange = useCallback(
    (id: string, event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selections.current[id] = {
        start: event.nativeEvent.selection.start,
        end: event.nativeEvent.selection.end,
      };
    },
    [],
  );

  const insertBelow = useCallback(
    (id: string, type: BlockType = "paragraph") => {
      const index = blocks.findIndex((b) => b.id === id);
      if (index < 0) return;
      const created = makeBlock(type);
      const next = [...blocks];
      next.splice(index + 1, 0, created);
      pushHistory({ title, blocks });
      onChangeBlocks(next);
      if (type !== "divider") requestFocus(created.id);
    },
    [blocks, title, onChangeBlocks, pushHistory, requestFocus],
  );

  const applyType = useCallback(
    (id: string, type: BlockType) => {
      const index = blocks.findIndex((b) => b.id === id);
      if (index < 0) return;
      if (type === "divider") {
        const next = [...blocks];
        pushHistory({ title, blocks });
        next[index] = { ...makeBlock("divider"), id: blocks[index].id };
        if (index === blocks.length - 1) next.push(makeBlock("paragraph"));
        onChangeBlocks(next);
        fireHaptic("light");
        return;
      }
      pushHistory({ title, blocks });
      patch(id, { type });
      requestFocus(id);
      fireHaptic("light");
    },
    [blocks, title, onChangeBlocks, patch, pushHistory, requestFocus],
  );

  const removeBlock = useCallback(
    (id: string) => {
      const next = blocks.filter((b) => b.id !== id);
      pushHistory({ title, blocks });
      onChangeBlocks(next.length > 0 ? next : [makeBlock("paragraph")]);
      fireHaptic("light");
    },
    [blocks, title, onChangeBlocks, pushHistory],
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= blocks.length || from === to) return;
      const next = [...blocks];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      pushHistory({ title, blocks });
      onChangeBlocks(next);
      fireHaptic("light");
    },
    [blocks, title, onChangeBlocks, pushHistory],
  );

  const onTitleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (event.nativeEvent.key !== "Enter") return;
      if (blocks.length > 0) {
        requestFocus(blocks[0].id);
      } else {
        const created = makeBlock("paragraph");
        pushHistory({ title, blocks });
        onChangeBlocks([created]);
        requestFocus(created.id);
      }
    },
    [blocks, title, onChangeBlocks, pushHistory, requestFocus],
  );

  const numbering = useMemo(() => {
    const map: Record<string, number> = {};
    let run = 0;
    for (const block of blocks) {
      if (block.type === "numberedListItem") {
        run += 1;
        map[block.id] = run;
      } else {
        run = 0;
      }
    }
    return map;
  }, [blocks]);

  return (
    <>
      <KeyboardAwareScrollView
        testID="block-editor-scroll"
        scrollEnabled={scrollEnabled}
        bottomOffset={72}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      >
        {header}

        <TextInput
          testID="doc-title-input"
          value={title}
          onChangeText={onChangeTitle}
          onKeyPress={onTitleKeyPress}
          editable={editable}
          placeholder={t("common.untitled")}
          placeholderTextColor={c.mutedForeground}
          multiline
          style={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
            color: c.foreground,
            fontFamily: font.extrabold,
            fontSize: 28,
            lineHeight: 34,
            letterSpacing: -0.9,
          }}
        />

        <View style={{ paddingHorizontal: spacing.sm }}>
          {blocks.map((block, index) => (
            <BlockRow
              key={block.id}
              block={block}
              number={numbering[block.id]}
              editable={editable}
              active={activeId === block.id}
              registerInput={(ref) => {
                inputs.current[block.id] = ref;
              }}
              onMeasure={(h) => {
                heights.current[block.id] = h;
              }}
              rowHeight={heights.current[block.id] ?? 44}
              onFocus={() => setActiveId(block.id)}
              onBlur={() => setActiveId((current) => (current === block.id ? null : current))}
              onChangeText={(value) => setText(block.id, value)}
              onKeyPress={(event) => onKeyPress(block.id, event)}
              onSelectionChange={(event) => onSelectionChange(block.id, event)}
              onToggleCheck={() => patch(block.id, { checked: !block.checked })}
              onOpenMenu={() => setMenuFor(block.id)}
              onDelete={() => removeBlock(block.id)}
              onDragStart={() => setScrollEnabled(false)}
              onDragEnd={() => setScrollEnabled(true)}
              onMove={(steps) => move(index, index + steps)}
            />
          ))}

          <Press
            testID="editor-append-block"
            haptic="none"
            onPress={() => {
              Keyboard.dismiss();
              const last = blocks[blocks.length - 1];
              if (last && last.text === "" && last.type === "paragraph") {
                requestFocus(last.id);
                return;
              }
              insertBelow(last?.id ?? "", "paragraph");
            }}
            style={{ minHeight: 88, paddingHorizontal: spacing.md, paddingTop: spacing.md }}
          >
            <Txt variant="body" muted>
              {blocks.length === 0 ? t("doc.startWriting") : ""}
            </Txt>
          </Press>
        </View>
      </KeyboardAwareScrollView>

      {editable && activeId ? (
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
          <EditorToolbar
            onPick={(type) => applyType(activeId, type)}
            onOpenMenu={() => setMenuFor(activeId)}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </KeyboardStickyView>
      ) : null}

      <BottomSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={t("doc.turnInto")}
        testID="slash-menu-sheet"
      >
        <View style={{ gap: spacing.xs, paddingBottom: spacing.sm }}>
          {BLOCK_MENU.map((item) => (
            <Press
              key={item.type}
              testID={`slash-${item.type}`}
              onPress={() => {
                if (menuFor) applyType(menuFor, item.type);
                setMenuFor(null);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.md,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.sm,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.muted,
                }}
              >
                <BlockIcon type={item.type} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{t(item.label as TranslationKey)}</Txt>
                <Txt variant="caption" muted>
                  {t(item.hint as TranslationKey)}
                </Txt>
              </View>
            </Press>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

function BlockIcon({ type }: { type: BlockType }) {
  const { c } = useTheme();
  const props = { size: 18, color: c.mutedForeground, variant: "Bulk" as const };
  switch (type) {
    case "heading1":
    case "heading2":
    case "heading3":
      return <Icons.heading {...props} />;
    case "bulletListItem":
      return <Icons.list {...props} />;
    case "numberedListItem":
      return <Icons.drag {...props} />;
    case "checkListItem":
      return <Icons.tickSquare {...props} />;
    case "quote":
      return <Icons.quote {...props} />;
    case "codeBlock":
      return <Icons.code {...props} />;
    case "divider":
      return <Icons.divider {...props} />;
    default:
      return <Icons.paragraph {...props} />;
  }
}

function EditorToolbar({
  onPick,
  onOpenMenu,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  onPick: (type: BlockType) => void;
  onOpenMenu: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const t = useT();
  const { c, accent } = useTheme();
  const items: { type: BlockType; label: TranslationKey }[] = [
    { type: "paragraph", label: "toolbar.text" },
    { type: "heading1", label: "toolbar.h1" },
    { type: "heading2", label: "toolbar.h2" },
    { type: "heading3", label: "toolbar.h3" },
    { type: "bulletListItem", label: "toolbar.list" },
    { type: "numberedListItem", label: "toolbar.numbered" },
    { type: "checkListItem", label: "toolbar.todo" },
    { type: "quote", label: "toolbar.quote" },
    { type: "codeBlock", label: "toolbar.code" },
    { type: "divider", label: "toolbar.divider" },
  ];

  return (
    <View
      testID="editor-toolbar"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: c.border,
        backgroundColor: c.card,
      }}
    >
      <Press
        testID="editor-toolbar-undo"
        onPress={onUndo}
        disabled={!canUndo}
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.muted,
          opacity: canUndo ? 1 : 0.4,
        }}
      >
        <Icons.undo size={18} color={c.mutedForeground} variant="Linear" />
      </Press>
      <Press
        testID="editor-toolbar-redo"
        onPress={onRedo}
        disabled={!canRedo}
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.muted,
          opacity: canRedo ? 1 : 0.4,
        }}
      >
        <Icons.redo size={18} color={c.mutedForeground} variant="Linear" />
      </Press>
      <View style={{ width: 1, height: 24, backgroundColor: c.border }} />
      <Press
        testID="editor-toolbar-menu"
        onPress={onOpenMenu}
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.muted,
        }}
      >
        <Icons.add size={19} color={accent} variant="Linear" />
      </Press>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.md }}
      >
        {items.map((item) => (
          <Press
            key={item.type}
            testID={`toolbar-${item.type}`}
            haptic="light"
            onPress={() => onPick(item.type)}
            style={{
              height: 38,
              paddingHorizontal: 12,
              borderRadius: radius.md,
              justifyContent: "center",
              backgroundColor: c.muted,
            }}
          >
            <Txt variant="label" muted>
              {t(item.label)}
            </Txt>
          </Press>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

type RowProps = {
  block: NativeBlock;
  number?: number;
  editable: boolean;
  active: boolean;
  rowHeight: number;
  registerInput: (ref: TextInput | null) => void;
  onMeasure: (height: number) => void;
  onFocus: () => void;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  onSelectionChange: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => void;
  onToggleCheck: () => void;
  onOpenMenu: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (steps: number) => void;
};

function BlockRow({
  block,
  number,
  editable,
  active,
  rowHeight,
  registerInput,
  onMeasure,
  onFocus,
  onBlur,
  onChangeText,
  onKeyPress,
  onSelectionChange,
  onToggleCheck,
  onOpenMenu,
  onDelete,
  onDragStart,
  onDragEnd,
  onMove,
}: RowProps) {
  const t = useT();
  const { c, accent, isDark } = useTheme();
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(0);
  const steps = useSharedValue(0);
  const [contentHeight, setContentHeight] = useState(0);

  const pan = Gesture.Pan()
    .activateAfterLongPress(160)
    .onStart(() => {
      dragging.value = 1;
      steps.value = 0;
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      const unit = Math.max(32, rowHeight);
      const nextSteps = Math.round(event.translationY / unit);
      if (nextSteps !== steps.value) {
        runOnJS(onMove)(nextSteps - steps.value);
        steps.value = nextSteps;
      }
      translateY.value = event.translationY - steps.value * unit;
    })
    .onEnd(() => {
      dragging.value = 0;
      translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      runOnJS(onDragEnd)();
    });

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: withSpring(dragging.value ? 1.02 : 1) }],
    zIndex: dragging.value ? 20 : 0,
    opacity: dragging.value ? 0.96 : 1,
  }));

  const textStyle = blockTextStyle(block.type, c.foreground);

  if (block.type === "divider") {
    return (
      <Animated.View layout={LinearTransition.springify().damping(20)} style={animated}>
        <View
          testID={`block-${block.id}`}
          onLayout={(e) => onMeasure(e.nativeEvent.layout.height)}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md }}
        >
          <DragHandle gesture={pan} active />
          <View style={{ flex: 1, height: 1, backgroundColor: c.borderStrong }} />
          <Press testID={`block-delete-${block.id}`} hitSlop={8} onPress={onDelete} style={{ padding: 4 }}>
            <Icons.trash size={15} color={c.mutedForeground} variant="Bulk" />
          </Press>
        </View>
      </Animated.View>
    );
  }

  if (block.type === "unsupported") {
    return (
      <Animated.View layout={LinearTransition.springify().damping(20)} style={animated}>
        <View
          testID={`block-${block.id}`}
          onLayout={(e) => onMeasure(e.nativeEvent.layout.height)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginVertical: 4,
            marginLeft: 28,
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: c.border,
          }}
        >
          <Icons.danger size={17} color={c.mutedForeground} variant="Bulk" />
          <Txt variant="caption" muted style={{ flex: 1 }}>
            {t("doc.unsupported", { type: String(block.raw.type ?? "block") })}
          </Txt>
        </View>
      </Animated.View>
    );
  }

  const isCode = block.type === "codeBlock";
  const isQuote = block.type === "quote";

  return (
    <Animated.View layout={LinearTransition.springify().damping(20)} style={animated}>
      <View
        testID={`block-${block.id}`}
        onLayout={(e) => onMeasure(e.nativeEvent.layout.height)}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, paddingVertical: 2 }}
      >
        <DragHandle gesture={pan} active={active} />

        <View style={{ width: 22, alignItems: "center", paddingTop: markerOffset(block.type) }}>
          {block.type === "bulletListItem" ? (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.mutedForeground }} />
          ) : block.type === "numberedListItem" ? (
            <Txt variant="caption" muted>
              {number ?? 1}.
            </Txt>
          ) : block.type === "checkListItem" ? (
            <Press
              testID={`block-check-${block.id}`}
              hitSlop={10}
              haptic="success"
              onPress={onToggleCheck}
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: block.checked ? 0 : 1.6,
                borderColor: c.borderStrong,
                backgroundColor: block.checked ? accent : "transparent",
              }}
            >
              {block.checked ? <Icons.tickCircle size={14} color="#ffffff" variant="Bold" /> : null}
            </Press>
          ) : null}
        </View>

        <View
          style={[
            { flex: 1 },
            isQuote
              ? { borderLeftWidth: 3, borderLeftColor: accent, paddingLeft: spacing.md, marginVertical: 4 }
              : null,
            isCode
              ? {
                  backgroundColor: isDark ? c.muted : c.secondary,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  marginVertical: 4,
                }
              : null,
          ]}
        >
          <TextInput
            testID={`block-input-${block.id}`}
            ref={registerInput}
            value={block.text}
            editable={editable}
            multiline
            scrollEnabled={false}
            onChangeText={onChangeText}
            onKeyPress={onKeyPress}
            onSelectionChange={onSelectionChange}
            onFocus={onFocus}
            onBlur={onBlur}
            onContentSizeChange={
              Platform.OS === "web"
                ? (event) => setContentHeight(event.nativeEvent.contentSize.height)
                : undefined
            }
            placeholder={active ? t("doc.typeSlash") : ""}
            placeholderTextColor={c.mutedForeground}
            style={[
              textStyle,
              block.type === "checkListItem" && block.checked
                ? { textDecorationLine: "line-through", opacity: 0.5 }
                : null,
              { paddingVertical: 4, minHeight: 30 },
              // RN Web renders a fixed-size <textarea>; grow it manually so long
              // paragraphs are never clipped.
              Platform.OS === "web" && contentHeight > 0 ? { height: contentHeight + 8 } : null,
            ]}
          />
        </View>

        {active ? (
          <Press
            testID={`block-menu-${block.id}`}
            hitSlop={8}
            haptic="light"
            onPress={onOpenMenu}
            style={{ padding: 4, paddingTop: 8 }}
          >
            <Icons.more size={16} color={c.mutedForeground} variant="Bulk" />
          </Press>
        ) : null}
      </View>
    </Animated.View>
  );
}

function DragHandle({ gesture, active }: { gesture: ReturnType<typeof Gesture.Pan>; active: boolean }) {
  const { c } = useTheme();
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          width: 22,
          paddingTop: 8,
          alignItems: "center",
          opacity: active ? 0.75 : 0.3,
        }}
      >
        <Icons.drag size={15} color={c.mutedForeground} variant="Bulk" />
      </View>
    </GestureDetector>
  );
}

function markerOffset(type: BlockType): number {
  switch (type) {
    case "heading1":
      return 12;
    case "heading2":
      return 10;
    case "heading3":
      return 8;
    default:
      return 8;
  }
}

function blockTextStyle(type: BlockType, color: string) {
  switch (type) {
    case "heading1":
      return { color, fontFamily: font.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.6 };
    case "heading2":
      return { color, fontFamily: font.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.4 };
    case "heading3":
      return { color, fontFamily: font.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 };
    case "quote":
      return { color, fontFamily: font.medium, fontSize: 15, lineHeight: 23, fontStyle: "italic" as const };
    case "codeBlock":
      return { color, fontFamily: font.mono, fontSize: 13.5, lineHeight: 20 };
    default:
      return { color, fontFamily: font.regular, fontSize: 16, lineHeight: 25 };
  }
}
