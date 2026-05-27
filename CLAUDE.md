# CLAUDE.md — CoWork App para Reservas

Documento de referencia para Claude Code. Describe el estado actual del proyecto, convenciones, decisiones de arquitectura y trabajo acumulado.

---

## Descripcion del proyecto

App full-stack de agendamiento de maquinas textiles para centros productivos de cowork. Las usuarias reservan maquinas de coser, bordadoras, plotters, planchas, etc. El sistema gestiona multiples espacios (centros productivos), categorias de maquinas dinamicas por espacio, certificaciones por categoria, aprobacion de usuarias nuevas, y sincronizacion opcional con Google Calendar.

**Fecha de inicio:** febrero 2026
**Estado actual:** desplegado en produccion — Render (backend + SPA) + Neon (PostgreSQL)

---

## Stack tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Calendario | FullCalendar |
| Estado global | Zustand |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL |
| ORM | Prisma (schema en `/prisma/`, client en `server/node_modules/.prisma/client`) |
| Autenticacion | JWT + bcrypt |
| Logger | pino + pino-http |
| Seguridad | helmet + express-rate-limit |
| Google Calendar | googleapis (Service Account, sincronizacion opcional) |
| Hosting | Render (Web Service, plan gratuito) |
| BD en la nube | Neon (PostgreSQL serverless, plan gratuito) |

---

## Estructura de archivos

```
App para reservas/
├── CLAUDE.md                        <- este archivo
├── .env.example                     <- variables de entorno de referencia
├── .gitignore
├── package.json                     <- scripts raiz (concurrently)
├── render.yaml                      <- (opcional) config declarativa de Render
├── prisma/
│   ├── schema.prisma                <- schema de BD (fuente de verdad)
│   ├── seed.ts                      <- seed LEGACY (usar el de /server/)
│   └── migrations/                  <- historial de migraciones
├── server/
│   ├── package.json                 <- scripts server + config prisma
│   ├── tsconfig.json
│   ├── .npmrc                       <- production=false (para instalar devDeps en Render)
│   ├── prisma/
│   │   └── seed.ts                  <- seed REAL (ejecutar desde aqui)
│   └── src/
│       ├── app.ts                   <- entry point Express
│       ├── lib/
│       │   ├── prisma.ts            <- instancia Prisma singleton
│       │   ├── logger.ts            <- instancia pino singleton (importar desde aqui, NO desde app.ts)
│       │   └── audit.ts             <- helper logAudit()
│       ├── middleware/
│       │   ├── auth.middleware.ts   <- verifica JWT + resolveSpaceId()
│       │   ├── role.middleware.ts   <- requireAdmin / requireSuperAdmin
│       │   └── upload.middleware.ts <- multer para imagenes
│       ├── controllers/             <- logica de negocio por dominio
│       │   ├── auth.controller.ts
│       │   ├── user.controller.ts
│       │   ├── space.controller.ts  <- NUEVO: gestion de espacios
│       │   ├── resource.controller.ts
│       │   ├── booking.controller.ts
│       │   ├── certification.controller.ts
│       │   ├── training.controller.ts
│       │   ├── comment.controller.ts
│       │   ├── maintenance.controller.ts <- NUEVO: CRUD de mantenciones
│       │   └── settings.controller.ts
│       ├── routes/                  <- definicion de rutas Express
│       │   ├── auth.routes.ts
│       │   ├── user.routes.ts
│       │   ├── space.routes.ts      <- NUEVO
│       │   ├── resource.routes.ts
│       │   ├── booking.routes.ts
│       │   ├── certification.routes.ts
│       │   ├── training.routes.ts
│       │   ├── comment.routes.ts
│       │   ├── maintenance.routes.ts <- NUEVO
│       │   └── settings.routes.ts
│       └── services/
│           ├── booking.service.ts
│           └── googleCalendar.service.ts
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── .npmrc                       <- production=false (para instalar devDeps en Render)
    ├── vite.config.ts               <- outDir apunta a server/public
    ├── tailwind.config.ts
    └── src/
        ├── App.tsx                  <- router principal (lazy loading)
        ├── main.tsx                 <- entry point + ErrorBoundary
        ├── vite-env.d.ts
        ├── types/
        │   └── index.ts             <- todos los tipos TypeScript compartidos
        ├── store/                   <- Zustand stores
        │   ├── authStore.ts         <- incluye currentSpaceId y setCurrentSpace
        │   ├── bookingStore.ts
        │   └── resourceStore.ts
        ├── services/                <- llamadas HTTP al backend
        │   ├── api.ts               <- axios instance (timeout 15s, header X-Space-Id)
        │   ├── auth.service.ts
        │   ├── user.service.ts
        │   ├── space.service.ts     <- NUEVO: getAll, create, update, delete
        │   ├── resource.service.ts
        │   ├── booking.service.ts
        │   ├── certification.service.ts
        │   ├── training.service.ts
        │   ├── comment.service.ts
        │   └── settings.service.ts
        ├── utils/
        │   ├── dateHelpers.ts       <- PURPOSE_LABELS, formatDateTime (SIN mapas de categorias)
        │   └── apiError.ts          <- helper getApiError()
        ├── components/
        │   ├── shared/
        │   │   ├── Navbar.tsx          <- selector de espacio para SUPER_ADMIN
        │   │   ├── ProtectedRoute.tsx
        │   │   ├── LoadingSpinner.tsx
        │   │   ├── ErrorBoundary.tsx   <- envuelve la app en main.tsx
        │   │   ├── ConfirmModal.tsx    <- modal reutilizable (variant: danger|warning|success)
        │   │   └── SortableHeader.tsx  <- <th> sortable reutilizable + toggleSort + compareVals
        │   ├── booking/
        │   │   ├── BookingWizard.tsx   <- wizard multi-paso de reservas centrado en persona (reemplaza BookingModal)
        │   │   ├── BookingModal.tsx    <- modal legado (ya no usado en CalendarPage; conservado por compatibilidad)
        │   │   └── ExceptionalBookingModal.tsx <- reserva excepcional sin restricciones de horario/duracion
        │   ├── calendar/
        │   │   └── CalendarView.tsx    <- FullCalendar
        │   └── admin/
        │       ├── ResourceForm.tsx
        │       ├── TrainingModal.tsx   <- crea/edita capacitaciones (titulo, fecha, horas, cupos, exenciones)
        │       └── MaintenanceModal.tsx <- crea/edita mantenciones (titulo, descripcion, rango de fechas/horas)
        └── pages/
            ├── LoginPage.tsx
            ├── RegisterPage.tsx        <- selector de espacio al registrarse
            ├── CalendarPage.tsx
            ├── MyBookingsPage.tsx      <- reservas unificadas: tab "Reservas de Maquina" + tab "Capacitaciones"
            ├── MyCertificationsPage.tsx
            ├── CommunityPage.tsx
            ├── ProfilePage.tsx
            ├── admin/
            │   ├── ResourcesPage.tsx
            │   ├── UsersPage.tsx       <- incluye boton "Ver" (ficha de usuaria) y "Exportar Excel"
            │   ├── UserDetailPage.tsx  <- ficha de usuaria: stats, reservas, capacitaciones, certs
            │   ├── BookingsPage.tsx
            │   ├── CertificationsPage.tsx
            │   ├── CategoriesPage.tsx  <- gestion de categorias dinamicas
            │   ├── TrainingsPage.tsx   <- gestion de capacitaciones + lista de inscritas por sesion
            │   └── SettingsPage.tsx
            └── superadmin/
                └── SpacesPage.tsx      <- gestion de centros productivos
```

---

## Comandos

```bash
# Base de datos local (Docker — solo desarrollo)
docker compose up db -d        # levantar solo la BD en background
docker compose ps              # verificar estado
docker compose down            # detener contenedores

# Desde la raiz del proyecto
npm run dev            # cliente (5173) + servidor (3001) en paralelo
npm run build:prod     # build completo: cliente -> server/public, servidor -> dist/
npm run start          # inicia en produccion (requiere build previo)

# Desde /server/ (o desde la raiz con npm run seed)
npm run seed           # poblar BD con datos de prueba
                       # NOTA: usa dotenv con override:true → siempre lee server/.env
                       # si DATABASE_URL esta en el sistema como var de entorno, se sobreescribe
cd server && npx prisma migrate dev --name <nombre>   # nueva migracion (local)
npm run db:migrate:prod                               # migrar en produccion (Neon)
npx prisma migrate reset --force --skip-seed          # reset completo (borra datos)
```

### Deploy en produccion (Render + Neon)

**Build Command en Render:**
```
npm install && cd client && npm install && cd ../server && npm install && npx prisma generate && npx prisma migrate deploy --schema=../prisma/schema.prisma && cd .. && npm run build:prod
```

**Start Command en Render:**
```
npm run start
```

**Variables de entorno requeridas en Render:**

| Variable | Valor |
|---|---|
| `DATABASE_URL` | URL de Neon con `?sslmode=require` |
| `JWT_SECRET` | cadena aleatoria larga (min 32 chars) |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `CLIENT_URL` | URL del servicio en Render |
| `NPM_CONFIG_PRODUCTION` | `false` |

**Migraciones:** se corren automaticamente en cada deploy via `prisma migrate deploy`.
**Seed en produccion:** correr localmente apuntando a Neon via `server/.env`, o desde Render Shell.

---

## Variables de entorno (server/.env)

