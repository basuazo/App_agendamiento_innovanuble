# CoWork — App de Agendamiento de Máquinas y Espacios

Aplicación web full-stack para gestionar reservas de máquinas y espacios de coworking por agrupaciones. Soporta múltiples centros productivos (espacios), permisos de uso por categoría de máquina, aprobación de usuarios nuevos y sincronización opcional con Google Calendar.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + FullCalendar + Zustand
- **Backend**: Node.js + Express + TypeScript
- **Base de datos**: PostgreSQL + Prisma ORM (Neon en producción, Docker local)
- **Auth**: JWT + bcrypt
- **Hosting**: Render (Web Service)
- **Google Calendar**: API con Service Account (opcional)

---

## Requisitos previos

- Node.js v18 o superior
- Docker (recomendado para la BD) o PostgreSQL local

---

## Instalación

### 1. Configurar variables de entorno

```bash
cp .env.example server/.env
```

Editar `server/.env`:

```env
DATABASE_URL="postgresql://postgres:cowork123@localhost:5432/cowork_db"
JWT_SECRET="cambia_esto_por_algo_seguro_de_al_menos_32_caracteres"
JWT_EXPIRES_IN="7d"
PORT=3001
CLIENT_URL="http://localhost:5173"

# Google Calendar (opcional)
GOOGLE_CALENDAR_ID=""
GOOGLE_SERVICE_ACCOUNT_EMAIL=""
GOOGLE_PRIVATE_KEY=""
```

### 2. Levantar la base de datos

```bash
docker compose up db -d
```

O con PostgreSQL local: crear la DB manualmente y ajustar `DATABASE_URL`.

### 3. Instalar dependencias

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 4. Ejecutar migraciones

```bash
cd server
npx prisma migrate dev --name init
cd ..
```

### 5. Ejecutar el seed

```bash
cd server && npm run seed
```

Crea los usuarios de prueba (ver sección Credenciales) y datos de ejemplo.

### 6. Iniciar en desarrollo

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001/api/health

---

## Credenciales de prueba

| Rol | Email | Contraseña | Acceso |
|-----|-------|------------|--------|
| Super Admin | super@cowork.cl | super123 | Todos los espacios |
| Admin | admin@cowork.cl | admin123 | Espacio 1 |
| Usuario | maria@test.cl | password123 | Espacio 1 |
| Usuario | juan@test.cl | password123 | Espacio 1 |
| Usuario | sofia@test.cl | password123 | Espacio 1 |

---

## Roles y permisos

| Rol | Descripción |
|-----|-------------|
| `SUPER_ADMIN` | Gestiona todos los espacios. Selecciona el espacio activo en el Navbar. Sin spaceId propio. |
| `ADMIN` | Administra su espacio: usuarios, recursos, categorías, reservas, permisos de uso, horarios. |
| `LIDER_COMUNITARIA` | Aprueba reservas, gestiona categorías, recursos y permisos de uso, verifica y crea/edita usuarias. |
| `USER` | Reserva máquinas para su agrupación, accede a la comunidad, consulta sus permisos de uso. |

**Matriz de permisos resumida:**

| Acción | ADMIN | LIDER_COMUNITARIA |
|--------|:-----:|:-----------------:|
| Gestionar recursos | ✓ | ✓ |
| Gestionar categorías | ✓ | ✓ |
| Otorgar / revocar permisos de uso | ✓ | ✓ |
| Capacitaciones (crear/eliminar/exportar) | ✓ | — |
| Inscribir/desinscribir otras usuarias | ✓ | ✓ |
| Aprobar/rechazar reservas | ✓ | ✓ |
| Ver todas las reservas | ✓ | ✓ |
| Exportar reservas a Excel | ✓ | ✓ |
| Agendar por otra usuaria | ✓ | ✓ |
| Ver lista de usuarios | ✓ | ✓ |
| Verificar nuevos usuarios | ✓ | ✓ |
| Crear/editar usuarias (sin cambiar contraseña) | ✓ | ✓ |
| Eliminar usuarios / cambiar contraseña / cambiar rol | ✓ | — |
| Configurar horarios y aforo | ✓ | — |
| Hora excepcional (sin restricciones) | ✓ | — |
| Gestionar mantenciones / cierres | ✓ | — |
| Exportar usuarios a Excel | ✓ | — |
| Ver ficha de usuaria | ✓ | ✓ |

El registro de nuevos usuarios queda en estado **pendiente** hasta que un admin o Líder Comunitaria lo verifique.

---

## Arquitectura multi-espacio

