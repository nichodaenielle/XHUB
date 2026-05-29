# XHub Deployment Guide

This guide covers deploying XHub to production environments.

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Meilisearch 1.5+
- Cloudflare R2 or AWS S3 account (for production)

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd xhub

# Install dependencies
pnpm install
```

### 2. Environment Configuration

Copy the example environment files:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
```

Update the environment variables with your configuration.

### 3. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, Meilisearch, Minio
docker-compose up -d
```

### 4. Database Setup

```bash
# Run database migrations
cd apps/backend
pnpm db:migrate

# (Optional) Seed database with sample data
pnpm db:seed
```

### 5. Start Development Servers

```bash
# Start all services (frontend + backend)
pnpm dev
```

The services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api/docs
- Meilisearch: http://localhost:7700
- Minio Console: http://localhost:9001

## Production Deployment

### Option 1: Docker Deployment

#### Build Docker Images

```bash
# Build backend
docker build -t xhub-backend ./apps/backend

# Build frontend
docker build -t xhub-frontend ./apps/frontend
```

#### Docker Compose Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  backend:
    image: xhub-backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=${REDIS_HOST}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis

  frontend:
    image: xhub-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=${API_URL}
      - NEXT_PUBLIC_WS_URL=${WS_URL}
    depends_on:
      - backend

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Run with:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Kubernetes Deployment

#### Backend Deployment

Create `k8s/backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xhub-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: xhub-backend
  template:
    metadata:
      labels:
        app: xhub-backend
    spec:
      containers:
      - name: backend
        image: xhub-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: xhub-secrets
              key: database-url
        - name: REDIS_HOST
          value: "redis-service"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: xhub-secrets
              key: jwt-secret
---
apiVersion: v1
kind: Service
metadata:
  name: xhub-backend
spec:
  selector:
    app: xhub-backend
  ports:
  - port: 3001
    targetPort: 3001
  type: LoadBalancer
```

#### Frontend Deployment

Create `k8s/frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xhub-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: xhub-frontend
  template:
    metadata:
      labels:
        app: xhub-frontend
    spec:
      containers:
      - name: frontend
        image: xhub-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          value: "https://api.xhub.com"
        - name: NEXT_PUBLIC_WS_URL
          value: "wss://api.xhub.com"
---
apiVersion: v1
kind: Service
metadata:
  name: xhub-frontend
spec:
  selector:
    app: xhub-frontend
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer
```

Apply with:

```bash
kubectl apply -f k8s/
```

### Option 3: Cloud Deployment (AWS/GCP/Azure)

#### AWS Deployment

1. **Backend (ECS/Fargate)**
   - Build and push Docker image to ECR
   - Create ECS task definition
   - Deploy to ECS cluster
   - Configure ALB for load balancing

2. **Frontend (S3 + CloudFront)**
   - Build Next.js static export
   - Upload to S3 bucket
   - Configure CloudFront CDN
   - Set up custom domain with Route53

3. **Database (RDS)**
   - Create PostgreSQL RDS instance
   - Configure security groups
   - Update environment variables

4. **Redis (ElastiCache)**
   - Create Redis cluster
   - Configure security groups

5. **Storage (S3)**
   - Create S3 bucket for file uploads
   - Configure CORS policy
   - Set up CloudFront CDN

#### Environment Variables

Required production environment variables:

```bash
# Backend
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_HOST=redis-host
REDIS_PORT=6379
JWT_SECRET=your-production-secret
JWT_REFRESH_SECRET=your-refresh-secret
STORAGE_ENDPOINT=s3.amazonaws.com
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
STORAGE_BUCKET=xhub-uploads
MEILISEARCH_HOST=https://meilisearch.xhub.com
MEILISEARCH_API_KEY=your-meilisearch-key

# Frontend
NEXT_PUBLIC_API_URL=https://api.xhub.com
NEXT_PUBLIC_WS_URL=wss://api.xhub.com
```

## Monitoring & Observability

### Prometheus Metrics

The backend exposes metrics at `/metrics`. Configure Prometheus to scrape:

```yaml
scrape_configs:
  - job_name: 'xhub-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
```

### Grafana Dashboards

Import the provided dashboard configurations for:
- API latency
- WebSocket connections
- Queue processing
- Database performance

### Sentry Error Tracking

Configure Sentry in backend:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

## Scaling Considerations

### Horizontal Scaling

- Backend: Deploy multiple instances behind a load balancer
- Frontend: Deploy multiple instances with CDN
- Database: Use read replicas for read-heavy workloads
- Redis: Use Redis Cluster for horizontal scaling

### WebSocket Scaling

For WebSocket scaling with multiple backend instances:
- Use Redis Pub/Sub for message broadcasting
- Configure sticky sessions if using socket.io
- Consider using a WebSocket gateway service

### Database Optimization

- Add proper indexes based on query patterns
- Use connection pooling (PgBouncer)
- Enable query caching
- Monitor slow queries

## Security Best Practices

1. **Environment Variables**: Never commit secrets to git
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Configure appropriate rate limits
4. **CORS**: Restrict CORS to trusted domains
5. **Input Validation**: Validate all user inputs
6. **SQL Injection**: Use parameterized queries (Prisma handles this)
7. **XSS**: Sanitize user-generated content
8. **CSRF**: Implement CSRF protection for state-changing operations

## Backup Strategy

### Database Backups

```bash
# Automated daily backups
0 2 * * * pg_dump -U user dbname > /backups/db_$(date +\%Y\%m\%d).sql
```

### Redis Backups

```bash
# Enable RDB snapshots in redis.conf
save 900 1
save 300 10
save 60 10000
```

### File Storage Backups

- Enable versioning on S3/R2 buckets
- Configure cross-region replication
- Regular backup to cold storage

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install pnpm
        uses: pnpm/action-setup@v2
      - name: Install dependencies
        run: pnpm install
      - name: Run tests
        run: pnpm test
      - name: Build
        run: pnpm build
      - name: Deploy to production
        run: ./deploy.sh
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify database is accessible
   - Check firewall rules

2. **WebSocket Connection Issues**
   - Verify WS_URL is correct
   - Check firewall allows WebSocket traffic
   - Ensure Redis is running for Pub/Sub

3. **File Upload Failures**
   - Verify storage credentials
   - Check bucket permissions
   - Ensure CORS is configured

4. **Search Not Working**
   - Verify Meilisearch is running
   - Check API key
   - Ensure documents are indexed

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: [docs-url]
- Email: support@xhub.com