```env
# Local (Docker)
DATABASE_URL="postgresql://postgres:cowork123@localhost:5432/cowork_db"

# Produccion (Neon) — formato obligatorio con sslmode=require
# DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"

JWT_SECRET="min_32_caracteres_cambiar_en_produccion"
JWT_EXPIRES_IN="7d"
PORT=3001
CLIENT_URL="http://localhost:5173"

# Google Calendar (opcional)
GOOGLE_CALENDAR_ID="..."
GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## Schema de base de datos

### Modelos principales

| Modelo | Descripcion |
|--------|------------|
| `Space` | Centro productivo. Agrupa usuarios, categorias, recursos, trainings, comentarios y horarios. Tiene `maxCapacity` (aforo maquinas), `maxCapacityReunion` (aforo sala) y `maxBookingMinutes` (duracion maxima de reserva, 30–240 en intervalos de 30) |
| `Category` | Categoria de maquina dinamica, pertenece a un Space (reemplaza enum ResourceCategory) |
| `User` | Usuarias con role SUPER_ADMIN/ADMIN/LIDER_COMUNITARIA/USER, isVerified, spaceId (null para SUPER_ADMIN), phone (opcional) y deletedAt (soft delete: null = activo) |
| `Resource` | Maquinas/equipos con categoryId, spaceId y requiresCertification |
| `Booking` | Reservas con status, purpose, campos especiales segun categoria. `isExceptional Boolean @default(false)`: omite validaciones de horario y duracion maxima (solo roles ADMIN/SUPER_ADMIN) |
| `Maintenance` | Periodo de cierre del espacio. Campos: title, description?, startTime, endTime, spaceId, createdBy. Bloquea la creacion de cualquier reserva (normal o excepcional) que se solape con el periodo |
| `Certification` | Certificacion aprobada por categoria (unica por usuario+categoria). Creada directamente por roles elevados — no hay flujo de solicitud. |
| `Training` | Sesiones de capacitacion con `capacity` (cupos), exenciones de recursos e inscripciones |
| `TrainingExemption` | Bloqueo de recurso durante un training |
| `TrainingEnrollment` | Inscripcion de usuaria a una capacitacion. Status CONFIRMED o WAITLIST. Unique(trainingId+userId). Al cancelar una CONFIRMED, la primera WAITLIST se promueve automaticamente |
| `Comment` | Posts de la comunidad con tags e imagen opcional |
| `AuditLog` | Registro de acciones administrativas |
| `BusinessHours` | Horario de apertura por dia de semana, por espacio |

### Enums

```
Role:             SUPER_ADMIN | ADMIN | LIDER_COMUNITARIA | USER

BookingStatus:    PENDING | CONFIRMED | CANCELLED | REJECTED
BookingPurpose:   LEARN | PRODUCE | DESIGN | REUNION
CommentTag:       GENERAL | MACHINE_ISSUE | ORDER | CLEANING
CompanionRelation: CUIDADOS | AMISTAD | OTRO
EnrollmentStatus: CONFIRMED | WAITLIST

AuditAction:      USER_CREATED | USER_DELETED | USER_ROLE_CHANGED | USER_VERIFIED |
                  BOOKING_APPROVED | BOOKING_REJECTED | BOOKING_CANCELLED |
                  CERT_REQUEST_APPROVED | CERTIFICATION_REVOKED |
                  SPACE_CREATED | SPACE_UPDATED | SPACE_DELETED
```

**IMPORTANTE:** El enum `ResourceCategory` fue eliminado. Las categorias son ahora dinamicas en el modelo `Category`. El campo `slug` en Category conserva el valor original (ej. `RECTA_CASERA`) para logica interna.

### Configuracion Prisma

- Schema en `/prisma/schema.prisma`
- Client generado en `server/node_modules/.prisma/client`
- `server/package.json` tiene `"prisma": { "schema": "../prisma/schema.prisma" }`
- EPERM al hacer `prisma generate` con servidor corriendo (DLL locked) — reiniciar servidor despues

---

## Arquitectura multi-espacio

### Concepto
`Space` → `Category` → `Resource`. Cada espacio tiene sus propias categorias y recursos. Los usuarios (excepto SUPER_ADMIN) pertenecen a un unico espacio.

### Roles
- `SUPER_ADMIN`: acceso a todos los espacios. No tiene spaceId propio. Selecciona el espacio activo en el Navbar.
- `ADMIN`: administra su espacio. Tiene spaceId.
- `LIDER_COMUNITARIA`: aprueba reservas, gestiona categorias, recursos y certificaciones, verifica y crea/edita usuarios, gestiona la comunidad. Tiene spaceId.
- `USER`: usuaria del espacio al que pertenece.

**Matriz de permisos de roles elevados:**

| Endpoint / accion | ADMIN | LIDER_COMUNITARIA |
|---|:---:|:---:|
| Recursos (CRUD) | ✓ | ✓ |
| Categorias (CRUD) | ✓ | ✓ |
| Certificaciones (admin) | ✓ | ✓ |
| Capacitaciones (crear/borrar/exportar) | ✓ | — |
| Inscribir/desinscribir otras usuarias en capacitaciones | ✓ | ✓ |
| Reservas (aprobar/rechazar/ver todas) | ✓ | ✓ |
| Usuarios (ver lista) | ✓ | ✓ |
| Usuarios (verificar) | ✓ | ✓ |
| Usuarios (crear/editar sin cambiar contraseña) | ✓ | ✓ |
| Usuarios (eliminar/cambiar contraseña/cambiar rol) | ✓ | — |
| Horarios de negocio | ✓ | — |
| Agendar por otra usuaria (targetUserId) | ✓ | ✓ |

**Middlewares en `role.middleware.ts`:**
- `requireAdmin` → ADMIN + SUPER_ADMIN
- `requireComunitaria` → ADMIN + SUPER_ADMIN + LIDER_COMUNITARIA
- `requireElevated` → todos los roles no-USER (equivale a requireComunitaria)
- `requireAnyOf(...roles)` → factory generica

### Header X-Space-Id
El frontend envia el header `X-Space-Id` automaticamente en cada request (via interceptor de axios). El backend usa `resolveSpaceId(req)` en `auth.middleware.ts` para determinar el espacio:
- SUPER_ADMIN: usa el valor del header `X-Space-Id`
- Todos los demas roles: usan su propio `req.user.spaceId`

### Frontend: currentSpaceId
- Guardado en `authStore.currentSpaceId` y `localStorage`
- Al loguear como SUPER_ADMIN, el Navbar auto-selecciona el primer espacio disponible
- El selector del Navbar (solo SUPER_ADMIN) muestra espacios individuales (sin opcion "todos")
- Todos los `useEffect` de carga de datos dependen de `currentSpaceId` para refrescar al cambiar espacio

---

## Rutas de la API

```
POST   /api/auth/register          <- registro (isVerified=false, sin token)
POST   /api/auth/login             <- login (bloquea si !isVerified)

GET    /api/spaces                 <- lista espacios (cualquier auth)
POST   /api/spaces                 <- crear espacio (superadmin)
PUT    /api/spaces/:id             <- editar espacio (superadmin)
DELETE /api/spaces/:id             <- eliminar espacio (superadmin)

GET    /api/users                  <- lista usuarios (todos los roles elevados: admin + lider_tecnica + lider_comunitaria)
GET    /api/users/export           <- exportar Excel con usuarias del espacio (admin) — ESTATICA, declarada antes de /:id
GET    /api/users/audit-logs       <- historial de auditoria (admin) — ESTATICA, declarada antes de /:id
GET    /api/users/:id/summary      <- ficha de usuaria: stats + reservas + capacitaciones + certs (requireElevated)
POST   /api/users                  <- crear usuario (admin)
PATCH  /api/users/:id              <- editar usuario, acepta password, phone y spaceId (admin)
PATCH  /api/users/:id/verify       <- verificar usuario (admin + lider_comunitaria)
PATCH  /api/users/:id/role         <- cambiar rol (admin)
DELETE /api/users/:id              <- eliminar usuario (admin)

GET    /api/categories             <- categorias del espacio activo
POST   /api/categories             <- crear categoria (admin + lider_comunitaria)
PUT    /api/categories/:id         <- editar categoria (admin + lider_comunitaria)
DELETE /api/categories/:id         <- eliminar categoria (admin + lider_comunitaria)

GET    /api/resources              <- recursos del espacio activo
POST   /api/resources              <- crear recurso (todos los roles elevados)
PUT    /api/resources/:id          <- editar recurso (todos los roles elevados)
DELETE /api/resources/:id          <- eliminar recurso (todos los roles elevados)

GET    /api/bookings               <- reservas del usuario autenticado
GET    /api/bookings/admin/all     <- todas las reservas (admin + lider_comunitaria)
GET    /api/bookings/export        <- exportar Excel con todas las reservas (admin + lider_comunitaria)
POST   /api/bookings               <- crear reserva (cualquier auth; targetUserId solo roles elevados)
PATCH  /api/bookings/:id           <- editar reserva (propietario o rol elevado; no si CANCELLED/REJECTED)
PATCH  /api/bookings/:id/approve   <- aprobar (admin + lider_comunitaria)
PATCH  /api/bookings/:id/reject    <- rechazar (admin + lider_comunitaria)
PATCH  /api/bookings/:id/cancel    <- cancelar

GET    /api/certifications/mine      <- certificaciones del usuario autenticado
GET    /api/admin/certifications    <- todas las certs del espacio; acepta ?userId= para filtrar por usuaria (requireElevated)
POST   /api/admin/certifications    <- certificar usuaria directamente {userId, categoryId, notes?} (requireElevated)
DELETE /api/admin/certifications/:id <- revocar cert (requireElevated)

