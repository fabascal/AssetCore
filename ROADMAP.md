# Roadmap: Sistema Integral CRM + ITAM + HelpDesk

Nombre : AssetCore

## 📌 Visión General
Desarrollo de una plataforma unificada para gestión de proyectos (Gantt), control de activos (ITAM) con QR y Mesa de Ayuda multinivel.
**Stack:** Ubuntu Server, Docker, PostgreSQL, Node.js, React.
**Estética:** Basada en plantillas HTML existentes (Ruta: `./ejemplos`) con filosofía de diseño de Kevin Powell.

> **Última validación:** 18 de marzo de 2026 — **15/18 items completados (83%)**, 1 parcial, 2 pendientes.

---

## 🚀 Fase 1: Infraestructura y Base de Datos (Core)
* [x] **Setup Docker Compose:** Contenedores para PostgreSQL 16-alpine, Backend Node.js (puerto 4000), Frontend React/Vite (puerto 5173) y Redis 7-alpine. Healthchecks y volúmenes persistentes configurados.
* [x] **Diseño SQL (RBAC & Menús):**
    * Tablas: `users`, `roles`, `permissions`, `role_permissions`.
    * Tabla `menus`: Estructura dinámica con `label`, `icon`, `path`, `parentId`, `displayOrder`, `requiredPermission`.
    * Tabla `role_menus`: Asignación explícita de menús y submenús por rol.
    * Seed data: 2 roles (admin, tech), 12 permisos, 10+ menús, 2 usuarios.
* [x] **Migraciones Iniciales (ITAM):** Tabla `assets` con `asset_code`, `brand`, `model`, `serialNumber`, `status`, `specifications` (JSON). Tablas de tickets, eventos, adjuntos, comentarios, temas de soporte, SLA y escalación.
* [x] **Tablas de Proyectos/Gantt:** Tablas `projects`, `project_tasks` y `task_dependencies` con enums (`project_status`, `gantt_task_status`, `dependency_type`). CRUD completo en `/api/projects` con tareas anidadas, dependencias, asignación de usuario y vínculo a activos. Permisos `projects.read` / `projects.write`.

## 🛠️ Fase 2: Backend & Seguridad (Node.js)
* [x] **Auth System:** JWT con roles en payload (`sub`, `email`, `roleId`, `role`). Passwords hasheados con bcryptjs. Expiración: 8h.
* [x] **Hardening de Sesión (Producción):** Migrar de `localStorage` a cookies `HttpOnly` + `Secure` + `SameSite`, con refresh token rotatorio y endpoint de logout. Access token 15min + refresh token 7 días con rotación por familia. Endpoints: `POST /auth/refresh`, `POST /auth/logout`.
* [x] **Middleware de Autorización:** `auth.middleware.ts` (Bearer token) + `permission.middleware.ts` (`checkPermission("code")`).
* [x] **Endpoint de Menú Dinámico:** `GET /api/menus/me` retorna árbol de navegación filtrado por rol del usuario.
* [x] **CRUD de Activos:** Create, Read, Update, Delete en `/api/assets`. Soporte de `specifications` JSON. Historial vía tickets y eventos asociados.

## 🎨 Fase 3: Frontend & Diseño (React + Cursor AI)
* [x] **Arquitectura de Componentes:** 11 componentes funcionales: Sidebar, DashboardCards, AssetsTable, AssetDetail, AssetForm, TicketsView, TicketForm, HelpdeskConfigView, UsersManagement, UserPreferences, AiLogsView. Design system con Tailwind (colores, sombras, animaciones personalizadas), iconos lucide-react, fuente Inter.
* [x] **Sidebar Dinámico:** Consume `/api/menus/me`. Navegación jerárquica con submenús colapsables, modo compacto, overlay móvil, sección de usuario con avatar e iniciales.
* [x] **Vistas de ITAM:** Tabla de activos con búsqueda, filtros por estado (AVAILABLE, ASSIGNED, MAINTENANCE, SCRAP), badges de colores, acentos de urgencia. Dashboard con KPIs (total activos, tickets abiertos, mantenimiento, proveedor).
* [x] **Diagrama de Gantt:** Componente `ProjectsView` con vista de lista de proyectos y diagrama Gantt interactivo (panel izquierdo de tareas + panel derecho con barras de timeline). CRUD completo de proyectos, tareas y dependencias. Filtro de ruta crítica, tooltips, hitos, progreso visual, scroll sincronizado. Sin dependencias externas (React + Tailwind puro). Menú "Proyectos" con icono `gantt-chart` visible para admin y tech.