Cada **Space** (centro productivo) tiene sus propias:
- **Categorías** de máquinas (dinámicas, con nombre y color personalizados)
- **Recursos** (máquinas/equipos) agrupados por categoría
- **Usuarios** (ADMIN y USER)
- **Horarios de negocio** configurables

El header `X-Space-Id` se envía automáticamente en cada request del frontend. El backend usa `resolveSpaceId(req)` para determinar el espacio activo según el rol.

---

## Features principales

- **Reservas por agrupación (wizard multi-paso)**: las reservas se realizan en nombre de una agrupación, no de una persona individual. El wizard registra el nombre de la agrupación y el número de personas que asistirán (para control de aforo). La selección de máquinas es **opcional** — se puede reservar el espacio sin asignar una máquina específica. El botón "Omitir" en el paso de máquinas permite avanzar sin seleccionar ninguna. El wizard guía en pasos: 1) ¿para quién? (roles elevados), 2) fecha/hora/propósito, 3) agrupación y número de personas, 4) selección de máquinas (opcional), 5) detalles, 6) resumen.

- **Calendario interactivo con filtro**: vista semanal con FullCalendar. Un input de búsqueda encima del calendario filtra los eventos en tiempo real por nombre de agrupación o nombre de usuaria. Las actividades que se solapan en el tiempo se agrupan automáticamente ("N actividades"). Las reservas multi-máquina se muestran con un gradiente azul→violeta→rojo.

- **Validación de horario de negocio**: el wizard muestra el horario del espacio en tiempo real y bloquea horas fuera del rango configurado, tanto en frontend como en backend.

- **Permisos de uso**: ADMIN y LIDER_COMUNITARIA otorgan y revocan permisos de uso directamente desde `/admin/certifications`. La página tiene un combobox de búsqueda de usuarias y muestra el estado de permiso por categoría. Sin permiso → reserva PENDING. Con permiso o categoría sin restricción → reserva CONFIRMED directa.

- **Capacitaciones**: solo ADMIN puede crear y editar sesiones de capacitación con cupos configurables. Las usuarias se inscriben desde `/my-bookings` o desde el popup del calendario. Cupos llenos → lista de espera con promoción automática.

- **Sala de reuniones como propósito**: la opción "Reunión" aparece como propósito en el wizard (solo roles elevados). Se auto-asigna la sala, se salta la selección de máquinas y se muestran campos de N° de asistentes y privacidad.

- **Tablas admin ordenables y responsivas**: todas las tablas admin permiten ordenar A→Z / Z→A y filtrar con búsqueda en tiempo real. En móvil hacen scroll horizontal.

- **Hora Excepcional**: ADMIN y SUPER_ADMIN pueden agendar fuera del horario de negocio sin límite de duración. Las mantenciones sí bloquean incluso las horas excepcionales.

- **Mantenciones / Cierre de espacio**: ADMIN y SUPER_ADMIN pueden bloquear el espacio completo por un período determinado. Durante una mantención no se pueden crear reservas de ningún tipo.

- **Aforo configurable**: el aforo se controla sumando los asistentes de todas las reservas activas en el mismo horario (no el número de reservas). Cada espacio tiene dos límites editables desde Configuración — uno para máquinas y otro para la sala de reuniones.

- **Exportaciones a Excel**: reservas, usuarios y capacitaciones exportables en `.xlsx` desde las páginas admin correspondientes.

- **Ficha de usuaria**: estadísticas, historial de reservas, inscripciones y permisos de uso desde `/admin/users/:id`.

- **Personalización por espacio**: color principal de la UI (CSS variables) y logo estático por espacio.

- **Comunidad**: foro interno con posts etiquetados e imágenes.

- **Google Calendar**: sincronización automática de reservas CONFIRMED (opcional).

---

## Seguridad y producción

- **Helmet** — headers HTTP seguros (X-Frame-Options, HSTS, etc.)
- **Compresión HTTP** — middleware `compression` (gzip/brotli) en todas las respuestas
- **Rate limiting** — 50 intentos / 15 min en login y registro (por IP real via `trust proxy`)
- **CORS** restringido a `CLIENT_URL`; body limit 1 MB
- **JWT** con validación de secret ≥ 32 chars en startup; bcrypt salt 10
- **Logs estructurados** — pino JSON en producción, pretty en desarrollo
- **Graceful shutdown** — SIGTERM/SIGINT cierran el servidor y desconectan la BD
- **Health check** — `GET /api/health` verifica conexión a BD (usado por Render)
- **SPA fallback** — Express sirve `index.html` para todas las rutas no-API en producción
- **Seed protegido** — aborta con error si `NODE_ENV === 'production'`