GET      /api/trainings                  <- sesiones de capacitacion con enrollments (cualquier auth)
POST     /api/trainings/:id/enroll       <- inscribirse (cualquier auth; body {targetUserId?} para roles elevados; si cupo lleno → WAITLIST)
DELETE   /api/trainings/:id/enroll       <- desinscribirse (cualquier auth; body {targetUserId?} para roles elevados; promueve WAITLIST → CONFIRMED)
GET      /api/admin/trainings/export     <- exportar Excel con capacitaciones e inscritas (admin + lider_tecnica)
POST     /api/admin/trainings            <- crear capacitacion (admin + lider_tecnica)
PATCH    /api/admin/trainings/:id        <- editar capacitacion (admin + lider_tecnica)
DELETE   /api/admin/trainings/:id        <- eliminar capacitacion (admin + lider_tecnica)
PATCH    /api/admin/trainings/:id/exemptions <- actualizar exenciones de recursos

GET/POST /api/comments             <- comunidad
DELETE   /api/comments/:id

GET/PUT  /api/settings/business-hours  <- horario de negocio (admin)

GET      /api/maintenances         <- lista mantenciones del espacio (authenticate)
POST     /api/admin/maintenances   <- crear mantención (requireAdmin)
PATCH    /api/admin/maintenances/:id <- editar mantención (requireAdmin)
DELETE   /api/admin/maintenances/:id <- eliminar mantención (requireAdmin)

GET      /api/health               <- health check con DB
```

---

## Reglas de negocio criticas

- **Certificacion por categoria**, no por maquina individual. Los roles elevados (ADMIN, SUPER_ADMIN, LIDER_TECNICA, LIDER_COMUNITARIA) certifican/revocan directamente desde `/admin/certifications` via combobox de busqueda de usuaria. No hay flujo de solicitud ni sesiones programadas.
- Usuario sin cert en la categoria → reserva PENDING (requiere aprobacion admin)
- Roles elevados o recursos con `requiresCertification=false` → reserva CONFIRMED directa
- **Deteccion de conflictos:** `startA < endB AND endA > startB` → 409
- **Horario de negocio**: reservas validadas contra `BusinessHours` del espacio tanto en frontend como en backend. Frontend usa strings HH:MM locales para evitar ambiguedad de zona horaria. Backend recibe `localDate`, `localStartTime`, `localEndTime` en el body de creacion de reserva y consulta `BusinessHours` via `findUnique({ spaceId_dayOfWeek })`. Comparacion HH:MM como string lexicografica es suficiente y sin timezone.
- Duracion maxima de reserva configurable via `Space.maxBookingMinutes` (default 240 min = 4h, intervalos de 30). El backend valida contra este valor en createBooking y updateBooking; el frontend muestra el limite en tiempo real en el paso SCHEDULE del BookingWizard
- Google Calendar solo sincroniza reservas CONFIRMED (no PENDING)
- Roles elevados pueden agendar a nombre de otra usuaria (`targetUserId` en el body)
- Roles elevados pueden inscribir/desinscribir otras usuarias en capacitaciones (`targetUserId` en el body de enroll/unenroll)
- `ESPACIO_REUNION` (slug): ya no aparece como opcion de categoria en el BookingWizard — se usa como **proposito** `REUNION`. El wizard auto-selecciona el recurso con slug `ESPACIO_REUNION` del espacio, salta el paso de maquinas y muestra campos especiales (N° asistentes, privacidad). La opcion REUNION solo es visible para ADMIN, SUPER_ADMIN y LIDER_COMUNITARIA.
- **Aforo**: `Space.maxCapacity` limita asistentes totales en reservas de maquinas; `Space.maxCapacityReunion` limita asistentes por reserva de sala. Valores configurables desde SettingsPage. El check en booking.controller distingue slug `ESPACIO_REUNION` vs. el resto. No aplica a ADMIN/SUPER_ADMIN
- date-fns NO instalado en server/ — usar native JS (fmtDate/fmtTime helpers)
- No usar mapas estaticos de colores/labels en frontend — usar `r.category?.color` y `r.category?.name`
- **Edicion de reservas:** el frontend abre el wizard completo pre-relleno via prop `editBookings?: Booking[]`. Al confirmar, el wizard cancela los bookings originales y crea los nuevos (estrategia cancelar+recrear). El backend `PATCH /api/bookings/:id` sigue disponible para cancelaciones individuales pero ya no se usa para edicion desde el calendario. El boton "Editar" llama `onEditBooking(bookings: Booking[])` en `CalendarView` → `handleEditBooking` en `CalendarPage`.
- **Reservas excepcionales:** `isExceptional=true` en el body de `POST /api/bookings` omite: validacion de duracion maxima y validacion de horario de negocio. Las mantenciones siguen bloqueando. Solo ADMIN/SUPER_ADMIN pueden crear reservas excepcionales; el flag es ignorado para otros roles.
- **Mantenciones:** bloquean la creacion de cualquier reserva (normal o excepcional) cuyo rango se solape (`startA < endB AND endA > startB`). El backend devuelve 409 con nombre de la mantención. No hay limite de duracion para las mantenciones.
- **Certificacion directa:** roles elevados certifican/revocan desde `/admin/certifications`. No hay flujo de solicitud (el modelo `CertificationRequest` y enum `CertReqStatus` fueron eliminados del schema). `POST /admin/certifications` hace `upsert` en `Certification`; `DELETE /admin/certifications/:id` la elimina.
- **Revocacion de certificacion:** borra la fila `Certification`. La usuaria vuelve al estado "sin certificacion" y sus proximas reservas en esa categoria seran PENDING hasta ser re-certificada.
- **Certificacion directa:** `POST /admin/certifications` crea una `Certification` con `upsert` (si ya existe la actualiza). Protegido con `requireElevated` para incluir LIDER_COMUNITARIA.
- **Agrupacion de actividades en CalendarView (union-find):** `clusterVisibleEvents()` en `CalendarView.tsx` usa algoritmo union-find para detectar grupos de eventos que se solapan (`sA < eB && eA > sB`). Grupos de 1 → evento original; grupos de 2+ → evento cluster slate `#475569` con label "N actividades". Los `trainingBgEvents` (display:'background') se excluyen del clustering. El `handleDateClick` tambien usa la misma logica para detectar actividades al hacer click y abrir el `clusterModal` en lugar de ir directo al BookingModal.
- **TrainingModal en modo edicion:** prop `initialTraining?: Training` — si se provee, pre-rellena todos los campos y llama `trainingService.update()` + `trainingService.updateExemptions()` al guardar. Las exenciones se muestran en ambos modos (crear y editar).
- **`formatTimeInput` en dateHelpers:** `raw.replace(/[^0-9:]/g,'')` → si resultado es exactamente 4 digitos → inserta ':' en posicion 2. Nunca mas de 5 chars. Aplicado en BookingWizard (startTime/endTime) y TrainingModal (startTime/endTime).
- **Logger en controllers:** importar `logger` desde `../lib/logger` (NO desde `../app`). Importar desde `app` genera dependencia circular (app → routes → controllers → app) que deja `logger` como `undefined` en runtime y crashea el servidor.
- **pino-pretty en devDependencies:** esta en `devDependencies` de `server/package.json`. Al hacer `npm uninstall pino-pretty --save` se elimina de `node_modules` aunque sea devDep; si ocurre, reinstalar con `npm install --save-dev pino-pretty` desde `/server/`. En produccion (Render) el `.npmrc` con `production=false` garantiza que se instale igual.

---

## Features implementados

### Produccion-ready (auditoria de seguridad aplicada)
- Helmet (headers HTTP seguros)
- Rate limiting en auth: 50 intentos / 15 min por IP real (`app.set('trust proxy', 1)` antes del limiter, necesario en Render para evitar que todos compartan la misma IP del proxy)
- Graceful shutdown (SIGTERM/SIGINT)
- Pino logger estructurado (pretty en dev, JSON en prod) — instancia en `lib/logger.ts`
- Compresion HTTP gzip/brotli (`compression` middleware, antes de helmet en `app.ts`)
- Body limit 1mb
- Health check con ping a DB
- Error handler global (mensaje generico en prod)
- Logs estructurados en controllers: todos los `catch` usan `logger.error({ err }, 'msg')` via `lib/logger`
- SPA fallback para react-router en prod
- Prisma con logging segun NODE_ENV
- Indexes en BD: Booking (userId, resourceId, status, startTime+endTime)
- Lazy loading de todas las paginas (React.lazy + Suspense)
- ErrorBoundary global en main.tsx
- Timeout 15s en axios
- `getApiError()` helper para mensajes de error consistentes
- `ConfirmModal` reutilizable con variantes danger / warning / success
- Favicon SVG real en `client/public/favicon.svg` (evita 404 en cada pagina)
- `<meta name="robots" content="noindex, nofollow">` en index.html (app privada)
- Guard en seed: `process.exit(1)` si `NODE_ENV === 'production'`

### Feature: Multi-espacio (rama feature/multi-espacio)
- Modelo `Space` agrupa categorias, recursos, usuarios, trainings, comentarios y horarios
- Modelo `Category` dinamico reemplaza enum `ResourceCategory`
- Role `SUPER_ADMIN` puede ver y gestionar todos los espacios
- `resolveSpaceId(req)` determina el espacio en cada request del backend
- Header `X-Space-Id` enviado automaticamente por axios interceptor
- Navbar con selector de espacio para SUPER_ADMIN (auto-selecciona el primero al loguear)
- `SpacesPage` para crear/editar/activar/desactivar centros productivos (superadmin)
- `CategoriesPage` para gestionar categorias por espacio (admin)

