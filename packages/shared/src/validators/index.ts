import { z } from 'zod';

// User Validators
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be at most 50 characters')
});

export const updateUserSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  avatarUrl: z.string().url().optional(),
  status: z.enum(['online', 'offline', 'away', 'do_not_disturb']).optional()
});

// Workspace Validators
export const createWorkspaceSchema = z.object({
  name: z.string()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(50, 'Workspace name must be at most 50 characters'),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(30, 'Slug must be at most 30 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional()
});

// Channel Validators
export const createChannelSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
  name: z.string()
    .min(2, 'Channel name must be at least 2 characters')
    .max(50, 'Channel name must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Channel name can only contain lowercase letters, numbers, and hyphens'),
  type: z.enum(['public', 'private', 'direct', 'group']),
  description: z.string().max(500).optional(),
  topic: z.string().max(200).optional()
});

// Message Validators
export const createMessageSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID'),
  content: z.string()
    .min(1, 'Message content cannot be empty')
    .max(10000, 'Message content must be at most 10000 characters'),
  replyToId: z.string().uuid('Invalid reply-to ID').optional(),
  attachments: z.array(z.object({
    fileName: z.string(),
    fileSize: z.number().max(52428800, 'File size must be at most 50MB'),
    mimeType: z.string(),
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional()
  })).optional()
});

export const updateMessageSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  pinned: z.boolean().optional()
});

// Reaction Validators
export const createReactionSchema = z.object({
  emoji: z.string().min(1).max(50)
});

// Member Validators
export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['owner', 'admin', 'moderator', 'member', 'guest'])
});

// Search Validators
export const searchSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').max(200),
  type: z.enum(['message', 'user', 'channel', 'all']).optional(),
  workspaceId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).optional()
});

// Pagination Validators
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50)
});
