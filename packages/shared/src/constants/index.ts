// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

// File Upload
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

// WebSocket
export const WS_RECONNECT_DELAY = 1000;
export const WS_RECONNECT_ATTEMPTS = 5;
export const WS_HEARTBEAT_INTERVAL = 30000;

// Cache
export const CACHE_TTL = 3600; // 1 hour
export const PRESENCE_TTL = 300; // 5 minutes

// Rate Limiting
export const RATE_LIMIT_WINDOW = 60; // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 100;

// Message
export const MAX_MESSAGE_LENGTH = 10000;
export const MAX_MESSAGE_EDIT_TIME = 15 * 60 * 1000; // 15 minutes

// Presence
export const AWAY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
export const OFFLINE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