### Feature: Verificacion de usuarios
- Registro auto-servicio → `isVerified=false`, no devuelve token
- Login bloqueado si `isVerified=false` (403)
- Admin crea usuario → `isVerified=true` automaticamente
- `PATCH /users/:id/verify` para que admin verifique
- `AuditAction.USER_VERIFIED` registrado
- UsersPage: badge de pendientes, columna Estado, boton Verificar

### Feature: Edicion de usuario ampliada
- Admin y superadmin pueden cambiar la contrasena al editar un usuario (campo password opcional)
- Solo SUPER_ADMIN puede reasignar el espacio de un usuario (`spaceId`)
- Backend hashea la nueva contrasena con bcrypt

### Feature: Roles elevados agendan por otra usuaria
- BookingWizard paso WHO (solo roles elevados): "Para mi / Para otra usuaria"
- Aplica a ADMIN, SUPER_ADMIN, LIDER_TECNICA y LIDER_COMUNITARIA
- Carga lista de usuarios del espacio al abrir el wizard
- `targetUserId?` en `CreateBookingDto`
- Booking controller usa `targetUserId` si el actor es un rol elevado
- El nombre de la usuaria seleccionada se muestra en pasos siguientes y en el resumen

### Feature: Exportacion a Excel de reservas
- Boton "Exportar Excel" en BookingsPage (admin + lider_comunitaria)
- Ruta: `GET /api/bookings/export` — protegida con `authenticate` + `requireComunitaria`
- Genera archivo `reservas.xlsx` filtrado por el espacio activo
- Libreria: `xlsx` (SheetJS) en el backend
- Columnas incluidas en la planilla:
  - Fecha, Hora Inicio, Hora Fin
  - Recurso, Categoria
  - Usuario, Email Usuario
  - Proposito
  - Item a Producir, Cantidad (campos de proposito PRODUCE)
  - N° Asistentes, Relacion Acompanantes
  - Estado
  - Notas
  - Fecha de Reserva (createdAt)
- El frontend descarga el blob como archivo directamente (sin URL publica)

### Feature: Horario de negocio configurable
- Modelo `BusinessHours` (spaceId, dayOfWeek, isOpen, openTime, closeTime)
- `GET/PUT /api/settings/business-hours`
- SettingsPage en admin para configurar horario por dia
- Al crear un espacio nuevo se generan BusinessHours por defecto (lun-sab 09:00-17:00)

### Feature: Aforo configurable por espacio
- Campos `maxCapacity Int @default(12)` y `maxCapacityReunion Int @default(12)` en modelo `Space`
- Migracion: `20260317182326_add_space_capacity`
- `GET /api/settings/business-hours` ahora retorna `{ days, maxCapacity, maxCapacityReunion }` (antes era solo el array)
- `PUT /api/settings/business-hours` acepta `{ days, maxCapacity, maxCapacityReunion }` y actualiza el Space
- Frontend: tipo `SpaceSettings` en `types/index.ts`; `settingsService` actualizado; `CalendarPage` usa `data.days`
- SettingsPage: seccion "Aforo maximo" con dos inputs separados antes de la tabla de horarios
- Inputs de aforo usan estado `string` (no `number`) para permitir borrar y reeditar; validacion solo al guardar
- booking.controller: reemplaza `> 12` hardcodeado — lee `space.maxCapacity` / `space.maxCapacityReunion`; maquinas verifican suma de asistentes en el horario, sala verifica solo la reserva puntual

### Feature: Sala de reuniones — asistentes y notas
- En BookingWizard, proposito REUNION activa el paso DETAILS con campo **N° de asistentes** (default 2) e **isPrivate**
- Se envia como `attendees` en el body; el backend lo valida contra `space.maxCapacityReunion`
- El campo Notas pide identificar personas externas a la agrupacion cuando proposito es REUNION
- Para el resto de propositos, label y placeholder de notas no cambian

### Feature: Auditoria
- `AuditLog` model en BD
- Helper `logAudit(actorId, action, targetType, targetId, meta?)`
- Acciones registradas en operaciones criticas de admin y superadmin (incluye SPACE_*)

### Feature: Calendario mejorado
- `CalendarView.tsx` usa `dateClick` y `eventClick`; un evento FullCalendar por reserva real (no agrupado)
- `slotDuration: "00:30:00"` — franjas de 30 min
- Click en celda con reservas → `slotModal` muestra lista con opcion de ver detalle o agregar nueva reserva
- Detalle de reserva → boton "← Volver" restaura el slotModal (`returnSlot` en estado de detalle)
- Click en celda vacía → abre BookingWizard (o actionChoice si rol elevado)
- `hoursLoaded` state en CalendarPage: CalendarView no monta hasta que businessHours se cargue
- `isAdmin = ['ADMIN','SUPER_ADMIN','LIDER_COMUNITARIA'].includes(role)` en CalendarPage
- Tiempo flexible de reserva: inputs `startTime`/`endTime` tipo `time`, maximo 4 horas
- Validacion en backend: `endTime > startTime`, duracion <= 4h
- CSS inyectado via `<style>` para mostrar `+` en hover de celdas vacías

### Feature: Roles (ADMIN / LIDER_COMUNITARIA)
- El rol `LIDER_TECNICA` fue eliminado (migracion `20260405000000_remove_lider_tecnica_role`). Los usuarios existentes con ese rol fueron reasignados a `LIDER_COMUNITARIA`
- `requireAnyOf(...roles)` factory en `role.middleware.ts`; middlewares: `requireAdmin`, `requireComunitaria`, `requireElevated`
- Navbar muestra items de menu Admin filtrados segun el rol del usuario logueado
- `canManageTrainings` en Navbar y CalendarPage: solo ADMIN y SUPER_ADMIN (no LIDER_COMUNITARIA)
- UsersPage: badge de color por rol (indigo=SUPER_ADMIN, purple=ADMIN, teal=LIDER_COMUNITARIA)
- Migracion original de roles: `20260311193438_add_lider_roles`

### Feature: Tablas admin responsivas (scroll horizontal en movil)
- Todas las tablas admin usan `overflow-x-auto` + `min-w-full` (no `w-full`)
- `min-w-full` permite que la tabla exceda el ancho del contenedor → activa el scroll horizontal
- CategoriesPage: se agrego el wrapper `overflow-x-auto` que faltaba

### Feature: Tablas admin ordenables y filtrables
- `SortableHeader` component en `client/src/components/shared/SortableHeader.tsx`
  - Exporta: `SortState` tipo, `toggleSort(current, key)` función, `compareVals(a, b, dir)` función
  - Icono: ↕ cuando sin orden, ↑ ascendente, ↓ descendente (resaltado en brand-500)
- Buscador de texto en todas las páginas admin: filtra en tiempo real mientras se escribe
- Orden A→Z / Z→A al hacer click en el encabezado de cualquier columna
- Páginas actualizadas: UsersPage, BookingsPage, CertificationsPage (3 tabs), ResourcesPage, CategoriesPage
- En CertificationsPage: el sort se resetea al cambiar de tab; el search persiste entre tabs

### Feature: Inscripcion a capacitaciones
- Modelo `TrainingEnrollment` (trainingId, userId, status CONFIRMED|WAITLIST, createdAt). Unique(trainingId+userId)
- Campo `capacity Int @default(10)` en modelo `Training`
- Migracion: `20260317190556_add_training_enrollment`
- Endpoints: `POST /api/trainings/:id/enroll` y `DELETE /api/trainings/:id/enroll` (autenticados, cualquier rol)
- Al inscribirse: si confirmedCount < capacity → CONFIRMED, si no → WAITLIST
- Al desinscribirse: si era CONFIRMED, se promueve la primera WAITLIST (transaccion Prisma)
- `GET /api/trainings` incluye `enrollments` con datos de usuario en cada capacitacion
- **TrainingModal** (`TrainingModal.tsx`): input de cupos en formulario de creacion; estado `capacity` tipo string
- **CalendarPage**: click en training abre modal de detalle para todos los roles (no solo admin). Para usuarios: botones Inscribirse / Lista de espera / Cancelar inscripcion. Para admins: lista de inscritas + boton Eliminar (con ConfirmModal)
- **`/my-bookings`** tab "Capacitaciones" (`MyBookingsPage.tsx`): filtro "Mis inscripciones" vs "Todas las proximas". Badge de estado por capacitacion. Boton contextual segun estado de inscripcion. La ruta `/my-trainings` redirige a `/my-bookings`
- **`/admin/trainings`** (`TrainingsPage.tsx`): filtro Proximas/Pasadas/Todas. Tarjeta por sesion con cupos, lista de espera, lista de inscritas expandible (nombre, email, estado, fecha). Crear y eliminar capacitaciones
- Navbar: usuarios acceden a capacitaciones desde "Mis Reservas" (`/my-bookings`, tab Capacitaciones). El link separado "Capacitaciones" fue eliminado del menu. Roles con `canManageTrainings` → `/admin/trainings`

