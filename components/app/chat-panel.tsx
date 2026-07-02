"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChatMentionPicker, MentionChip, Mentionable } from "./chat-mention";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";
import { ChannelCreateDialog } from "./channel-create-dialog";
import { ChannelSettingsDialog } from "./channel-settings-dialog";
import { ChannelMembersDialog } from "./channel-members-dialog";
import {
  Hash,
  MessageSquare,
  Paperclip,
  Send,
  Smile,
  CornerDownRight,
  X,
  MoreHorizontal,
  Trash2,
  Edit2,
  Check,
  ChevronLeft,
  Plus,
  Settings,
  Users,
  Lock,
  MoreVertical,
} from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "😡",
  "🎉",
  "🔥",
  "👏",
  "🤔",
  "👀",
  "✅",
  "👋",
  "🙏",
  "🚀",
  "💯",
];

interface ChatAttachment {
  storageId: string;
  name: string;
  size: number;
  contentType?: string;
  file?: File;
  uploading?: boolean;
}

interface ChatMessage {
  _id: string;
  channelId: string;
  userId: string;
  content: string;
  attachments?: ChatAttachment[];
  mentionedUserIds?: string[];
  mentionedEntities?: { type: string; id: string; name?: string }[];
  parentId?: string;
  editedAt?: number;
  deletedAt?: number;
  createdAt: number;
  author: { _id: string; name: string; image?: string } | null;
  reactions: { emoji: string; count: number; me: boolean }[];
  replyCount: number;
}

interface ChatPanelProps {
  projectId?: string;
  channelId?: string;
  className?: string;
  onClose?: () => void;
}

