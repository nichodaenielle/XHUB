// Shared types + helpers for the XHUB messaging UI.
// Mirrors the design language and feature set of the RECAP messaging experience.

export interface MessagingUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  status?: string;
}

export interface Reaction {
  id?: string;
  emoji: string;
  userId: string;
  count?: number;
  user?: MessagingUser;
}

export interface Attachment {
  id: string;
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  replyToId?: string | null;
  replyTo?: Message | null;
  reactions?: Reaction[];
  attachments?: Attachment[];
  metadata?: Record<string, unknown> | null;
  user?: MessagingUser;
  _pending?: boolean;
}

export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DIRECT';

export interface Channel {
  id: string;
  name: string;
  description?: string | null;
  type: ChannelType;
  workspaceId: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
}

export interface Member extends MessagingUser {}

export const EVENT_REMINDERS_CHANNEL_SLUG = 'event-reminders';

export const POPULAR_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👎'];

const DISCUSSION_DISPLAY_NAMES: Record<string, string> = {
  general: 'All members',
  announcements: 'Official notices',
  'event-reminders': 'Event reminders',
};

export function formatDiscussionSlug(slug?: string | null): string {
  if (!slug) return '';
  const bare = slug.startsWith('#') ? slug.slice(1) : slug;
  if (DISCUSSION_DISPLAY_NAMES[bare]) return DISCUSSION_DISPLAY_NAMES[bare];
  if (bare.startsWith('dept-')) {
    return bare
      .slice(5)
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }
  if (bare.startsWith('sg-')) return 'Class section';
  return bare;
}

export function dmPeer(
  channel: Channel | null,
  members: Member[],
  selfId: string | null,
): Member | null {
  if (!channel) return null;
  const match = /^dm:([^:]+):([^:]+)$/.exec(channel.name || '');
  if (!match) return null;
  const otherId = match[1] === selfId ? match[2] : match[1];
  return members.find((m) => m.id === otherId) || null;
}

export function channelLabel(
  channel: Channel | null,
  members: Member[],
  selfId: string | null,
): string {
  if (!channel) return 'Select a conversation';
  if (channel.type === 'DIRECT') {
    const peer = dmPeer(channel, members, selfId);
    return peer?.displayName ? peer.displayName : 'Private message';
  }
  if (channel.description && String(channel.name || '').startsWith('sg-')) {
    return channel.description;
  }
  return formatDiscussionSlug(channel.name);
}

export function isEventRemindersChannel(channel: Channel | null): boolean {
  return channel?.name === EVENT_REMINDERS_CHANNEL_SLUG;
}

export function sortMessagesChronologically(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function isSameCalendarDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(d.toISOString(), now.toISOString())) return 'Today';
  if (isSameCalendarDay(d.toISOString(), yesterday.toISOString()))
    return 'Yesterday';
  return d.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function shouldGroupMessages(
  current: Message,
  previous?: Message,
): boolean {
  if (!previous) return false;
  if (current.replyTo || current.replyToId) return false;
  if (!current.userId || current.userId !== previous.userId) return false;
  if (!isSameCalendarDay(current.createdAt, previous.createdAt)) return false;
  return (
    new Date(current.createdAt).getTime() -
      new Date(previous.createdAt).getTime() <
    GROUP_WINDOW_MS
  );
}

export function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function initialOf(name?: string | null): string {
  return (name?.trim()?.charAt(0) || 'U').toUpperCase();
}

/** Aggregate raw reactions (one row per user) into emoji + count groups. */
export interface AggregatedReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export function aggregateReactions(
  reactions: Reaction[] | undefined,
  selfId: string | null,
): AggregatedReaction[] {
  if (!reactions || reactions.length === 0) return [];
  const map = new Map<string, AggregatedReaction>();
  for (const r of reactions) {
    const entry = map.get(r.emoji) || {
      emoji: r.emoji,
      count: 0,
      reactedByMe: false,
    };
    entry.count += r.count ?? 1;
    if (r.userId === selfId) entry.reactedByMe = true;
    map.set(r.emoji, entry);
  }
  return Array.from(map.values());
}