### Feature: Inscripcion de otras usuarias en capacitaciones (roles elevados)
- Endpoints `POST /api/trainings/:id/enroll` y `DELETE /api/trainings/:id/enroll` aceptan `{ targetUserId }` en el body
- Si `targetUserId` presente y actor es rol elevado (ELEVATED_ROLES), se inscribe/desincribe a esa usuaria en lugar del actor
- Error 403 si un USER intenta usar `targetUserId`
- **`GET /api/users` usa `requireElevated`**: LIDER_COMUNITARIA puede listar usuarios del espacio, necesario para el selector de inscripcion en TrainingsPage
- **`TrainingsPage.tsx`**: al expandir una sesion, muestra un **combobox de busqueda** (componente `UserCombobox` inline) que filtra las usuarias no inscritas aun por nombre o email, y un boton "Inscribir". Cada fila de inscritas tiene un boton `✕` para desinscribir individualmente
- `UserCombobox`: input tipo texto con dropdown filtrado, cierra al hacer clic fuera (`mousedown` listener), resetea al seleccionar

### Feature: Exportacion de capacitaciones a Excel
- Ruta: `GET /api/admin/trainings/export` (requireAdmin)
- Genera archivo `capacitaciones.xlsx` con una fila por inscripcion (capacitaciones sin inscritas aparecen como fila con campos de usuaria vacios)
- Columnas: Capacitacion, Descripcion, Fecha, Hora Inicio, Hora Fin, Cupos totales, Confirmadas, Lista de espera, Usuaria inscrita, Email usuaria, Estado inscripcion, Fecha inscripcion
- Frontend: boton "Exportar Excel" en `TrainingsPage.tsx` junto al boton de nueva capacitacion; `trainingService.exportAll()` con `responseType: 'blob'`
- Ruta estatica `/admin/trainings/export` declarada ANTES de la dinamica `/:id` para evitar que Express la interprete como ID

### Feature: Inputs de hora en formato 24h y sin bloqueo al borrar
- Inputs `type="text"` con `placeholder="HH:MM"` y `maxLength={5}` en `BookingWizard` y `ExceptionalBookingModal`
- Permite borrar completamente el campo sin quedar atascado en un segmento (comportamiento nativo del browser con `type="time"`)
- Helper `isValidTime(t: string): boolean` con regex `/^\d{2}:\d{2}$/` usado para: guardado de disponibilidad, validacion inline de duracion y validacion al enviar
- Inputs numericos `reunionAttendees`, `produceQty`, `companionCount` cambiados de `number` a `string` como estado React; `parseInt()` con fallback a 1 solo al enviar el formulario
- Regla general: usar `useState<string>` para inputs numericos que el usuario debe poder borrar completamente; parsear solo al guardar/enviar

### Feature: Validacion de horario de negocio en reservas
- **Frontend (`BookingWizard.tsx`)**: recibe prop `businessHours?: BusinessHours[]` desde `CalendarPage` (ya los cargaba para FullCalendar)
- `dayHours`: lookup del dia seleccionado con `businessHours.find(h => h.dayOfWeek === new Date(date + 'T12:00:00').getDay())`. El `T12:00:00` evita que parsear solo la fecha como UTC-midnight cause desfase de dia en zonas UTC-X
- Feedback visual en tiempo real: hint de horario bajo el campo fecha ("Horario del espacio: 09:00 – 17:00" o "El espacio no abre ese dia"), borde rojo + texto de error en el input de hora si startTime < openTime o endTime > closeTime
- Validacion al enviar: bloquea si dia cerrado, si startTime < openTime, o si endTime > closeTime
- **Backend (`booking.controller.ts`)**: recibe `localDate` (YYYY-MM-DD), `localStartTime` y `localEndTime` (HH:MM) en el body del POST. Usa `new Date(localDate + 'T12:00:00').getDay()` para el dayOfWeek. Consulta `BusinessHours` via `prisma.businessHours.findUnique({ where: { spaceId_dayOfWeek } })`. Comparacion de HH:MM como strings lexicograficas (ej. `"14:00" > "09:00"`) funciona correctamente y sin problemas de zona horaria
- `CreateBookingDto` en `booking.service.ts` incluye los tres campos opcionales `localDate?`, `localStartTime?`, `localEndTime?`

### Feature: Edicion y cancelacion de reservas desde el calendario
- `PATCH /api/bookings/:id` — valida propiedad, status, duracion, horario de negocio y conflictos (`excludeBookingId`)
- `CalendarView.tsx`: modal de detalle de reserva con boton "Editar" → formulario inline (fecha, hora inicio/fin, notas) + boton "Cancelar reserva" con confirmacion
- Solo visible si `canEdit` (propietario o rol elevado) y status no CANCELLED/REJECTED
- Callbacks `onUpdateBooking` y `onCancelBooking` son Promises; errores se muestran inline en el modal
- `bookingService.update(id, data: UpdateBookingDto)` en el cliente

### Feature: Edicion de capacitaciones desde el calendario
- `PATCH /api/admin/trainings/:id` — actualiza title, description, startTime, endTime, capacity
- `TrainingModal` acepta `initialTraining?: Training` para modo edicion; pre-rellena todos los campos incluyendo exenciones; llama `update()` + `updateExemptions()`
- Exenciones (recursos libres) ahora son visibles y editables tanto al crear como al editar
- Boton "Editar" en el popup de detalle de capacitacion en CalendarPage (solo `canManageTrainings`)

### Feature: Auto-formato de inputs de hora (1700 → 17:00)
- `formatTimeInput(raw)` en `dateHelpers.ts`: elimina caracteres no numericos/colon; si resultado es exactamente 4 digitos, inserta ':' entre pos 2 y 3; nunca mas de 5 chars
- Aplicado en los `onChange` de startTime/endTime en `BookingModal` y `TrainingModal`

### Feature: Reversion de certificacion a PENDING al revocar
- `DELETE /admin/certifications/:id` elimina directamente la `Certification`. No hay CertificationRequest que actualizar (modelo eliminado).

### Feature: Agrupacion de actividades solapadas en el calendario (clustering)
- `clusterVisibleEvents(events: VisibleFCEvent[])` en `CalendarView.tsx` — algoritmo union-find (DSU) para detectar grupos de eventos solapados
- Grupos de 1 → evento original sin cambios; grupos de 2+ → un unico evento cluster slate `#475569` con texto "N actividades" y lista de nombres
- Solo se agrupan eventos visibles (bookings, training labels). Los `trainingBgEvents` (display:'background') nunca entran al clustering
- Click en cluster → `clusterModal`: lista de actividades con punto de color, nombre, tipo y horario; click en item → detail modal individual
- `handleDateClick` detecta actividades en la celda clicada y abre `clusterModal` si las hay, en lugar de ir directo al BookingWizard. `eventClick` siempre abre el clusterModal para cualquier evento (incluso individual), mostrando la lista de actividades mas el boton "Nueva actividad en este horario"
- `slotModal` fue eliminado completamente y reemplazado por `clusterModal`

### Feature: Soft delete de usuarios
- Campo `deletedAt DateTime?` en modelo `User` (migracion `20260325225536_add_user_soft_delete`)
- `deleteUser`: en vez de `prisma.user.delete()`, hace `prisma.user.update({ deletedAt: new Date() })`. Tambien cancela reservas PENDING y CONFIRMED (antes solo CONFIRMED)
- `getUsers`: filtra `deletedAt: null` para excluir usuarios eliminados de la lista
- Login: bloquea con 403 si `user.deletedAt` esta seteado ("Esta cuenta ha sido eliminada")
- Tokens JWT existentes de usuarios eliminados siguen validos hasta expirar (7 dias) — comportamiento aceptable para sistema interno
- `createUser`: si el email existe pero `deletedAt != null`, reactiva el usuario con `update` (nombre, password, rol, espacio, `deletedAt: null`) en vez de rechazar con 409

### Feature: Eliminacion de recursos
- `deleteResource` en `resource.controller.ts`: verifica que no haya reservas asociadas (`bookingCount > 0` → 409 con mensaje explicativo). Elimina primero `TrainingExemption` del recurso, luego el recurso
- Ruta `DELETE /api/resources/:id` protegida con `requireElevated`
- `resourceService.remove(id)` en el frontend
- Boton "Eliminar" en `ResourcesPage` con `ConfirmModal`. Si hay reservas, el toast muestra el mensaje del backend ("Desactivalo en su lugar")
- Boton "Desactivar" cambio de rojo a ambar para diferenciar de "Eliminar" (que queda en rojo)

### Feature: Duracion maxima de agendamiento configurable
- Campo `maxBookingMinutes Int @default(240)` en modelo `Space` (migracion `20260326002843_add_space_max_booking_minutes`)
- Valores validos: `[30, 60, 90, 120, 150, 180, 210, 240]` (intervalos de 30 min, de 30 min a 4 h)
- `GET/PUT /api/settings/business-hours` ahora incluye `maxBookingMinutes` en la respuesta y en el body
- `booking.controller` (createBooking y updateBooking): consulta `space.maxBookingMinutes` en vez del hardcode `4 * 60 * 60 * 1000`. El mensaje de error menciona el limite configurado ("no puede durar mas de 1:30 horas", etc.)
- `SpaceSettings` en `types/index.ts` incluye `maxBookingMinutes: number`
- `settingsService.updateBusinessHours` acepta cuarto parametro `maxBookingMinutes`
- `SettingsPage`: nuevo bloque "Duracion maxima de agendamiento" con `<select>` entre el bloque de Aforo y el de Horarios
- `CalendarPage`: carga `maxBookingMinutes` desde settings y lo pasa a `BookingWizard` como prop
- `BookingWizard`: prop `maxBookingMinutes?: number` (default 240). Validacion al avanzar de SCHEDULE y hint de duracion en tiempo real usan el valor dinamico