## 📱 Fase 4: Funcionalidades Especiales (QR & Térmica)
* [x] **Generador de QR:** Endpoint `GET /api/assets/:id/qr` genera PNG con librería `qrcode`. Frontend muestra QR en detalle del activo con opción de impresión de etiqueta (50mm x 25mm).
* [ ] **Módulo de Impresión Térmica:** Integración con protocolos ESC/POS para impresoras térmicas. *(Pendiente)*
* [ ] **PWA Setup:** Configurar Service Workers, manifest.json y cámara como escáner QR. *(Pendiente)*

## 🤖 Fase 5: IA & Omnicanalidad (Fase Avanzada)
* [x] **Webhooks:** Endpoint `POST /api/webhooks/incoming` (sin auth). Soporta WhatsApp (Twilio), Email y canal genérico. Almacena en tabla `incoming_messages`. Dependencia: Twilio v5.4.2.
* [x] **Integración LLM:** Agente OpenAI (`agent.service.ts`) que analiza mensajes, clasifica intención (CREATE_TICKET, QUERY_STATUS, REPORT_FAILURE, UNKNOWN), extrae `assetCode`/`serialNumber` vía regex + LLM, y crea tickets automáticamente. Fallback heurístico si OpenAI falla.
* [~] **Lógica de Escalación:** Tablas `sla_policies` y `ticket_escalation_tracking` con reglas por prioridad. Transiciones manuales implementadas (OPEN → IN_PROGRESS → PROVIDER → CLOSED / CANCELLED, + REOPEN). *(Parcial — falta cron/worker para escalación automática por SLA)*

---

## ✅ Funcionalidades adicionales (fuera de roadmap original)

| Característica | Estado | Descripción |
|---|---|---|
| Mesa de Ayuda multinivel | ✅ | Temas de soporte con N niveles, asignación TECH/PROVIDER por nivel |
| Tickets: comentarios | ✅ | Conversación en tiempo real por ticket |
| Tickets: adjuntos | ✅ | Upload de archivos vía multer (imágenes, PDF, max 10MB) |
| Tickets: eventos (audit) | ✅ | Línea de tiempo con acciones y actores |
| Tickets: máquina de estados | ✅ | OPEN → IN_PROGRESS → PROVIDER → CLOSED / CANCELLED + REOPEN |
| Visor de Logs IA | ✅ | Tabla de mensajes entrantes con intent, detección y acción manual |
| Modo oscuro | ✅ | Toggle claro/oscuro con ThemeContext persistente |
| Avatar por upload | ✅ | Subida de imagen (base64, max 2MB) almacenada en localStorage |
| Perfil y preferencias | ✅ | Edición de nombre, correo, contraseña, avatar y tema en modal |
| Dashboard KPIs | ✅ | Total activos, tickets abiertos, en mantenimiento, enviados a proveedor |
| UI modernizada | ✅ | Design system: shadow-card, animate-fade-in/slide-in/scale-in, rounded-2xl, iconos lucide-react en todo el sistema |

---

## 📊 Estado general

```
Fase 1 — Infraestructura   █████████████████████ 100%  ✅ Completada
Fase 2 — Backend            ████████████████████ 100%  ✅ Completada
Fase 3 — Frontend           █████████████████████ 100%  ✅ Completada
Fase 4 — QR & Térmica       ██████░░░░░░░░░░░░░░  33%  (QR listo; falta ESC/POS y PWA)
Fase 5 — IA & Omnicanal     ████████████████░░░░  83%  (falta cron de escalación)
```

---
