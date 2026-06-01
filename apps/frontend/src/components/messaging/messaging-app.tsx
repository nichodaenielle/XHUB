'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  Hash,
  Loader2,
  MessageSquareText,
  Search,
  SendHorizontal,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/components/socket-provider';
import { MessageBubble } from './message-bubble';
import {
  channelLabel,
  dmPeer,
  EVENT_REMINDERS_CHANNEL_SLUG,
  formatDateSeparator,
  initialOf,
  isEventRemindersChannel,
  isSameCalendarDay,
  shouldGroupMessages,
  sortMessagesChronologically,
  type Channel,
  type Member,
  type Message,
  type Workspace,
} from '@/lib/messaging';

type SidebarTab = 'channels' | 'people';

export function MessagingApp() {
  const authUser = useAuthStore((state) => state.user);
  const selfId = authUser?.id ?? null;
  const { socket, isConnected } = useSocket();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<{ userId: string; username: string }[]>([]);
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('channels');
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState<string | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState<string | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const composeRef = useRef<HTMLTextAreaElement | null>(null);
  const currentChannelIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentChannelIdRef.current = currentChannel?.id ?? null;
  }, [currentChannel?.id]);

  // ── Derived channel groupings (mirrors RECAP sections) ─────────────────
  const publicChannels = useMemo(
    () => channels.filter((c) => c.type !== 'DIRECT'),
    [channels],
  );
  const eventReminderChannels = useMemo(
    () => publicChannels.filter((c) => c.name === EVENT_REMINDERS_CHANNEL_SLUG),
    [publicChannels],
  );
  const orgChannels = useMemo(
    () =>
      publicChannels.filter(
        (c) =>
          c.name !== EVENT_REMINDERS_CHANNEL_SLUG &&
          !String(c.name || '').startsWith('sg-'),
      ),
    [publicChannels],
  );
  const subjectGroupChannels = useMemo(
    () => publicChannels.filter((c) => String(c.name || '').startsWith('sg-')),
    [publicChannels],
  );
  const directChannels = useMemo(
    () => channels.filter((c) => c.type === 'DIRECT'),
    [channels],
  );

  const isReminderChannel = isEventRemindersChannel(currentChannel);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-grow composer
  useEffect(() => {
    const el = composeRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // ── Bootstrap: workspace + channels + members ──────────────────────────
  useEffect(() => {
    if (!selfId) return;
    let cancelled = false;

    (async () => {
      try {
        const wsRes = await api.get('/workspaces');
        const workspaces: Workspace[] = Array.isArray(wsRes.data) ? wsRes.data : [];
        const ws = workspaces[0] ?? null;
        if (cancelled) return;
        if (!ws) {
          setError('You are not a member of any workspace yet.');
          setInitialLoading(false);
          return;
        }
        setWorkspace(ws);

        const [channelsRes, membersRes] = await Promise.all([
          api.get(`/channels/workspace/${ws.id}`),
          api.get(`/workspaces/${ws.id}/members`),
        ]);
        if (cancelled) return;

        const channelList: Channel[] = Array.isArray(channelsRes.data)
          ? channelsRes.data
          : [];
        const memberList: Member[] = Array.isArray(membersRes.data)
          ? membersRes.data.map((m: any) => m.user ?? m)
          : [];

        setChannels(channelList);
        setMembers(memberList);

        const general =
          channelList.find((c) => c.name === 'general') || channelList[0] || null;
        if (general && typeof window !== 'undefined' && window.innerWidth > 768) {
          setCurrentChannel(general);
        }
        setError(null);
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              'Unable to load messaging. Please try again.',
          );
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selfId]);

  // ── Load messages for the active channel ───────────────────────────────
  const fetchMessages = useCallback(async (channelId: string) => {
    setMessagesLoading(true);
    try {
      const res = await api.get(`/messages/channel/${channelId}`, {
        params: { page: 1, limit: 50 },
      });
      const list: Message[] = Array.isArray(res.data)
        ? res.data
        : res.data?.data ?? [];
      setMessages(sortMessagesChronologically(list));
      setUnreadByChannel((prev) => ({ ...prev, [channelId]: 0 }));
    } catch (err) {
      console.error('[Messaging] Failed to load messages', err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const selectChannel = useCallback(
    (channel: Channel) => {
      setCurrentChannel(channel);
      setSidebarTab('channels');
      setReplyTo(null);
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        setMobileShowChat(true);
      }
      socket?.emit('join_channel', { channelId: channel.id });
      fetchMessages(channel.id);
    },
    [fetchMessages, socket],
  );

  useEffect(() => {
    if (currentChannel) fetchMessages(currentChannel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannel?.id]);

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages, scrollToBottom]);

  // ── Socket wiring ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onMessage = (message: Message) => {
      if (message.channelId === currentChannelIdRef.current) {
        setMessages((prev) => sortMessagesChronologically([...prev, message]));
      } else {
        setUnreadByChannel((prev) => ({
          ...prev,
          [message.channelId]: (prev[message.channelId] || 0) + 1,
        }));
      }
    };
    const onUserOnline = ({ userId }: { userId: string }) =>
      setOnlineUserIds((prev) => new Set(prev).add(userId));
    const onUserOffline = ({ userId }: { userId: string }) =>
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    const onTyping = ({
      channelId,
      userId,
      username,
    }: {
      channelId: string;
      userId: string;
      username: string;
    }) => {
      if (channelId !== currentChannelIdRef.current || userId === selfId) return;
      setTypingUsers((prev) => [
        ...prev.filter((u) => u.userId !== userId),
        { userId, username },
      ]);
    };
    const onStoppedTyping = ({
      channelId,
      userId,
    }: {
      channelId: string;
      userId: string;
    }) => {
      if (channelId !== currentChannelIdRef.current) return;
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    };

    socket.on('message', onMessage);
    socket.on('user_online', onUserOnline);
    socket.on('user_offline', onUserOffline);
    socket.on('user_typing', onTyping);
    socket.on('user_stopped_typing', onStoppedTyping);

    return () => {
      socket.off('message', onMessage);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
      socket.off('user_typing', onTyping);
      socket.off('user_stopped_typing', onStoppedTyping);
    };
  }, [socket, selfId]);

  // ── Member search (debounced) ──────────────────────────────────────────
  useEffect(() => {
    if (!workspace || memberSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(
          `/channels/workspace/${workspace.id}/members/search`,
          { params: { q: memberSearch.trim() } },
        );
        const data: Member[] = Array.isArray(res.data) ? res.data : [];
        setSearchResults(data.filter((u) => u.id !== selfId));
      } catch (err) {
        console.error('[Messaging] Member search failed', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch, workspace, selfId]);

  // ── Close context menu / reaction picker on outside click ──────────────
  useEffect(() => {
    if (!contextMenuOpen && !reactionPickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('[data-message-actions]') &&
        !target.closest('[data-context-menu]') &&
        !target.closest('[data-reaction-picker]') &&
        !target.closest('.messaging-bubble')
      ) {
        setContextMenuOpen(null);
        setReactionPickerOpen(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenuOpen, reactionPickerOpen]);

  // ── Typing emit ────────────────────────────────────────────────────────
  const emitTyping = useCallback(
    (active: boolean) => {
      if (!socket || !currentChannel) return;
      socket.emit(active ? 'typing_start' : 'typing_stop', {
        channelId: currentChannel.id,
      });
    },
    [socket, currentChannel],
  );

  const handleInputChange = (value: string) => {
    setInput(value);
    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1500);
  };

  // ── Send message (socket with REST fallback) ───────────────────────────
  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !currentChannel || isReminderChannel || sending) return;

    setSending(true);
    const tempId = `pending-${Date.now()}`;
    const pending: Message = {
      id: tempId,
      content,
      userId: selfId || '',
      channelId: currentChannel.id,
      createdAt: new Date().toISOString(),
      user: authUser
        ? {
            id: authUser.id,
            username: authUser.username,
            displayName: authUser.displayName,
            avatarUrl: authUser.avatarUrl,
          }
        : undefined,
      replyToId: replyTo?.id,
      replyTo: replyTo || undefined,
      _pending: true,
    };
    setMessages((prev) => sortMessagesChronologically([...prev, pending]));
    setInput('');
    emitTyping(false);

    const payload = {
      channelId: currentChannel.id,
      content,
      replyToId: replyTo?.id,
    };

    const removePending = () =>
      setMessages((prev) => prev.filter((m) => m.id !== tempId));

    if (socket && isConnected) {
      socket.emit('message', payload, (ack: any) => {
        setSending(false);
        removePending();
        if (ack?.error) {
          setInput(content);
        } else {
          setReplyTo(null);
          if (ack?.message) {
            setMessages((prev) =>
              prev.some((m) => m.id === ack.message.id)
                ? prev
                : sortMessagesChronologically([...prev, ack.message]),
            );
          }
        }
      });
      return;
    }

    try {
      const res = await api.post('/messages', payload);
      removePending();
      setMessages((prev) =>
        sortMessagesChronologically([...prev, res.data]),
      );
      setReplyTo(null);
    } catch (err) {
      console.error('[Messaging] Send failed', err);
      removePending();
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  // ── Edit / delete / react ──────────────────────────────────────────────
  const startEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
    setContextMenuOpen(null);
  };
  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };
  const saveEdit = async (id: string) => {
    const content = editContent.trim();
    if (!content) return cancelEdit();
    try {
      const res = await api.put(`/messages/${id}`, { content });
      setMessages((prev) => prev.map((m) => (m.id === id ? res.data : m)));
    } catch (err) {
      console.error('[Messaging] Edit failed', err);
    } finally {
      cancelEdit();
    }
  };
  const deleteMessage = async (message: Message) => {
    setContextMenuOpen(null);
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.delete(`/messages/${message.id}`);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (err) {
      console.error('[Messaging] Delete failed', err);
    }
  };
  const toggleReaction = async (id: string, emoji: string) => {
    const message = messages.find((m) => m.id === id);
    const reacted = message?.reactions?.some(
      (r) => r.emoji === emoji && r.userId === selfId,
    );
    try {
      const res = reacted
        ? await api.delete(`/messages/${id}/reactions/${encodeURIComponent(emoji)}`)
        : await api.post(`/messages/${id}/reactions`, { emoji });
      if (res.data?.id) {
        setMessages((prev) => prev.map((m) => (m.id === id ? res.data : m)));
      }
    } catch (err) {
      console.error('[Messaging] Reaction failed', err);
    } finally {
      setReactionPickerOpen(null);
    }
  };

  const startReply = (message: Message) => {
    setReplyTo(message);
    setContextMenuOpen(null);
    setTimeout(() => composeRef.current?.focus(), 80);
  };

  const openDirectMessage = async (member: Member) => {
    if (!workspace || member.id === selfId) return;
    try {
      const res = await api.post('/channels/direct', {
        workspaceId: workspace.id,
        participantUserId: member.id,
      });
      const channel: Channel = res.data;
      setChannels((prev) =>
        prev.some((c) => c.id === channel.id) ? prev : [...prev, channel],
      );
      selectChannel(channel);
    } catch (err) {
      console.error('[Messaging] Open DM failed', err);
    }
  };

  const handleScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distanceFromBottom > 240);
  };

  const displayedMembers =
    memberSearch.trim().length >= 2
      ? searchResults
      : members.filter((m) => m.id !== selfId);

  // ── Render helpers ─────────────────────────────────────────────────────
  const renderChannelButton = (channel: Channel) => {
    const unread = unreadByChannel[channel.id] || 0;
    const active = currentChannel?.id === channel.id;
    const peer = channel.type === 'DIRECT' ? dmPeer(channel, members, selfId) : null;
    const isReminder = channel.name === EVENT_REMINDERS_CHANNEL_SLUG;
    const name = peer?.displayName || channelLabel(channel, members, selfId);

    return (
      <button
        key={channel.id}
        type="button"
        onClick={() => selectChannel(channel)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition',
          active ? 'bg-primary/15 text-primary' : 'hover:bg-muted',
        )}
      >
        {peer ? (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {peer.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={peer.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialOf(peer.displayName)
            )}
          </span>
        ) : (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isReminder ? <CalendarClock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{name}</span>
          {channel.description && channel.type !== 'DIRECT' && !channel.name.startsWith('sg-') && (
            <span className="block truncate text-xs text-muted-foreground">
              {channel.description}
            </span>
          )}
          {peer?.username && (
            <span className="block truncate text-xs text-muted-foreground">@{peer.username}</span>
          )}
        </span>
        {unread > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-bold text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    );
  };

  const renderSection = (title: string, list: Channel[]) =>
    list.length > 0 ? (
      <div key={title}>
        <p className="px-3 pb-1 pt-3 text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {list.map(renderChannelButton)}
      </div>
    ) : null;

  // ── Loading / error states ─────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading conversations…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const peerForHeader =
    currentChannel?.type === 'DIRECT' ? dmPeer(currentChannel, members, selfId) : null;
  const peerOnline = peerForHeader
    ? onlineUserIds.has(peerForHeader.id) || peerForHeader.status === 'ONLINE'
    : false;

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'flex w-full flex-col border-r border-border bg-card md:w-[320px] md:flex-shrink-0',
          mobileShowChat ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="flex border-b border-border">
          {(['channels', 'people'] as SidebarTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSidebarTab(tab)}
              className={cn(
                'flex-1 border-b-2 px-3 py-3.5 text-sm font-semibold transition',
                sidebarTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'channels' ? 'Discussions' : 'Roster'}
            </button>
          ))}
        </div>

        {sidebarTab === 'people' && (
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search roster…"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {sidebarTab === 'channels' ? (
            channels.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No discussions yet.
              </p>
            ) : (
              <>
                {renderSection('Event reminders', eventReminderChannels)}
                {renderSection('Discussions', orgChannels)}
                {renderSection('Class sections', subjectGroupChannels)}
                {renderSection('Private messages', directChannels)}
              </>
            )
          ) : displayedMembers.length > 0 ? (
            displayedMembers.map((member) => {
              const online =
                onlineUserIds.has(member.id) || member.status === 'ONLINE';
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => openDirectMessage(member)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted"
                >
                  <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initialOf(member.displayName)
                    )}
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                        online ? 'bg-emerald-500' : 'bg-muted-foreground',
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {member.displayName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{member.username}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {memberSearch.trim().length >= 2
                ? 'No matching members found.'
                : 'No other members yet.'}
            </p>
          )}
        </div>
      </aside>

      {/* ── Main chat ── */}
      <main
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-background',
          mobileShowChat ? 'flex' : 'hidden md:flex',
        )}
      >
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileShowChat(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted md:hidden"
            aria-label="Back to discussions"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground">
              {channelLabel(currentChannel, members, selfId)}
            </h2>
            {peerForHeader && (
              <p className="text-xs text-muted-foreground">
                {peerOnline ? 'Active now' : 'Offline'}
              </p>
            )}
          </div>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs',
              isConnected ? 'text-emerald-600' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isConnected ? 'bg-emerald-500' : 'bg-muted-foreground',
              )}
            />
            {isConnected ? 'Connected' : 'Connecting…'}
          </span>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={messagesScrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-2 py-3"
          >
            {!currentChannel && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <MessageSquareText className="h-10 w-10 opacity-40" />
                <p className="text-sm">Select a discussion or member to start messaging.</p>
              </div>
            )}

            {currentChannel && messagesLoading && (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {currentChannel && !messagesLoading && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <MessageSquareText className="h-10 w-10 opacity-40" />
                <p className="text-sm">No messages yet. Say hello.</p>
              </div>
            )}

            {!messagesLoading &&
              messages.map((message, index) => {
                const previous = messages[index - 1];
                const showDate =
                  !previous ||
                  !isSameCalendarDay(message.createdAt, previous.createdAt);
                const grouped =
                  !showDate && shouldGroupMessages(message, previous);

                return (
                  <Fragment key={message.id}>
                    {showDate && (
                      <div className="relative my-3 flex items-center justify-center">
                        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                        <span className="relative rounded-full border border-border bg-card px-3 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          {formatDateSeparator(message.createdAt)}
                        </span>
                      </div>
                    )}
                    <MessageBubble
                      message={message}
                      own={message.userId === selfId}
                      selfId={selfId}
                      grouped={grouped}
                      isEditing={editingMessageId === message.id}
                      editContent={editContent}
                      reactionPickerOpen={reactionPickerOpen === message.id}
                      contextMenuOpen={contextMenuOpen === message.id}
                      onEditChange={setEditContent}
                      onStartEdit={startEdit}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      onDelete={deleteMessage}
                      onReply={startReply}
                      onToggleReactionPicker={setReactionPickerOpen}
                      onToggleReaction={toggleReaction}
                      onToggleContextMenu={(id) =>
                        setContextMenuOpen((prev) => (prev === id ? null : id))
                      }
                    />
                  </Fragment>
                );
              })}
            <div ref={messagesEndRef} />
          </div>

          {showScrollButton && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition hover:bg-muted"
              aria-label="Scroll to latest"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}

          {typingUsers.length > 0 && currentChannel && !isReminderChannel && (
            <div className="flex-shrink-0 px-4 pb-1 text-xs italic text-muted-foreground">
              {typingUsers.map((u) => u.username).join(', ')} typing…
            </div>
          )}
        </div>

        {/* ── Composer ── */}
        {currentChannel &&
          (isReminderChannel ? (
            <div className="flex-shrink-0 border-t border-border bg-card px-4 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Read-only channel — no chat here.
              </p>
            </div>
          ) : (
            <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
              {replyTo && (
                <div className="mb-2 flex items-start gap-3 rounded-lg bg-primary/5 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-primary">
                      Replying to {replyTo.user?.displayName || 'Unknown'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {replyTo.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                    aria-label="Cancel reply"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex items-end gap-2.5"
              >
                <textarea
                  ref={composeRef}
                  rows={1}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Write a message…"
                  className="max-h-[140px] min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-[0.9375rem] leading-relaxed text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                  aria-label="Send message"
                >
                  <SendHorizontal className="h-5 w-5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          ))}
      </main>
    </div>
  );
}