### Feature: Inscripcion desde el calendario para roles elevados
- Modal de detalle de capacitacion en `CalendarPage` ahora incluye `UserCombobox` + boton "Inscribir" para roles elevados (igual patron que `TrainingsPage`)
- Boton `✕` por fila en la lista de inscritas para desinscribir individualmente (solo admins)
- `handleEnrollFor` y `handleUnenrollFor` en `CalendarPage` usan `trainingService.enroll/unenroll(id, targetUserId)`
- `fetchTrainings` actualizado para sincronizar `selectedTraining` con los datos frescos (evita que el modal muestre datos stale tras cada accion)
- Lista de inscritas visible para TODAS las usuarias (no solo admins) — solo lectura para USER
- Boton "Agendar en este horario" movido al fondo del modal, separado por `border-t`, con estilo apagado (`text-xs`, `text-gray-500`) para distinguirlo claramente de la accion de inscripcion

### Feature: Personalizacion de marca por espacio
- Campos `logoUrl String?` y `primaryColor String?` agregados al modelo `Space` (migracion `20260325032135_add_space_customization`)
- **Color primario:** almacenado en BD, editable desde `/admin/customization` (solo ADMIN y SUPER_ADMIN). Se aplica como CSS variables (`--brand-50/100/500/600/700`) sobre `document.documentElement` al cargar la app. Tailwind usa estas variables en lugar de valores hardcodeados. FullCalendar tambien usa `var(--brand-600/700)` en `index.css`.
- **Logo:** se deriva automaticamente del nombre del espacio via `slugifySpaceName()` en el backend → `logo-{slug}.png`. Ejemplo: "Puente Alto" → `/logo-puentealto.png`. El archivo debe existir en `client/public/` (Vite lo copia a `server/public/` durante el build). No hay upload en runtime — es un archivo estatico commitado al repo.
- `slugifySpaceName(name)` en `settings.controller.ts`: lowercase + NFD + elimina tildes (`\u0300-\u036f`) + elimina no-alphanumericos
- `generateBrandPalette(hex)` en `client/src/utils/colorHelpers.ts`: convierte hex a HSL, genera 5 tonos con lightness fija (97/93/50/40/30%)
- `applyBrandColors(hex | null)` en `colorHelpers.ts`: aplica la paleta (o defaults) sobre `document.documentElement.style`
- `useBrandingStore` en `client/src/store/brandingStore.ts`: Zustand store con `logoUrl` y `primaryColor`
- `App.tsx` carga la personalizacion en `useEffect([user?.id, currentSpaceId])` y llama `applyBrandColors`
- Navbar: `src={logoUrl ?? '/logo.png'}` — sin prefijo de API ya que el logo es estatico
- Tamano recomendado para logos: PNG cuadrado 180×180px, fondo transparente, maximo ~50KB
- `GET /api/settings/customization` — publica para cualquier usuario autenticado; devuelve `{ logoUrl, primaryColor }`
- `PUT /api/settings/customization/colors` — requiere `requireAdmin`; actualiza `primaryColor` y retorna `logoUrl` calculado

### Feature: Telefono de usuaria
- Campo `phone String?` agregado al modelo `User` (migracion `20260330120000_add_user_phone`)
- `getMe` y `updateMe` en `auth.controller.ts` incluyen `phone` en select y en update
- `getUsers` y `getUserSummary` en `user.controller.ts` usan `USER_SELECT` constante que incluye `phone`
- `createUser` y `updateUser` extraen `phone` del body y lo pasan a Prisma
- Frontend: `ProfilePage.tsx` tiene campo de telefono; `UsersPage.tsx` (crear/editar usuario) tambien

### Feature: Exportacion de usuarios a Excel
- Ruta: `GET /api/users/export` (requireAdmin) — declarada ANTES de `/:id`
- Genera `usuarias.xlsx` con columnas: Nombre, Email, Telefono, Agrupacion, Rol, Estado, Registrada
- `userService.exportAll()` en el frontend con `responseType: 'blob'`; boton en `UsersPage.tsx`

### Feature: Ficha de usuaria (UserDetailPage)
- Ruta: `GET /api/users/:id/summary` (requireElevated) — retorna `{ user, bookings, bookingStats, enrollments, certifications }`
- Interfaces en `types/index.ts`: `BookingStats`, `UserSummaryEnrollment`, `UserSummary`
- `UserDetailPage.tsx` en `/admin/users/:id` — accesible desde el boton "Ver" en `UsersPage.tsx`
- Header con boton "← Volver" a `/admin/users`
- Tarjeta de info: nombre, rol, estado verificacion, email, telefono, agrupacion, createdAt
- 4 stat cards: total reservas, pendientes, confirmadas, certificaciones
- Tabs: Reservas | Capacitaciones | Certificaciones
- Tab Reservas: filtro por status, tabla con botones aprobar/rechazar para PENDING (solo ADMIN/SUPER_ADMIN)
- Tab Capacitaciones: secciones Proximas y Pasadas con badge de estado de inscripcion
- Tab Certificaciones: punto de color, categoria, fecha, nombre certificadora, boton Revocar con ConfirmModal
- Registrada en `App.tsx` como `<Route path="/admin/users/:id">`

### Feature: Hora Excepcional
- Campo `isExceptional Boolean @default(false)` en modelo `Booking` (migracion `20260330130000_add_exceptional_booking_and_maintenance`)
- En `createBooking`: `isExceptional` solo se acepta si el actor es rol elevado (ADMIN/SUPER_ADMIN/LIDER_TECNICA/LIDER_COMUNITARIA). Si `isExceptional=true`: se omite la validacion de duracion maxima y la validacion de horario de negocio. Las mantenciones si bloquean incluso reservas excepcionales.
- En `updateBooking`: si `booking.isExceptional === true` se omiten las mismas validaciones
- `ExceptionalBookingModal.tsx` en `client/src/components/booking/`: UI naranja, sin restricciones de horario en frontend, envia `isExceptional: true` en el DTO
- CalendarPage: boton "Hora Excepcional" (naranja) en toolbar y opcion en actionChoice dialog — solo para `canManageMaintenance` (ADMIN/SUPER_ADMIN)

### Feature: Mantenciones / Cierre de espacio
- Modelo `Maintenance` en schema (migracion `20260330130000_add_exceptional_booking_and_maintenance`): `id, title, description?, startTime, endTime, spaceId, createdBy, createdAt`; FK a Space y User
- `maintenance.controller.ts`: `getMaintenances` (filtra por spaceId via `resolveSpaceId`), `createMaintenance`, `updateMaintenance`, `deleteMaintenance`
- `maintenance.routes.ts`: `GET /maintenances` (authenticate), `POST/PATCH/DELETE /admin/maintenances[/:id]` (requireAdmin). Registrado en `app.ts`
- En `createBooking`: despues de validar conflictos, consulta `prisma.maintenance.findFirst` buscando solapamiento. Si existe → 409 con nombre de la mantención. Aplica a TODAS las reservas incluyendo excepcionales.
- `maintenanceService.ts` en el cliente: `getAll`, `create`, `update`, `remove`
- `MaintenanceModal.tsx`: UI roja, campos fecha+hora inicio y fin separados (soporta multi-dia), banner de advertencia, modos crear y editar via `initialMaintenance` prop
- `CalendarView.tsx`: eventos de fondo (`display:'background'`, color `#fecaca`) + eventos etiqueta clicables (`#dc2626`, texto "🔧 {titulo}"). `handleDateClick` detecta mantención activa y llama `onMaintenanceClick`. Eventos de fondo excluidos del clustering.
- CalendarPage: boton "Mantención" (rojo) en toolbar y opcion en actionChoice — solo `canManageMaintenance`. Modal de detalle muestra titulo, descripcion, fechas, botones editar/eliminar (admin). ConfirmModal para eliminacion. Leyenda roja en la barra de colores.
- `checkAvailability` en `booking.controller`: consulta mantenciones y bloquea si hay solapamiento

### Feature: BookingWizard — agendamiento centrado en persona con multi-maquina
- **Archivo:** `client/src/components/booking/BookingWizard.tsx` (reemplaza `BookingModal.tsx` en CalendarPage)
- **Filosofia:** la reserva es por persona, no por maquina. Una persona puede seleccionar N maquinas en la misma sesion. Se crea una reserva (`Booking`) por cada maquina seleccionada con los mismos datos de fecha/hora/proposito/detalles.
- **Pasos del wizard:**
  - `WHO` (solo roles elevados): "Para mi" o "Para otra usuaria" — selector de usuaria del espacio
  - `SCHEDULE`: Fecha, hora inicio/fin (inputs `type="text"` HH:MM), proposito (Aprender/Producir/Diseñar/Reunion). Feedback en tiempo real de duracion y horario del espacio. Avanza a MACHINES o salta a DETAILS si proposito es REUNION.
  - `MACHINES`: Lista de recursos activos agrupados por categoria (excluye ESPACIO_REUNION). Multi-select con checkbox. Muestra disponibilidad en tiempo real via `bookingService.getAvailability`. Para mesones (capacidad > 1) muestra selector de cantidad `−/+`. Badge "Sin certificacion" si la usuaria no esta certificada para esa categoria.
  - `DETAILS`: Varia segun proposito. PRODUCE: que producir + cantidad. REUNION: N° asistentes + privacidad. Todos: acompañantes (con aviso "Recomendamos ir sola…"), notas.
  - `SUMMARY`: Resumen completo en tarjeta gris. Tres botones: **Cancelar** (confirma antes de cerrar), **Editar** (vuelve a SCHEDULE), **Confirmar** (crea todas las reservas).
