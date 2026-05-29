# XHub Architecture Documentation

## System Overview

XHub is a modern enterprise messaging platform built with a microservices-oriented monorepo architecture, designed for scalability, maintainability, and real-time collaboration.

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Realtime**: Socket.IO Client
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend
- **Framework**: NestJS
- **Language**: TypeScript
- **ORM**: Prisma
- **Authentication**: JWT + Passport
- **Realtime**: Socket.IO
- **Validation**: class-validator + Zod
- **API Documentation**: Swagger/OpenAPI

### Infrastructure
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Search**: Meilisearch 1.5
- **Queue**: BullMQ
- **Storage**: Cloudflare R2 / AWS S3
- **Monitoring**: Prometheus + Grafana
- **Error Tracking**: Sentry

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web App    │  │  Mobile App  │  │   Desktop    │      │
│  │  (Next.js)   │  │  (React Native)│ │ (Electron)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Load Balancer  │
                    │   (Nginx/ALB)   │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
     ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
     │ Frontend │      │  Backend  │     │  Backend  │
     │  Server  │      │ Instance 1│     │ Instance 2│
     │ (Next.js)│      │ (NestJS)  │     │ (NestJS)  │
     └────┬─────┘      └─────┬─────┘     └─────┬─────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
     ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
     │PostgreSQL│      │   Redis   │     │Meilisearch│
     │ Database │      │   Cache   │     │  Search   │
     └──────────┘      └───────────┘     └───────────┘
                             │
                    ┌────────▼────────┐
                    │  BullMQ Queues  │
                    │ (Notifications) │
                    │   (Emails)      │
                    │   (Media)       │
                    └─────────────────┘
                             │
                    ┌────────▼────────┐
                    │  File Storage   │
                    │  (R2/S3)        │
                    └─────────────────┘
```

## Module Structure

### Backend Modules

```
apps/backend/src/
├── auth/              # Authentication & Authorization
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── dto/
│   ├── strategies/
│   └── guards/
├── users/             # User Management
│   ├── users.module.ts
│   ├── users.service.ts
│   └── users.controller.ts
├── workspaces/        # Workspace Management
│   ├── workspaces.module.ts
│   ├── workspaces.service.ts
│   └── workspaces.controller.ts
├── channels/          # Channel Management
│   ├── channels.module.ts
│   ├── channels.service.ts
│   └── channels.controller.ts
├── messages/          # Message Handling
│   ├── messages.module.ts
│   ├── messages.service.ts
│   └── messages.controller.ts
├── websocket/         # Realtime Communication
│   ├── websocket.module.ts
│   └── gateway.module.ts
├── notifications/     # Notification System
│   ├── notifications.module.ts
│   ├── notifications.service.ts
│   └── notifications.controller.ts
├── search/            # Search Functionality
│   ├── search.module.ts
│   ├── search.service.ts
│   └── search.controller.ts
├── storage/           # File Storage
│   ├── storage.module.ts
│   └── storage.service.ts
├── queue/             # Background Jobs
│   ├── queue.module.ts
│   └── queue.service.ts
├── prisma/            # Database Client
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── main.ts            # Application Entry
└── app.module.ts      # Root Module
```

### Frontend Structure

```
apps/frontend/src/
├── app/               # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/
│   ├── dashboard/
│   └── globals.css
├── components/        # React Components
│   ├── theme-provider.tsx
│   ├── query-provider.tsx
│   └── socket-provider.tsx
├── lib/               # Utilities
│   ├── utils.ts
│   └── api.ts
├── store/             # State Management
│   ├── auth.store.ts
│   └── ui.store.ts
└── hooks/             # Custom Hooks
```

## Database Schema

### Core Tables

#### Users
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `username` (String, Unique)
- `password` (String, Hashed)
- `displayName` (String)
- `avatarUrl` (String, Optional)
- `status` (Enum: ONLINE, OFFLINE, AWAY, DO_NOT_DISTURB)
- `lastSeenAt` (DateTime)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

#### Workspaces
- `id` (UUID, Primary Key)
- `name` (String)
- `slug` (String, Unique)
- `description` (String, Optional)
- `avatarUrl` (String, Optional)
- `ownerId` (UUID, Foreign Key)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

#### Channels
- `id` (UUID, Primary Key)
- `workspaceId` (UUID, Foreign Key)
- `name` (String)
- `type` (Enum: PUBLIC, PRIVATE, DIRECT, GROUP)
- `description` (String, Optional)
- `topic` (String, Optional)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

#### Messages
- `id` (UUID, Primary Key)
- `channelId` (UUID, Foreign Key)
- `userId` (UUID, Foreign Key)
- `content` (String)
- `replyToId` (UUID, Foreign Key, Optional)
- `pinned` (Boolean)
- `editedAt` (DateTime, Optional)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

#### MessageReactions
- `id` (UUID, Primary Key)
- `messageId` (UUID, Foreign Key)
- `userId` (UUID, Foreign Key)
- `emoji` (String)
- `createdAt` (DateTime)

#### MessageAttachments
- `id` (UUID, Primary Key)
- `messageId` (UUID, Foreign Key)
- `fileName` (String)
- `fileSize` (Integer)
- `mimeType` (String)
- `url` (String)
- `thumbnailUrl` (String, Optional)
- `createdAt` (DateTime)

#### WorkspaceMembers
- `id` (UUID, Primary Key)
- `workspaceId` (UUID, Foreign Key)
- `userId` (UUID, Foreign Key)
- `role` (Enum: OWNER, ADMIN, MODERATOR, MEMBER, GUEST)
- `joinedAt` (DateTime)

#### Notifications
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `type` (Enum: MESSAGE, MENTION, REACTION, CHANNEL_INVITE, WORKSPACE_INVITE)
- `title` (String)
- `body` (String)
- `data` (JSON)
- `read` (Boolean)
- `createdAt` (DateTime)

#### RefreshTokens
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `token` (String, Unique)
- `expiresAt` (DateTime)
- `createdAt` (DateTime)

#### AuditLogs
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key, Optional)
- `action` (String)
- `entityType` (String)
- `entityId` (String)
- `changes` (JSON, Optional)
- `ipAddress` (String, Optional)
- `userAgent` (String, Optional)
- `createdAt` (DateTime)

## API Design

### REST Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

#### Users
- `GET /api/users/me` - Get current user profile
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/username/:username` - Get user by username
- `PUT /api/users/me` - Update current user profile
- `GET /api/users/search/:query` - Search users

