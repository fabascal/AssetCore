# AssetCore — Production deployment guide

## Prerequisites

- VPS with Docker and Docker Compose v2
- Domain pointing to the server (for HTTPS)
- Strong secrets (see [`.env.prod.example`](../.env.prod.example))

Generate secrets:

```bash
openssl rand -base64 48   # JWT_SECRET, REFRESH_TOKEN_SECRET, WEBHOOK_SECRET
```

## First deploy

```bash
cd AssetCore
cp .env.prod.example .env.prod
# Edit .env.prod — fill POSTGRES_PASSWORD, JWT_SECRET, REFRESH_TOKEN_SECRET, WEBHOOK_SECRET
# DATABASE_URL must use host "postgres" (not 127.0.0.1)
# CORS_ORIGIN must match the public URL (e.g. http://YOUR_IP:4040)

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Stack (Fase 3):

| Servicio | Imagen | Expuesto |
|----------|--------|----------|
| postgres | postgres:16-alpine | No (solo red interna) |
| backend | `backend/Dockerfile` | No (nginx hace proxy) |
| nginx | `infra/nginx/Dockerfile` | `${NGINX_HTTP_PORT:-80}` → 80 |

Wait until services are healthy:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
curl -s http://localhost:4040/api/health
# → {"status":"ok","db":"ok"}
```

Create the first admin (one time):

```bash
docker compose -f docker-compose.prod.yml exec \
  -e ADMIN_EMAIL=admin@yourcompany.com \
  -e ADMIN_PASSWORD='YourStrongPassword123' \
  -e ADMIN_FULL_NAME='Administrador' \
  backend node dist/scripts/create-admin.js
```

Configure TLS — see [`infra/nginx/README.md`](../infra/nginx/README.md).

## Updates (rolling deploy)

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Migrations run automatically on backend container start via [`backend/scripts/migrate-deploy.sh`](../backend/scripts/migrate-deploy.sh).

## Backup

```bash
chmod +x infra/scripts/backup-db.sh
./infra/scripts/backup-db.sh ./backups
```

Restore:

```bash
gunzip -c backups/assetcore_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i assetcore-postgres psql -U assetcore assetcore
```

## Pre-go-live checklist

### Security

- [ ] `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `WEBHOOK_SECRET` are random (not example values)
- [ ] `COOKIE_SECURE=true` and HTTPS enabled
- [ ] Login works over HTTPS
- [ ] Webhook rejects requests without `X-Webhook-Secret`
- [ ] No public access to Postgres (port 5432 not exposed on host)
- [ ] Rate limit on login returns 429 after repeated failures
- [ ] Admin password is strong; no default `admin123` user in production DB
- [ ] `.env.prod` is not committed to git

### Functional

- [ ] `docker compose -f docker-compose.prod.yml up --build` succeeds
- [ ] Login, CRUD activos, import CSV, reportes, dashboard financiero
- [ ] ITAM catalog configured (tipos, ubicaciones, marcas)

### Operations

- [ ] Backup script tested; restore verified on staging
- [ ] `uploads_data` Docker volume persists custody/ticket files
- [ ] `GET /api/health` returns `{"status":"ok","db":"ok"}`
- [ ] Logs: `docker compose -f docker-compose.prod.yml logs -f backend`

## Development vs production

| | Development | Production |
|---|-------------|------------|
| Compose file | `docker-compose.yml` | `docker-compose.prod.yml` |
| DB seed | `01_schema_rbac.sql` + `02_seed_dev.sql` | `01_schema_rbac.sql` only |
| Demo users | `admin@assetcore.local` / `admin123` | Created via `create-admin.ts` |
| API | Vite dev + nodemon | nginx + compiled Node |

## Secret rotation

1. Generate new `JWT_SECRET` / `REFRESH_TOKEN_SECRET`
2. Update `.env.prod` and restart backend
3. All users must log in again (refresh tokens invalidated on secret change if you also truncate `refresh_tokens`)

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Backend exits on start | `docker logs assetcore-backend` — env validation errors in production |
| 403 CORS | `CORS_ORIGIN` must match exact browser origin (scheme + host) |
| Cookies not set | `COOKIE_SECURE=true` requires HTTPS; `COOKIE_DOMAIN` must match site domain |
| 401 webhook | Send header `X-Webhook-Secret: <WEBHOOK_SECRET>` |

See also [`docs/DATABASE.md`](DATABASE.md).