- **Confirmacion de cancelar:** al hacer click en X o "Cancelar" en cualquier paso, aparece dialogo `"¿Cancelar la reserva? Se perderán todos los datos ingresados."` con opciones "Seguir editando" y "Sí, cancelar".
- **ESPACIO_REUNION como proposito:** la opcion "Reunion" en SCHEDULE es visible solo para LIDER_COMUNITARIA, ADMIN y SUPER_ADMIN. Al seleccionarla, el wizard auto-identifica el recurso con `category.slug === 'ESPACIO_REUNION'` del espacio y salta el paso MACHINES.
- **Multi-reserva:** en `handleConfirm`, se itera sobre `selectedResourceIds` y se llama `bookingStore.create()` por cada uno. Si una falla (ej. conflicto en servidor), el error se muestra en toast y las anteriores ya creadas se mantienen.
- **CalendarPage:** importa `BookingWizard` en lugar de `BookingModal`. Props identicas: `isOpen`, `onClose`, `preselectedDate`, `businessHours`, `maxBookingMinutes`.
- **Indicador de pasos:** componente `StepIndicator` con barras horizontales y contador `N/Total`. El total varia segun rol elevado y si el proposito es REUNION (menos pasos).
- **eventClick en CalendarView:** modificado para SIEMPRE abrir el clusterModal (recolecta todas las actividades solapadas con el evento clickeado). Antes iba directo al detalle en eventos individuales — ahora la primera interaccion siempre muestra la lista con boton "Nueva actividad en este horario".

### Feature: Acordeon en seleccion de maquinas (BookingWizard)
- El paso `MACHINES` agrupa los recursos por categoria. Cada categoria es un `<button>` con chevron, punto de color, nombre y badge de cantidad seleccionada
- Las categorias comienzan **cerradas**. Un click expande/colapsa la lista de recursos de esa categoria
- Estado: `expandedCategories: Set<string>` en `useState`; toggle con `setExpandedCategories(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })`
- Las categorias con al menos un recurso seleccionado muestran el count en un badge redondeado azul

### Feature: Agrupacion de reservas por sesion (usuario → maquinas)
- Una "sesion" es el conjunto de reservas del mismo usuario en el mismo `startTime + endTime + purpose`
- Clave de agrupacion: `${booking.userId}_${booking.startTime}_${booking.endTime}_${booking.purpose}`
- **CalendarView:** `bookingGroups` useMemo agrupa en un `Map`; `rawVisibleEvents` genera un evento por grupo. Reservas multi-maquina reciben `backgroundColor:'transparent'`, `borderColor:'#4f46e5'`
- **eventContent** booking branch: si `bGroup.length > 1`, renderiza un `<div>` con `position:absolute; inset:0; background:linear-gradient(135deg,#2563eb 0%,#7c3aed 50%,#dc2626 100%)` cubriendo toda el area del evento. Si `bGroup.length === 1`, renderiza el evento con el color de categoria como siempre
- **ClusterItem:** campo renombrado de `booking: Booking` a `bookings: Booking[]`. `VisibleFCEvent.extendedProps.bookings` es el array de reservas del grupo; `DetailModal.bookings` idem
- **BookingsPage (admin):** `groupBookings()` agrupa igual que CalendarView. La tabla muestra Usuario como columna principal y una lista de maquinas (con punto de color por categoria) en la columna Maquinas. Las acciones (aprobar/rechazar/cancelar) operan sobre todas las reservas del grupo
- **MyBookingsPage:** `groupMyBookings()` agrupa de la misma forma. `BookingGroupCard` reemplaza `BookingCard`: encabezado con fecha/hora, lista de maquinas con puntos de color, proposito, notas y boton cancelar que recorre todas las reservas del grupo

### Feature: Edicion de reservas via wizard completo
- Al hacer click en "Editar" en el modal de detalle de una reserva en el calendario, se llama `onEditBooking(bookings: Booking[])` (prop de `CalendarView`)
- `CalendarPage` tiene estado `editBookings: Booking[] | null`. `handleEditBooking` setea ese estado y abre el wizard. `handleBookingModalClose` lo limpia
- `BookingWizard` recibe prop `editBookings?: Booking[]`. `isEditMode = !!editBookings?.length`
- `makeInitialFromBookings(editBookings)`: factory que extrae del primer booking la fecha (con `new Date(first.startTime)`), horas (HH:MM formateado), proposito, y de todos los bookings los resourceIds y quantities
- Reset `useEffect`: cuando `isEditMode`, llama `makeInitialFromBookings` e inicializa en paso `SCHEDULE` (salta WHO)
- `handleConfirm` en modo edicion: 1) cancela todos los bookings originales (`bookingStore.cancel(b.id)` en paralelo), 2) crea las nuevas reservas con los datos del wizard. El `userId` del booking original se preserva como `targetUserId`
- SUMMARY en modo edicion: titulo "Revisa los cambios", boton de confirmacion "Guardar cambios"
- `onEditBooking` reemplaza a `onUpdateBooking` — la prop anterior fue eliminada de `CalendarView` y `CalendarPage`

### Feature: Color naranja reservado para Capacitaciones
- El rango naranja/ambar (matiz HSL 20–55°) esta bloqueado en el picker de colores de categorias
- `isOrangeHue(hex: string): boolean` en `CategoriesPage.tsx`: convierte hex → RGB → HSL; devuelve true si el matiz cae en [20, 55]
- `PRESET_COLORS` no incluye ningún tono naranja/ambar. Los colores reemplazados son: `#a855f7`, `#14b8a6`, `#e11d48`
- Validacion en `handleSave`: si `isOrangeHue(form.color)` → `toast.error(...)` y return temprano
- Warning en tiempo real bajo el color picker: `{isOrangeHue(form.color) && <p className="text-xs text-amber-600 mt-1">⚠️ El naranja/ámbar está reservado para Capacitaciones</p>}`
- En CalendarView, los eventos de capacitaciones usan el color naranja/ambar (`#f97316` o similar) para diferenciarse visualmente de las categorias de maquinas

### Feature: Modal de produccion en BookingWizard
- Al seleccionar proposito `PRODUCE` y avanzar desde SCHEDULE, en vez de ir directo a MACHINES se abre una mini-modal overlay que pide **Articulo a producir** (obligatorio) y **Cantidad** (obligatorio, min 1)
- El boton de SCHEDULE dice "Continuar → ¿Qué producirás?" para indicar el paso intermedio
- Al confirmar la modal, se avanza a MACHINES. "Volver" cierra la modal sin avanzar
- En el paso DETAILS, en lugar de los campos de producir se muestra un resumen (articulo + cantidad) con boton "Editar" que reabre la modal
- `showProduceModal: boolean` estado en el wizard; `handleProduceModalConfirm()` valida y avanza a MACHINES
- En modo edicion de reserva PRODUCE, el boton "Editar" del resumen en DETAILS tambien reabre la modal

### Feature: LIDER_COMUNITARIA puede crear y editar usuarios
- `POST /users` y `PATCH /users/:id` cambiados de `requireAdmin` a `requireComunitaria`
- **Backend protecciones:**
  - `updateUser`: si el actor es `LIDER_COMUNITARIA` y envia `password` → 403 (no puede cambiar contraseñas)
  - `createUser`: si el actor es `LIDER_COMUNITARIA` y el `role` no es `USER` → 403 (solo puede crear con rol Usuario)
- **Frontend (`UsersPage`):**
  - `canCreateEditUsers` = ADMIN + SUPER_ADMIN + LIDER_COMUNITARIA → muestra botones "Nueva Usuaria" y "Editar"
  - `canDeleteUsers` = ADMIN + SUPER_ADMIN → muestra botones "Eliminar" y "Exportar Excel"
  - `canChangePassword` = ADMIN + SUPER_ADMIN → muestra campo contraseña en `EditUserModal`
  - `canChangeRole` = ADMIN + SUPER_ADMIN → muestra selector de rol en `CreateUserModal` y `EditUserModal`
  - LIDER_COMUNITARIA crea usuarios con rol fijo `USER` (sin selector de rol visible)

### Feature: Gradiente para reservas multi-maquina
- Cuando una sesion tiene 2+ maquinas, el evento del calendario muestra un gradiente diagonal azul→violeta→rojo
- Implementacion: el evento FullCalendar tiene `backgroundColor:'transparent'`; en `eventContent`, si `bGroup.length > 1`, se devuelve un `<div>` con `style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#2563eb 0%,#7c3aed 50%,#dc2626 100%)', borderRadius:'inherit', overflow:'hidden' }}` y dentro el contenido de texto (nombre, "N maquinas · lista", proposito)
- En el `clusterModal`, los items de reserva multi-maquina muestran un punto con el mismo gradiente (via `background` CSS inline) en vez de un color solido

---

## Credenciales del seed

| Usuario | Email | Password | Role | Espacio |
|---------|-------|----------|------|---------|
| Super Admin | super@cowork.cl | super123 | SUPER_ADMIN | — |
| Admin | admin@cowork.cl | admin123 | ADMIN | Espacio 1 |
| Maria | maria@test.cl | password123 | USER | Espacio 1 |
| Juan | juan@test.cl | password123 | USER | Espacio 1 |
| Sofia | sofia@test.cl | password123 | USER | Espacio 1 |

Todos con `isVerified=true`. Ejecutar desde `/server/`: `npm run seed`