#### Workspaces
- `GET /api/workspaces` - Get all user workspaces
- `GET /api/workspaces/:id` - Get workspace by ID
- `GET /api/workspaces/slug/:slug` - Get workspace by slug
- `POST /api/workspaces` - Create new workspace
- `PUT /api/workspaces/:id` - Update workspace
- `POST /api/workspaces/:id/members` - Add member to workspace
- `DELETE /api/workspaces/:id/members/:userId` - Remove member from workspace

#### Channels
- `GET /api/channels/workspace/:workspaceId` - Get channels by workspace
- `GET /api/channels/:id` - Get channel by ID
- `POST /api/channels` - Create new channel
- `PUT /api/channels/:id` - Update channel
- `DELETE /api/channels/:id` - Delete channel

#### Messages
- `GET /api/messages/channel/:channelId` - Get messages by channel
- `GET /api/messages/:id` - Get message by ID
- `POST /api/messages` - Create new message
- `PUT /api/messages/:id` - Update message
- `DELETE /api/messages/:id` - Delete message
- `POST /api/messages/:id/reactions` - Add reaction to message
- `DELETE /api/messages/:id/reactions/:emoji` - Remove reaction from message
- `POST /api/messages/:id/pin` - Pin message
- `DELETE /api/messages/:id/pin` - Unpin message

#### Notifications
- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/unread-count` - Get unread notification count
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read
- `DELETE /api/notifications/:id` - Delete notification

#### Search
- `GET /api/search` - Search across all content
- `GET /api/search/messages` - Search messages
- `GET /api/search/users` - Search users
- `GET /api/search/channels` - Search channels

### WebSocket Events

#### Client → Server
- `authenticate` - Authenticate connection
- `join_channel` - Join a channel
- `leave_channel` - Leave a channel
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `message_read` - Mark message as read

#### Server → Client
- `message_sent` - New message sent
- `message_updated` - Message updated
- `message_deleted` - Message deleted
- `message_pinned` - Message pinned
- `reaction_added` - Reaction added
- `reaction_removed` - Reaction removed
- `typing_start` - User started typing
- `typing_stop` - User stopped typing
- `presence_update` - User presence updated
- `user_online` - User came online
- `user_offline` - User went offline
- `notification` - New notification
- `message_read` - Message read receipt

## Realtime Architecture

### WebSocket Communication Flow

```
Client                Gateway              Service              Database
  │                      │                   │                    │
  ├─ authenticate ──────►│                   │                    │
  │◄─ auth_success ──────┤                   │                    │
  │                      │                   │                    │
  ├─ join_channel ──────►│                   │                    │
  │                      ├─ validate ──────►│                    │
  │                      │◄─ valid ──────────┤                    │
  │◄─ joined ────────────┤                   │                    │
  │                      │                   │                    │
  ├─ send_message ──────►│                   │                    │
  │                      ├─ process ────────►│                    │
  │                      │                   ├─ save ────────────►│
  │                      │                   │◄─ saved ───────────┤
  │                      │◄─ message ─────────┤                    │
  │◄─ message_sent ──────┤                   │                    │
  │                      │                   │                    │
  │                      ├─ broadcast ──────►│  Redis Pub/Sub     │
  │                      │                   │                    │
  │◄─ message_sent ──────┤◄─────────────────┤                    │
  │                      │                   │                    │
