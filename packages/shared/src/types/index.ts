// User Types
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: UserStatus;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  DO_NOT_DISTURB = 'do_not_disturb'
}

export interface CreateUserDto {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface UpdateUserDto {
  displayName?: string;
  avatarUrl?: string;
  status?: UserStatus;
}

// Workspace Types
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkspaceDto {
  name: string;
  slug: string;
  description?: string;
}

// Channel Types
export enum ChannelType {
  PUBLIC = 'public',
  PRIVATE = 'private',
  DIRECT = 'direct',
  GROUP = 'group'
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  type: ChannelType;
  description?: string;
  topic?: string;
  /** RECAP subject_group id when name is sg-{id} */
  externalId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  externalUserId?: string | null;
  joinedAt: Date;
}

export interface CreateChannelDto {
  workspaceId: string;
  name: string;
  type: ChannelType;
  description?: string;
  topic?: string;
}

// Message Types
export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  replyToId?: string;
  pinned: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
}

export interface CreateMessageDto {
  channelId: string;
  content: string;
  replyToId?: string;
  attachments?: CreateAttachmentDto[];
}

export interface UpdateMessageDto {
  content?: string;
  pinned?: boolean;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface CreateReactionDto {
  emoji: string;
}

// Attachment Types
export interface MessageAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  createdAt: Date;
}

export interface CreateAttachmentDto {
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
}

// Thread Types
export interface Thread {
  id: string;
  messageId: string;
  channelId: string;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Member Types
export enum WorkspaceRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
  GUEST = 'guest'
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
  user?: User;
}

export interface AddMemberDto {
  userId: string;
  role: WorkspaceRole;
}

// Notification Types
export enum NotificationType {
  MESSAGE = 'message',
  MENTION = 'mention',
  REACTION = 'reaction',
  CHANNEL_INVITE = 'channel_invite',
  WORKSPACE_INVITE = 'workspace_invite'
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

// Presence Types
export interface Presence {
  userId: string;
  status: UserStatus;
  lastSeenAt: Date;
  activeDevices: string[];
}

export interface TypingIndicator {
  channelId: string;
  userId: string;
  timestamp: Date;
}

// WebSocket Event Types
export enum SocketEvent {
  // Connection
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',

  // Authentication
  AUTHENTICATE = 'authenticate',
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',

  // Messaging
  MESSAGE_SENT = 'message_sent',
  MESSAGE_UPDATED = 'message_updated',
  MESSAGE_DELETED = 'message_deleted',
  MESSAGE_PINNED = 'message_pinned',

  // Reactions
  REACTION_ADDED = 'reaction_added',
  REACTION_REMOVED = 'reaction_removed',

  // Typing
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',

  // Presence
  PRESENCE_UPDATE = 'presence_update',
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',

  // Channels
  CHANNEL_CREATED = 'channel_created',
  CHANNEL_UPDATED = 'channel_updated',
  CHANNEL_DELETED = 'channel_deleted',

  // Notifications
  NOTIFICATION = 'notification',

  // Read Receipts
  MESSAGE_READ = 'message_read'
}

export interface SocketMessage {
  event: SocketEvent;
  data?: any;
  timestamp: Date;
}

// Pagination Types
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Search Types
export interface SearchResult {
  type: 'message' | 'user' | 'channel';
  id: string;
  title: string;
  description?: string;
  score: number;
  highlight?: Record<string, string[]>;
}

export interface SearchParams {
  query: string;
  type?: 'message' | 'user' | 'channel' | 'all';
  workspaceId?: string;
  channelId?: string;
  limit?: number;
}
