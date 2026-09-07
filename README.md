# AssetCore

Plataforma ITAM + Mesa de Ayuda con:
- Backend `Node.js + Express + Prisma + PostgreSQL`
- Frontend `React + Vite + Tailwind`
- Contenedores con `docker-compose`

## Requisitos

- Docker + Docker Compose
- (Opcional) `jq` para scripts de validacion

## Desarrollo local

Desde la raiz `AssetCore`:

```bash
docker-compose up --build
```

Servicios:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`
- PostgreSQL: `localhost:5432` (solo dev)
- Redis: `localhost:6379` (solo dev)

### Credenciales de desarrollo

Solo aplican cuando se usa `docker-compose.yml` con seed [`02_seed_dev.sql`](infra/postgres/init/02_seed_dev.sql):

| Rol | Email | Password |
|-----|-------|----------|
| Admin | `admin@combu-express.com.mx` | `admin123` |
| Tecnico | `rvazquez@combu-express.com.mx` | `tecnico123` |

**No uses estas credenciales en produccion.**

## Produccion

Ver [`docs/PRODUCTION.md`](docs/PRODUCTION.md) y [`.env.prod.example`](.env.prod.example).

```bash
cp .env.prod.example .env.prod
# Completar secretos y CORS_ORIGIN
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Acceso: `http://TU_IP:4040` (puerto configurable con `NGINX_HTTP_PORT` en `.env.prod`).

## Datos iniciales (desarrollo)

- [`01_schema_rbac.sql`](infra/postgres/init/01_schema_rbac.sql) — schema, roles, menus
- [`02_seed_dev.sql`](infra/postgres/init/02_seed_dev.sql) — usuarios y activos demo

## Migraciones

Ver [`docs/DATABASE.md`](docs/DATABASE.md).

## Pruebas rapidas API

Usa `api_tests.http` o:

```bash
cd backend
./scripts/verify-ai-flow.sh
WEBHOOK_SECRET=tu_secreto ./scripts/test-webhook.sh
```