export function ChatPanel({ projectId, channelId, className, onClose }: ChatPanelProps) {
  const { activeWorkspaceId, me } = useWorkspace();
  const t = useTranslations("chat");
  const workspaceId = activeWorkspaceId;

  const channels = useQuery(
    api.flux_chat.listChannels,
    workspaceId ? { workspaceId } : "skip",
  );
  const projectChannel = useQuery(
    api.flux_chat.getChannelByProject,
    projectId ? ({ projectId: projectId as any } as any) : "skip",
  );
  const unreadCounts = useQuery(
    api.flux_chat.unreadCounts,
    workspaceId ? { workspaceId } : "skip",
  );

  const [activeChannelId, setActiveChannelId] = useState<string | null>(channelId ?? null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<Mentionable[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const markRead = useMutation(api.flux_chat.markRead);
  const sendMessage = useMutation(api.flux_chat.sendMessage);
  const editMessage = useMutation(api.flux_chat.editMessage);
  const deleteMessage = useMutation(api.flux_chat.deleteMessage);
  const addReaction = useMutation(api.flux_chat.addReaction);
  const generateUploadUrl = useMutation(api.flux_files.generateUploadUrl);
  const ensureProjectChannel = useMutation(api.flux_chat.ensureProjectChannel);
  const ensureWorkspaceChannel = useMutation(api.flux_chat.ensureWorkspaceChannel);
  const [ensured, setEnsured] = useState(false);

  const activeChannel = useMemo(() => {
    if (projectId && projectChannel) return projectChannel;
    return (
      channels?.find((c: any) => c._id === activeChannelId) ??
      channels?.find((c: any) => c.type === "workspace") ??
      channels?.[0]
    );
  }, [channels, activeChannelId, projectChannel, projectId]);

  const messages = useQuery(
    api.flux_chat.listMessages,
    activeChannel?._id
      ? {
          channelId: activeChannel._id as any,
          parentId: (threadId as any) ?? undefined,
          limit: 100,
        }
      : "skip",
  );

  const unreadMap = useMemo(() => {
    const map = new Map<string, number>();
    unreadCounts?.forEach((u: any) => map.set(u.channelId, u.count));
    return map;
  }, [unreadCounts]);

  useEffect(() => {
    if (activeChannel?._id && !threadId) {
      markRead({ channelId: activeChannel._id });
    }
  }, [activeChannel?._id, threadId]);

  useEffect(() => {
    if (ensured) return;
    if (projectId && projectChannel === null) {
      setEnsured(true);
      ensureProjectChannel({ projectId: projectId as any }).catch(() => {});
    } else if (!projectId && activeWorkspaceId && channels !== undefined && channels.length === 0) {
      setEnsured(true);
      ensureWorkspaceChannel({ workspaceId: activeWorkspaceId as any }).catch(() => {});
    }
  }, [projectId, projectChannel, activeWorkspaceId, channels, ensured, ensureProjectChannel, ensureWorkspaceChannel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && !editingId) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, editingId]);

  useEffect(() => {
    if (channelId) setActiveChannelId(channelId);
  }, [channelId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    setDraft(value);
    setCursorPos(pos);
    const before = value.slice(0, pos);
    const match = before.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (item: Mentionable) => {
    const before = draft.slice(0, cursorPos);
    const after = draft.slice(cursorPos);
    const newBefore = before.replace(/@[^\s@]*$/, `@${item.name} `);
    setDraft(newBefore + after);
    setMentions((prev) => {
      const exists = prev.some((m) => m.id === item.id && m.type === item.type);
      return exists ? prev : [...prev, item];
    });
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const removeMention = (item: Mentionable) => {
    setMentions((prev) => prev.filter((m) => !(m.id === item.id && m.type === item.type)));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File too large: ${file.name} (max 10 MB)`);
        continue;
      }
      const local: ChatAttachment = {
        storageId: "",
        name: file.name,
        size: file.size,
        contentType: file.type,
        file,
        uploading: true,
      };
      setAttachments((prev) => [...prev, local]);
      try {
        const postUrl = await generateUploadUrl();
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        const { storageId } = await res.json();
        setAttachments((prev) =>
          prev.map((a) =>
            a === local ? { ...a, storageId, uploading: false } : a,
          ),
        );
      } catch {
        setAttachments((prev) => prev.filter((a) => a !== local));
        alert(`Failed to upload ${file.name}`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!activeChannel?._id) return;
    if (!text && !attachments.length) return;
    const readyAttachments = attachments
      .filter((a) => !a.uploading && a.storageId)
      .map((a) => ({
        storageId: a.storageId as any,
        name: a.name,
        size: a.size,
        contentType: a.contentType,
      }));
    await sendMessage({
      channelId: activeChannel._id as any,
      content: text,
      attachments: readyAttachments,
      mentionedUserIds: mentions.filter((m) => m.type === "user").map((m) => m.id as any),
      mentionedEntities: mentions
        .filter((m) => m.type !== "user")
        .map((m) => ({ type: m.type, id: m.id, name: m.name })),
      parentId: (threadId as any) ?? undefined,
    });
    setDraft("");
    setMentions([]);
    setAttachments([]);
    setMentionQuery(null);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    await addReaction({ messageId: messageId as any, emoji });
    setShowEmojiFor(null);
  };

  const startEdit = (m: ChatMessage) => {
    setEditingId(m._id);
    setEditDraft(m.content);
  };

  const saveEdit = async (m: ChatMessage) => {
    const text = editDraft.trim();
    if (!text) return;
    await editMessage({ messageId: m._id as any, content: text });
    setEditingId(null);
    setEditDraft("");
  };

  const removeMessage = async (m: ChatMessage) => {
    if (confirm("Delete this message?")) {
      await deleteMessage({ messageId: m._id as any });
    }
  };

  const activeThread = useMemo(() => {
    if (!threadId) return null;
    return messages?.find((m: any) => m._id === threadId);
  }, [threadId, messages]);

  return (
    <div className={cn("flex h-full w-full overflow-hidden bg-background text-sm", className)}>
      {/* Sidebar channel list */}
      {!projectId && (
        <div className="flex w-56 flex-col border-r border-border bg-muted/30">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquare size={14} /> {t("channels")}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setCreateOpen(true)}
              title={t("createChannel")}
            >
              <Plus size={14} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {(channels ?? []).map((c: any) => {
              const unread = unreadMap.get(c._id) ?? 0;
              const active = c._id === activeChannel?._id;
              return (
                <div
                  key={c._id}
                  className={cn(
                    "group flex items-center rounded-lg transition-colors",
                    active ? "bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  <button
                    onClick={() => {
                      setActiveChannelId(c._id);
                      setThreadId(null);
                    }}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Hash size={14} className="shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{c.name}</span>
                      {c.visibility === "private" && (
                        <Lock size={10} className="shrink-0 text-muted-foreground" />
                      )}
                      {unread > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                    {c.lastMessage && (
                      <p className="truncate pl-5 text-[11px] text-muted-foreground">
                        {c.lastMessage.author?.name}: {c.lastMessage.content}
                      </p>
                    )}
                  </button>
                  {c.canManage && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1" align="end">
                        <button
                          onClick={() => { setSelectedChannel(c); setSettingsOpen(true); }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <Settings size={14} /> {t("editChannel")}
                        </button>
                        <button
                          onClick={() => { setSelectedChannel(c); setMembersOpen(true); }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <Users size={14} /> {t("members")}
                        </button>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2 min-w-0">
              {threadId ? (
                <button
                  onClick={() => setThreadId(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft size={14} /> {t("thread")}
                </button>
              ) : (
                <>
                  <Hash size={16} className="text-muted-foreground" />
                  <span className="truncate font-semibold">{activeChannel?.name}</span>
                  {activeChannel?.visibility === "private" && (
                    <span className="flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <Lock size={8} /> {t("private")}
                    </span>
                  )}
                  {activeChannel?.type === "project" && (
                    <span className="text-xs text-muted-foreground">· project</span>
                  )}
                </>
              )}
            </div>
            {activeChannel?.description && !threadId && (
              <p className="truncate text-[11px] text-muted-foreground">{activeChannel.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!threadId && activeChannel?.canManage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={t("members")}
                  onClick={() => { setSelectedChannel(activeChannel); setMembersOpen(true); }}
                >
                  <Users size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={t("channelSettings")}
                  onClick={() => { setSelectedChannel(activeChannel); setSettingsOpen(true); }}
                >
                  <Settings size={16} />
                </Button>
              </>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X size={16} />
              </Button>
            )}
          </div>
        </div>

        {/* Thread header */}
        {threadId && activeThread && (
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={activeThread.author?.image} />
                <AvatarFallback>
                  {(activeThread.author?.name ?? "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold">{activeThread.author?.name}</span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(activeThread.createdAt, { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{activeThread.content}</p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {(messages ?? []).map((m: ChatMessage) => (
            <div key={m._id} className="group flex items-start gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={m.author?.image} />
                <AvatarFallback className="bg-muted text-xs">
                  {(m.author?.name ?? "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{m.author?.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(m.createdAt, { addSuffix: true })}
                  </span>
                  {m.editedAt && (
                    <span className="text-[10px] text-muted-foreground">{t("edited")}</span>
                  )}
                </div>

                {m.deletedAt ? (
                  <p className="text-xs italic text-muted-foreground">{t("messageDeleted")}</p>
                ) : editingId === m._id ? (
                  <div className="mt-1 flex gap-2">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="min-h-12 flex-1 resize-none py-2 text-sm"
                    />
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" onClick={() => saveEdit(m)}>
                        <Check size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-0.5 space-y-1">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {m.attachments.map((a, i) => (
                          <ChatAttachmentItem key={i} attachment={a} />
                        ))}
                      </div>
                    )}
                    {m.mentionedEntities && m.mentionedEntities.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {m.mentionedEntities.map((e, i) => (
                          <MentionChip
                            key={i}
                            item={{ type: e.type as any, id: e.id, name: e.name ?? e.id }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Reactions & actions */}
                {!m.deletedAt && (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {m.reactions.map((r) => (
                        <button
                          key={r.emoji}
                          onClick={() => handleReaction(m._id, r.emoji)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
                            r.me
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted/50 hover:bg-muted",
                          )}
                        >
                          {r.emoji} {r.count}
                        </button>
                      ))}
                      <Popover open={showEmojiFor === m._id} onOpenChange={(open) => setShowEmojiFor(open ? m._id : null)}>
                        <PopoverTrigger asChild>
                          <button className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted">
                            <Smile size={12} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <div className="grid grid-cols-8 gap-1">
                            {EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(m._id, emoji)}
                                className="rounded-md p-1 text-lg hover:bg-muted"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!threadId && m.parentId === undefined && (
                        <button
                          onClick={() => setThreadId(m._id)}
                          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                        >
                          <CornerDownRight size={10} />
                          {m.replyCount > 0 ? t("replies", { count: m.replyCount }) : t("reply")}
                        </button>
                      )}
                      {m.userId === me?._id && (
                        <>
                          <button
                            onClick={() => startEdit(m)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => removeMessage(m)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        {activeChannel && (
          <div className="border-t border-border p-3">
            {mentions.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {mentions.map((m) => (
                  <MentionChip key={`${m.type}-${m.id}`} item={m} onRemove={removeMention} />
                ))}
              </div>
            )}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs"
                  >
                    <Paperclip size={12} />
                    <span className="max-w-[120px] truncate">{a.name}</span>
                    {a.uploading ? (
                      <span className="text-[10px] text-muted-foreground">{t("uploading")}</span>
                    ) : (
                      <button onClick={() => setAttachments((prev) => prev.filter((x) => x !== a))}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && activeChannel.canPost) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  activeChannel.canPost
                    ? (threadId ? t("replyPlaceholder") : t("newMessagePlaceholder"))
                    : t("readOnlyPlaceholder")
                }
                disabled={!activeChannel.canPost}
                className="min-h-14 resize-none pr-20 py-3 text-sm disabled:opacity-60"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => fileRef.current?.click()}
                  disabled={!activeChannel.canPost}
                >
                  <Paperclip size={16} />
                </Button>
                <Button
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleSend}
                  disabled={!activeChannel.canPost || (!draft.trim() && !attachments.length)}
                >
                  <Send size={16} />
                </Button>
              </div>
              {mentionQuery !== null && activeChannel.canPost && (
                <div className="absolute bottom-full left-0 mb-2">
                  <ChatMentionPicker query={mentionQuery} onSelect={insertMention} />
                </div>
              )}
            </div>
            {!activeChannel.canPost && (
              <p className="mt-1 text-[11px] text-muted-foreground">{t("readOnlyHint")}</p>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>

      <ChannelCreateDialog
        workspaceId={workspaceId ?? ""}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <ChannelSettingsDialog
        channel={selectedChannel}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onDeleted={() => {
          if (selectedChannel?._id === activeChannelId) {
            setActiveChannelId(null);
          }
          setSelectedChannel(null);
        }}
      />
      <ChannelMembersDialog
        channelId={selectedChannel?._id ?? null}
        workspaceId={workspaceId ?? null}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
    </div>
  );
}

function ChatAttachmentItem({ attachment }: { attachment: ChatAttachment }) {
  const url = useQuery(
    api.flux_files.getUrl,
    attachment.storageId ? { storageId: attachment.storageId as any } : "skip",
  );
  const isImage = (attachment.contentType ?? "").startsWith("image/");

  if (isImage && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block h-24 w-32 overflow-hidden rounded-md border border-border"
      >
        <img src={url} alt={attachment.name} className="h-full w-full object-cover" />
      </a>
    );
  }

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex max-w-[200px] items-center gap-2 rounded-md border border-border bg-muted px-2 py-1.5 text-xs hover:bg-muted/80"
    >
      <Paperclip size={14} />
      <span className="truncate">{attachment.name}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {(attachment.size / 1024).toFixed(0)} KB
      </span>
    </a>
  );
}
