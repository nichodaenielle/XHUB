# RECAP Messaging Platform (XHUB)

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

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## License

MIT