---

## Notas de desarrollo

- `prisma/seed.ts` en la raiz es el seed legacy — el REAL esta en `server/prisma/seed.ts`
- Al hacer `prisma generate` con el servidor corriendo, puede fallar por DLL locked (Windows). Los tipos TS se generan igual; solo reiniciar el servidor.
- El build de produccion compila el cliente y lo copia a `server/public/`, luego el Express sirve el SPA desde ahi.
- Google Calendar es completamente opcional; si no se configuran las variables de entorno, la sincronizacion simplemente no ocurre.
- **Categorias dinamicas:** nunca usar mapas estaticos (`RESOURCE_CATEGORY_COLORS`, `RESOURCE_CATEGORY_LABELS`) en el frontend — fueron eliminados. Usar siempre `resource.category?.color` y `resource.category?.name`.
- **PostgreSQL UPDATE:** no usar alias de la tabla objetivo ni JOIN al actualizar con FROM — usar sintaxis `FROM tabla1, tabla2 WHERE condicion`.
- **Prisma unique indexes:** se crean como `CREATE UNIQUE INDEX`, no como `ADD CONSTRAINT`. Para eliminarlos en SQL usar `DROP INDEX`, no `ALTER TABLE DROP CONSTRAINT`.
- **GET /api/settings/business-hours requiere `authenticate`:** sin el middleware `req.user` es undefined → `resolveSpaceId` devuelve null → 400. Siempre agregar `authenticate` a rutas de settings aunque sean solo lectura.
- **GET /api/spaces es publico:** la pagina de registro (no autenticada) necesita cargar la lista de espacios. Si se requiere auth en esa ruta, el interceptor 401 de axios redirige al login impidiendo el registro.
- **SortableHeader:** importar desde `../../components/shared/SortableHeader` — exporta `SortState`, `toggleSort`, `compareVals` y el componente default. Usar `compareVals` con `localeCompare` con opciones `{ sensitivity: 'base', numeric: true }` — funciona para strings, ISO dates y numeros.
- **Render + devDependencies:** Render setea `NODE_ENV=production`, lo que hace que `npm install` salte devDeps. Fix: `client/.npmrc` y `server/.npmrc` con `production=false`, mas la var de entorno `NPM_CONFIG_PRODUCTION=false` en Render.
- **Seed con dotenv override:** `server/prisma/seed.ts` carga dotenv con `override: true` apuntando a `server/.env`. Si `DATABASE_URL` existe como var de entorno del sistema (ej. apuntando a localhost), se sobreescribe con el valor del `.env`. El script ya no usa `-r dotenv/config`.
- **Neon connection string:** requiere `?sslmode=require` (y opcionalmente `&channel_binding=require`). Sin esto Prisma no conecta en produccion.
- **Inputs numericos en formularios:** usar `useState<string>` (no `number`) para cualquier input numerico que el usuario deba poder borrar completamente. Parsear con `parseInt(val, 10) || fallback` solo al enviar/guardar. Ver `reunionAttendees`, `produceQty`, `companionCount`, `capacity` (TrainingModal), `maxCapacity` (SettingsPage).
- **brand colors en Tailwind:** usan CSS variables (`var(--brand-50)` etc.) definidas en `index.css` con valores por defecto sky-blue. Se sobreescriben dinamicamente via `applyBrandColors()`. No usar valores hexadecimales hardcodeados para brand colors — usar siempre las clases `bg-brand-*`, `text-brand-*`. Tampoco usar modificadores de opacidad sobre brand colors (ej. `bg-brand-500/50`) porque CSS variables no se descomponen en canales RGB para Tailwind.
- **Logo de espacio:** archivo estatico en `client/public/logo-{slug}.png`. `slug` = nombre del espacio en minusculas, sin tildes, sin espacios ni caracteres especiales (usar `slugifySpaceName` como referencia). Tamano recomendado 180x180px PNG. El backend calcula y retorna el `logoUrl` en `getCustomization`; el campo `logoUrl` en la tabla `Space` existe pero no se usa (el valor se computa desde `name`).
- **Inputs de hora:** usar `type="text"` con `placeholder="HH:MM"` y `maxLength={5}`. No usar `type="time"` — el browser controla la edicion segmento a segmento y no permite borrar todo el valor. Validar con regex `/^\d{2}:\d{2}$/` antes de parsear. Comparacion de horarios HH:MM como strings lexicograficas funciona correctamente.
- **Validacion de horario de negocio sin timezone:** pasar `localDate` (YYYY-MM-DD), `localStartTime` y `localEndTime` (HH:MM) como campos adicionales en el body de creacion de reserva. El backend usa estos valores directamente contra `BusinessHours.openTime`/`closeTime` sin conversion de zona horaria. En el frontend, `new Date(date + 'T12:00:00').getDay()` para obtener el dia de la semana evita desfase UTC.
- **Rutas estaticas antes de dinamicas en Express:** `/admin/trainings/export` debe declararse ANTES de `/admin/trainings/:id` para que Express no interprete "export" como un ID de capacitacion.
- **GET /api/users usa `requireElevated`:** LIDER_COMUNITARIA puede listar usuarios del espacio (necesario para el combobox de inscripcion en TrainingsPage y CalendarPage).
- **Soft delete de usuarios:** `deletedAt DateTime?` en User. `getUsers` filtra `deletedAt: null`. Login verifica `user.deletedAt`. `createUser` con email de usuario eliminado → reactiva con `update` en vez de crear nuevo registro (evita conflicto de unique constraint en email).
- **Eliminacion de recursos:** `DELETE /api/resources/:id` — bloquea con 409 solo si hay reservas PENDING o CONFIRMED con fecha futura. Reservas pasadas o canceladas no bloquean. La transaccion elimina primero todas las reservas del recurso (para evitar FK violation), luego las exenciones de capacitaciones, luego el recurso. Igual logica en `deleteCategory` para cada recurso de la categoria.
- **Refetch silencioso en BookingsPage:** `load(silent?: boolean)` — cuando `silent=true` no muestra el spinner de carga. Los handlers de aprobar/rechazar/cancelar llaman `load(true)` para que la tabla se actualice en el acto sin flash visual.
- **maxBookingMinutes en booking.controller:** en createBooking, la consulta a `space` para obtener `maxBookingMinutes` ocurre DESPUES de fetchear el resource (necesita `resource.spaceId`). En updateBooking, la consulta a resource incluye `spaceId` y se hace una segunda query para obtener `maxBookingMinutes` del space. No se puede mover la validacion antes del fetch del resource porque se necesita el spaceId.
- **trust proxy en Render:** `app.set('trust proxy', 1)` debe declararse en `app.ts` ANTES de registrar los middlewares de rate-limit, para que `req.ip` sea la IP real del cliente (X-Forwarded-For) y no la IP del proxy de Render.
- **isExceptional en booking.controller:** la flag solo se acepta si el actor es ADMIN o SUPER_ADMIN. Un USER u otro rol enviando `isExceptional: true` en el body es ignorado silenciosamente.
- **Mantenciones bloquean todo:** el check de mantenciones en `createBooking` ocurre DESPUES del check de conflictos de reservas y aplica incluso si `isExceptional=true`. Es la ultima capa de validacion antes de crear.
- **USER_SELECT en user.controller:** usar la constante `USER_SELECT` para todos los selects de usuarios en lugar de repetir los campos — garantiza consistencia entre `getUsers`, `createUser`, `updateUser` y `getUserSummary`.
- **Rutas estaticas de usuarios:** `GET /users/export` y `GET /users/audit-logs` deben declararse ANTES de `GET /users/:id` en `user.routes.ts` para que Express no los interprete como IDs de usuario.
- **UserDetailPage tabs:** usa `useState` para el tab activo y carga todos los datos desde el endpoint `/users/:id/summary` al montar. `ConfirmModal` se reutiliza para aprobar/rechazar/revocar.
- **canManageMaintenance:** `user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'` — solo estos dos roles pueden crear, editar y eliminar mantenciones. LIDER_COMUNITARIA solo ve las mantenciones en el calendario.
- **onEditBooking en CalendarView:** reemplaza al anterior `onUpdateBooking`. Firma: `onEditBooking?: (bookings: Booking[]) => void`. Recibe el array de bookings del grupo (sesion) para que CalendarPage lo pase a BookingWizard via prop `editBookings`. No confundir con `onUpdateBooking` (eliminado).
- **Agrupacion de reservas (ClusterItem):** el campo del item de cluster cambio de `booking: Booking` (singular) a `bookings: Booking[]` (array). Todos los lugares donde se accedia a `item.booking` deben usar `item.bookings[0]` para el primer booking o iterar el array. Igualmente `VisibleFCEvent.extendedProps.bookings` es siempre un array.
- **Gradiente multi-maquina:** FullCalendar no soporta CSS gradients en `backgroundColor` — la solucion es poner `backgroundColor:'transparent'` en el evento y devolver un `<div>` con `position:absolute; inset:0` y el gradiente como `background` en `eventContent`. Necesita `borderRadius:'inherit'` para respetar el radio del evento FullCalendar.
- **makeInitialFromBookings:** factory en BookingWizard que construye el estado inicial del wizard desde un array de Booking existentes. Extrae fecha y horas del primer booking (convirtiendo ISO a HH:MM local via `new Date(first.startTime).getHours()`), proposito, resourceIds (uno por booking), quantities y campos de detalle del primer booking. El paso inicial en modo edicion es siempre `SCHEDULE` (se salta WHO).