---

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Cliente (5173) + servidor (3001) en paralelo |
| `npm run build:prod` | Build completo para producción |
| `npm run start` | Inicia en producción (requiere build previo) |
| `cd server && npm run seed` | Poblar BD con datos de prueba |
| `cd server && npx prisma migrate dev --name <nombre>` | Nueva migración |
| `cd server && npx prisma studio` | Explorador visual de BD |
| `docker compose up db -d` | Levantar solo la BD en Docker |

---

## Configurar Google Calendar (opcional)

Si no se configura, la app funciona igualmente. Las reservas solo se guardan en PostgreSQL.

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Habilitar **Google Calendar API**
3. Crear una **Service Account** y descargar el JSON de credenciales
4. Crear un calendario en [calendar.google.com](https://calendar.google.com) y compartirlo con el email del service account (permiso: *Realizar cambios en eventos*)
5. Copiar el ID del calendario y las credenciales del service account a `server/.env`

> El `private_key` del JSON tiene saltos de línea reales; en el `.env` deben ser `\n` literales.

---

## Estructura del proyecto

```
/
├── client/          # React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── admin/       # UsersPage, BookingsPage, ResourcesPage, TrainingsPage, CertificationsPage, etc.
│       │   ├── superadmin/  # SpacesPage
│       │   ├── MyBookingsPage.tsx   # reservas de máquina + inscripciones a capacitaciones (tabs)
│       │   └── MyCertificationsPage.tsx  # "Mis Permisos de Uso"
│       ├── components/shared/  # Navbar, ConfirmModal, SortableHeader, etc.
│       ├── store/           # Zustand: authStore, bookingStore, resourceStore, brandingStore
│       └── utils/           # dateHelpers, apiError, colorHelpers
├── server/          # Express API
│   └── src/
│       ├── controllers/
│       ├── routes/
│       ├── middleware/      # auth, role, upload
│       └── services/        # booking, googleCalendar
├── prisma/          # Schema y migraciones
└── .env.example
```

---

## Reglas de negocio

- **Agendamiento por agrupación**: una reserva representa a una agrupación (no una persona individual). Se registra `groupName` (nombre de la agrupación) y `attendees` (número de personas). La asignación de máquina es opcional — una reserva puede existir sin `resourceId`.
- **Aforo**: se controla sumando `attendees` de todas las reservas activas (CONFIRMED + PENDING) en el mismo horario. `maxCapacity` para máquinas, `maxCapacityReunion` para sala. No aplica a ADMIN/SUPER_ADMIN.
- **Filtro por espacio con resourceId null**: las reservas sin máquina asignada se filtran por `user.spaceId` en lugar de `resource.spaceId`.
- Duración máxima de reserva **configurable por espacio** (30 min a 4 h; default 4 h). Horario configurable por espacio (default lun–sáb 09:00–17:00).
- **Permiso de uso por categoría** (internamente `Certification`). Sin permiso → PENDING. Con permiso o categoría sin restricción → CONFIRMED.
- **Conflicto**: `startA < endB AND endA > startB` → error 409.
- Google Calendar sincroniza solo reservas CONFIRMED (solo si tiene `resource`).
- Registro auto-servicio → `isVerified=false`; admin debe verificar antes de que pueda ingresar.
- **Soft delete de usuarios**: `deletedAt` marca la eliminación sin borrar el historial.
- **Edición de reservas**: el wizard cancela las reservas originales y crea las nuevas al confirmar.
- **Hora excepcional**: omite validación de horario y duración máxima. Las mantenciones sí bloquean.
- **Mantenciones**: bloquean cualquier reserva (normal o excepcional) que se solape.

---

## Deploy en producción (Render + Neon)

### Build Command
```
npm install && cd client && npm install && cd ../server && npm install && npx prisma generate && npx prisma migrate deploy --schema=../prisma/schema.prisma && cd .. && npm run build:prod
```

### Start Command
```
npm run start
```

### Variables de entorno requeridas en Render

| Variable | Valor |
|---|---|
| `DATABASE_URL` | URL de Neon (`postgresql://...?sslmode=require`) |
| `JWT_SECRET` | cadena aleatoria larga (mín. 32 chars) |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `CLIENT_URL` | URL asignada por Render |
| `NPM_CONFIG_PRODUCTION` | `false` |

### Notas
- `client/.npmrc` y `server/.npmrc` incluyen `production=false` para que `npm install` instale devDependencies durante el build.
- Las migraciones se aplican automáticamente en cada deploy.
- El plan gratuito de Render hiberna el servicio tras 15 min de inactividad — el primer request puede tardar ~30 seg.
- El seed **no corre automáticamente** en producción. Ejecutar `cd server && npm run seed` localmente con `server/.env` apuntando a Neon.