```

### Redis Pub/Sub for Scaling

When using multiple backend instances, Redis Pub/Sub is used to broadcast messages:

1. **Message Publishing**: When a message is sent, it's published to a Redis channel
2. **Message Subscription**: All backend instances subscribe to relevant channels
3. **Broadcasting**: When a message is received from Redis, it's broadcasted to connected clients

## Security Architecture

### Authentication Flow

```
1. User Registration
   └─> Client sends: email, username, password, displayName
   └─> Server validates input
   └─> Server hashes password (bcrypt)
   └─> Server creates user in database
   └─> Server generates JWT tokens
   └─> Server returns: user, accessToken, refreshToken

2. User Login
   └─> Client sends: email, password
   └─> Server validates credentials
   └─> Server generates JWT tokens
   └─> Server returns: user, accessToken, refreshToken

3. Token Refresh
   └─> Client sends: refreshToken
   └─> Server validates refresh token
   └─> Server generates new access token
   └─> Server returns: accessToken, refreshToken

4. Protected Route Access
   └─> Client sends: accessToken in Authorization header
   └─> Server validates JWT
   └─> Server extracts user info
   └─> Server grants/denies access
```

### Authorization (RBAC)

Roles hierarchy:
- **OWNER**: Full access to workspace
- **ADMIN**: Can manage members and channels
- **MODERATOR**: Can moderate messages
- **MEMBER**: Can read and write messages
- **GUEST**: Read-only access

### Security Measures

1. **Password Security**
   - bcrypt hashing with salt rounds
   - Minimum 8 characters with complexity requirements

2. **JWT Security**
   - Short-lived access tokens (15 minutes)
   - Long-lived refresh tokens (7 days)
   - Token rotation on refresh

3. **Rate Limiting**
   - 100 requests per minute per IP
   - Stricter limits for auth endpoints

4. **Input Validation**
   - Zod schemas for API validation
   - class-validator for DTO validation
   - SQL injection prevention via Prisma

5. **CORS Configuration**
   - Restricted to allowed origins
   - Credentials support for cookies

## Performance Optimization

### Database Optimization

1. **Indexing**
   - Primary keys on all tables
   - Unique constraints on email, username
   - Composite indexes on foreign keys
   - Indexes on frequently queried fields

2. **Query Optimization**
   - Use select to limit returned fields
   - Implement pagination (cursor-based)
   - Use connection pooling

3. **Caching Strategy**
   - Redis for session storage
   - Redis for frequently accessed data
   - Cache invalidation on updates

### Frontend Optimization

1. **Code Splitting**
   - Route-based code splitting
   - Dynamic imports for heavy components

2. **State Management**
   - Zustand for global state
   - TanStack Query for server state
   - Local state for component state

3. **Rendering Optimization**
   - React.memo for component memoization
   - useMemo/useCallback for expensive computations
   - Virtual scrolling for long lists

4. **Asset Optimization**
   - Image optimization via Next.js
   - Lazy loading for images
   - CDN for static assets

### Backend Optimization

1. **Response Optimization**
   - Compression middleware
   - Minify JSON responses
   - HTTP/2 support

2. **Request Processing**
   - Async processing for heavy operations
   - Queue for background jobs
   - Batch processing for bulk operations

## Monitoring & Observability

### Metrics Collected

1. **Application Metrics**
   - Request count and duration
   - Error rate and type
   - Active WebSocket connections
   - Queue processing time

2. **Database Metrics**
   - Query execution time
   - Connection pool usage
   - Slow query log

3. **Infrastructure Metrics**
   - CPU and memory usage
   - Disk I/O
   - Network throughput

### Logging Strategy

1. **Structured Logging**
   - JSON format for easy parsing
   - Log levels: DEBUG, INFO, WARN, ERROR
   - Contextual information (userId, requestId)

2. **Log Aggregation**
   - Centralized log collection
   - Log retention policy
   - Log analysis and alerting

### Error Tracking

1. **Sentry Integration**
   - Automatic error capture
   - Stack trace collection
   - User context tracking
   - Release tracking

## Scalability Strategy

### Horizontal Scaling

1. **Stateless Backend**
   - No session state in memory
   - JWT for authentication
   - Redis for shared state

2. **Load Balancing**
   - Round-robin distribution
   - Health checks
   - Automatic failover

3. **Database Scaling**
   - Read replicas for read-heavy workloads
   - Connection pooling
   - Query optimization

### Vertical Scaling

1. **Resource Allocation**
   - CPU-optimized for API servers
   - Memory-optimized for cache servers
   - Storage-optimized for database servers

2. **Auto-scaling**
   - Scale based on CPU/memory metrics
   - Scale based on request queue
   - Scale based on WebSocket connections

## Future Enhancements

### AI Integration
- Message summarization
- Smart replies
- Semantic search
- Action extraction
- Productivity insights

### Advanced Features
- Video conferencing
- Screen sharing
- Voice messages
- File collaboration
- Integrations (GitHub, Jira, etc.)

### Enterprise Features
- SSO integration
- Advanced analytics
- Custom branding
- SLA guarantees
- Dedicated support
