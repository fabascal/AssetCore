# AssetCore

Plataforma ITAM + Mesa de Ayuda con:
- Backend `Node.js + Express + Prisma + PostgreSQL`
- Frontend `React + Vite + Tailwind`
- Contenedores con `docker-compose`

## Requisitos

- Docker + Docker Compose
- (Opcional) `jq` para scripts de validacion

## Levantar proyecto

Desde la raiz `AssetCore`:

```bash
docker-compose down -v && docker-compose up --build
```

Servicios:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Credenciales seed

- Admin:
  - Email: `admin@assetcore.local`
  - Password: `admin123`
- Tecnico Nivel 1:
  - Email: `tecnico.n1@assetcore.local`
  - Password: `tecnico123`

## Datos iniciales

El script SQL de init carga:
- Roles, permisos y menus dinamicos
- 5 activos de prueba (Dell, HP, Cisco, etc.)
- Tickets y eventos base
- Logs preparados para flujo AI/Webhooks

Archivo: `infra/postgres/init/01_init_rbac.sql`

## Pruebas rapidas API

### Opcion 1: REST Client (Cursor/VS Code)

Usa `api_tests.http` para:
- Login
- Listar activos
- Crear ticket
- Simular webhook

### Opcion 2: Script E2E AI

```bash
cd backend
./scripts/verify-ai-flow.sh
```

Este script:
- Ejecuta 3 casos webhook
- Hace login admin
- Consulta `/api/ai-logs`
- Muestra resumen:
  - Total mensajes
  - Tickets creados por IA
  - Mensajes sin match tecnico

## Script adicional de simulacion webhook

```bash
cd backend
./scripts/test-webhook.sh
```

## Notas de operacion

- Webhook publico de entrada: `POST /api/webhooks/incoming`
- Monitor de logs IA (admin): `GET /api/ai-logs`
- Vista frontend de logs permite crear ticket manual cuando no hay match automatico.
