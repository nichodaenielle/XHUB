# RECAP Messaging Platform

A production-grade, enterprise-ready realtime team messaging service for RECAP organizations. Powers group discussions, private messages, presence, and notifications—integrated with RECAP tenants and departments.

## Architecture

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS, Framer Motion, Zustand, TanStack Query
- **Backend**: NestJS, TypeScript, Modular Architecture, Clean Architecture
- **Database**: PostgreSQL with Prisma ORM
- **Realtime**: Socket.IO with Redis Pub/Sub
- **Cache & Queue**: Redis with BullMQ
- **File Storage**: Cloudflare R2 / AWS S3
- **Search**: Meilisearch
- **Monitoring**: Sentry, Prometheus, Grafana

## Features

- Realtime messaging with WebSocket support
- Private messages and group discussions
- Message threading, reactions, and editing
- Online presence and typing indicators
- File uploads with CDN support
- Advanced search with semantic indexing
- Role-based access control (RBAC)
- Multi-tenant architecture
- Mobile-responsive design
- Dark/light mode support

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+
- Meilisearch 1.5+

### Installation

```bash
# Install dependencies
pnpm install

# Start infrastructure services
docker-compose up -d

# Run database migrations
pnpm db:migrate

# Seed database (optional)
pnpm db:seed

# Start development servers
pnpm dev
```

### Services

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- WebSocket: ws://localhost:3001
- Meilisearch: http://localhost:7700

## Project Structure

```
xhub/
├── apps/
│   ├── frontend/          # Next.js frontend application
│   └── backend/           # NestJS backend application
├── packages/
│   ├── shared/            # Shared TypeScript types and utilities
│   ├── ui/                # Shared UI components
│   └── config/            # Shared configuration
├── docker-compose.yml     # Infrastructure services
└── turbo.json            # Turborepo configuration
```

## Development

```bash
# Run all services in development mode
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

## RECAP integration (production)

RECAP tenants map to **workspaces**. The API runs on port **3001** behind Cloudflare (`xhub.cpu-crums.com` → `127.0.0.1:3001`).

### Channel types

| Slug pattern | Access | Source |
|--------------|--------|--------|
| `general`, `announcements` | All workspace members | Auto on tenant sync |
| `event-reminders` | All workspace members | Read-only: RECAP posts upcoming events; members **Acknowledge** (✅ reaction), no chat |
| `dept-*` | All workspace members | RECAP departments |
| `sg-{id}` | **Channel members only** (PRIVATE) | RECAP subject groups (class sections) |
| `dm:*` | DM participants only | User-initiated |

Section channels (`sg-*`) sync instructors, enrolled students (with RECAP login), and tenant admins/staff from RECAP webhooks and `GET /api/messaging/tenants/{id}/subject-groups`.

### PM2 (Windows server)

```powershell
cd D:\STGNG\XHUB
npm run build:backend
.\scripts\start-backend.ps1    # migration + PM2 start/restart
npm run pm2:status
```

Or manually:

```powershell
npm run db:apply-channel-members   # first deploy / after pull
npm run build:backend
npm run pm2:restart
```

### Environment (`apps/backend/.env`)

| Variable | Purpose |
|----------|---------|
| `RECAP_API_URL` | Server-to-server base (e.g. `http://127.0.0.1` with `RECAP_API_HOST`) |
| `RECAP_API_HOST` | Host header for Laravel vhost (`recap.cpu-crums.com`) |
| `RECAP_API_SECRET` | Must match RECAP `XHUB_API_SECRET` |
| `RECAP_WEBHOOK_SECRET` | Verify RECAP → XHUB webhooks |

### Messaging UI

The end-user messaging experience is embedded in **RECAP** at `/messaging` (`RECAP/resources/js/components/Messaging/`, styles in `RECAP/resources/css/messaging.css`). This repo provides the API, realtime gateway, and sync logic.

### Docs

- [RECAP ↔ messaging integration plan](./docs/recap-messaging-integration-plan.md)
- [Messaging terminology](./docs/messaging-terminology.md)

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## License

MIT
