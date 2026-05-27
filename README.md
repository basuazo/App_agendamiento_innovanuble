# CoWork — App de Agendamiento de Máquinas y Espacios

Aplicación web full-stack para gestionar reservas de máquinas textiles y espacios de coworking. Soporta múltiples centros productivos (espacios), certificaciones por categoría de máquina, aprobación de usuarios nuevos y sincronización opcional con Google Calendar.

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
| `ADMIN` | Administra su espacio: usuarios, recursos, categorías, reservas, certificaciones, horarios. |
| `LIDER_COMUNITARIA` | Aprueba reservas, gestiona categorías, recursos y certificaciones, verifica y crea/edita usuarias. |
| `USER` | Reserva máquinas, accede a la comunidad, consulta sus certificaciones. |

**Matriz de permisos resumida:**

| Acción | ADMIN | LIDER_COMUNITARIA |
|--------|:-----:|:-----------------:|
| Gestionar recursos | ✓ | ✓ |
| Gestionar categorías | ✓ | ✓ |
| Certificar / revocar usuarias | ✓ | ✓ |
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

- **Calendario interactivo**: vista semanal con FullCalendar. Las actividades que se solapan en el tiempo se agrupan automáticamente en un evento único "N actividades" (cluster). Hacer click en cualquier evento — sea uno solo o un cluster — siempre abre el modal de actividades del horario, mostrando la lista de actividades y el botón "Nueva actividad en este horario". Las reservas multi-máquina se muestran como un único evento con gradiente azul→violeta→rojo.
- **Reservas centradas en persona (wizard multi-paso)**: el flujo de reserva es por persona, no por máquina. Un wizard guía en 4–5 pasos: 1) ¿para quién? (roles elevados), 2) fecha/hora/propósito, 3) selección de máquinas (multi-select con categorías en acordeón), 4) detalles, 5) resumen. Se pueden reservar varias máquinas a la vez en el mismo horario. Si se cancela el proceso, aparece un diálogo de confirmación antes de perder los datos. La edición de una reserva abre el wizard completo pre-relleno con todos los datos, cancela las reservas originales y crea las nuevas al confirmar.
- **Validación de horario de negocio**: el wizard muestra el horario del espacio en tiempo real y bloquea horas fuera del rango configurado, tanto en frontend (feedback inmediato) como en backend (validación de seguridad).
- **Sistema de certificaciones**: ADMIN y LIDER_COMUNITARIA certifican y revocan directamente desde `/admin/certifications`. La página tiene un combobox de búsqueda de usuarias y muestra una tabla con el estado de certificación por categoría. Certificar abre una fila expandible para ingresar notas opcionales. No hay flujo de solicitudes ni sesiones programadas — la certificación es un acto directo del rol elevado.
- **Capacitaciones**: solo ADMIN puede crear y editar sesiones de capacitación con cupos y horarios configurables (HH:MM). Las usuarias se inscriben desde la pestaña "Capacitaciones" en `/my-bookings` o desde el popup de la capacitación en el calendario. Cupos llenos → lista de espera con promoción automática. Desde el popup del calendario el admin puede editar, eliminar o agendar en el mismo horario (si hay recursos libres por exenciones). La página `/admin/trainings` muestra el listado completo con las inscritas.
- **Inscripción por otras usuarias**: los roles elevados pueden inscribir y desinscribir a otras usuarias en capacitaciones desde `/admin/trainings` y también desde el popup de capacitación en el calendario, usando un combobox de búsqueda por nombre o email. La lista de inscritas es visible para todas las usuarias (solo lectura para USER).
- **Exportación de capacitaciones a Excel**: desde `/admin/trainings`, solo ADMIN puede descargar un `.xlsx` con el listado de todas las capacitaciones y sus inscripciones.
- **Sala de reuniones como propósito**: la opción "Espacio de Reuniones" ya no aparece como una categoría de máquina, sino como un **propósito** en el wizard de reservas, visible solo para LIDER_COMUNITARIA, ADMIN y SUPER_ADMIN. Al seleccionarla se salta la selección de máquinas (se auto-asigna la sala), y se muestran campos de N° de asistentes, privacidad y notas contextuales.
- **Comunidad**: foro interno con posts etiquetados (GENERAL, MACHINE_ISSUE, ORDER, CLEANING) e imágenes.
- **Tablas admin ordenables y responsivas**: todas las tablas admin permiten ordenar A→Z / Z→A y filtrar con búsqueda en tiempo real. En móvil hacen scroll horizontal.
- **Roles jerárquicos**: cuatro roles con permisos granulares (SUPER_ADMIN, ADMIN, LIDER_COMUNITARIA, USER).
- **Registro de qué se va a producir**: al seleccionar el propósito "Producir" en el wizard, se abre una modal intermedia que solicita el artículo a producir y la cantidad antes de pasar a la selección de máquinas.
- **Agendar por otra usuaria**: todos los roles elevados pueden crear reservas a nombre de cualquier usuaria del espacio. El paso "¿Para quién?" es el primero del wizard y aparece solo para estos roles.
- **Exportación de reservas a Excel**: desde la página Todas las Reservas, ADMIN y LIDER_COMUNITARIA pueden descargar un `.xlsx` con el detalle completo.
- **Aforo configurable**: cada espacio tiene dos límites editables desde Configuración — uno para máquinas y otro para la sala de reuniones.
- **Duración máxima de agendamiento configurable**: desde Configuración, el admin puede establecer el tiempo máximo por reserva en intervalos de 30 min (desde 30 min hasta 4 horas). Se aplica tanto en frontend (feedback en tiempo real) como en backend.
- **Eliminación de recursos**: los roles elevados pueden eliminar recursos desde la página de Recursos. Si el recurso tiene reservas históricas, el sistema bloquea la eliminación e indica que debe desactivarse en su lugar.
- **Soft delete de usuarios**: al eliminar un usuario sus datos históricos (reservas, certificaciones, inscripciones) se conservan. Si se crea un nuevo usuario con el mismo email, el sistema reactiva la cuenta con los nuevos datos en vez de generar un error.
- **Personalización por espacio**: desde `/admin/customization`, ADMIN y SUPER_ADMIN pueden configurar el color principal de la interfaz (botones, enlaces, indicadores). El logo se carga automáticamente desde un archivo estático en `client/public/` con el nombre normalizado del espacio (ej. `logo-puentealto.png`).
- **Hora Excepcional**: ADMIN y SUPER_ADMIN pueden agendar fuera del horario de negocio configurado y sin límite de duración. La reserva se marca como `isExceptional` y el backend omite las validaciones de horario y duración máxima. Las mantenciones sí bloquean incluso las horas excepcionales.
- **Mantenciones / Cierre de espacio**: ADMIN y SUPER_ADMIN pueden bloquear el espacio completo por un período determinado (sin límite de duración). Durante una mantención no se pueden crear reservas de ningún tipo. Las mantenciones aparecen en el calendario con fondo rojo y son editables y eliminables desde el popup de detalle.
- **Ficha de usuaria**: desde la lista de usuarios, todos los roles elevados pueden acceder a una página de detalle (`/admin/users/:id`) con estadísticas de reservas, historial de reservas (filtrable por estado), inscripciones a capacitaciones y certificaciones vigentes. ADMIN puede aprobar/rechazar reservas pendientes y revocar certificaciones directamente desde la ficha.
- **Exportación de usuarios a Excel**: ADMIN y SUPER_ADMIN pueden descargar un `.xlsx` con el listado completo de usuarias del espacio (nombre, email, teléfono, agrupación, rol, estado).
- **Teléfono de usuaria**: campo opcional de teléfono en el perfil. Editable desde Perfil y desde el panel de edición de usuarios en admin.
- **Agrupación en calendario con organización**: los eventos de reserva muestran el nombre de la agrupación (`organization`) de la usuaria como subtítulo, facilitando la identificación en el calendario.
- **Color naranja reservado para Capacitaciones**: el rango de tonos naranja/ámbar (matiz HSL 20–55°) está bloqueado en el selector de colores de categorías. Los presets excluyen esos tonos y el formulario valida en tiempo real, mostrando una advertencia si el color custom elegido cae en ese rango.
- **Agrupación de reservas por sesión (usuario → máquinas)**: en el calendario y en las tablas admin/usuario, las reservas del mismo usuario en el mismo horario y propósito se agrupan como una única sesión. Una sesión con varias máquinas se muestra con un evento con gradiente azul→violeta→rojo y lista de máquinas como subtítulo.
- **Google Calendar**: sincronización automática de reservas CONFIRMED (opcional).

---

## Seguridad y producción

- **Helmet** — headers HTTP seguros (X-Frame-Options, HSTS, etc.)
- **Compresión HTTP** — middleware `compression` (gzip/brotli) en todas las respuestas
- **Rate limiting** — 50 intentos / 15 min en login y registro (por IP real via `trust proxy`)
- **CORS** restringido a `CLIENT_URL`; body limit 1 MB
- **JWT** con validación de secret ≥ 32 chars en startup; bcrypt salt 10
- **Logs estructurados** — pino JSON en producción, pretty en desarrollo; todos los errores de controllers usan `logger.error`
- **Graceful shutdown** — SIGTERM/SIGINT cierran el servidor y desconectan la BD
- **Health check** — `GET /api/health` verifica conexión a BD (usado por Render)
- **SPA fallback** — Express sirve `index.html` para todas las rutas no-API en producción
- **Favicon** real en `/favicon.svg`; `noindex/nofollow` en `index.html` (app privada)
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
│       │   ├── admin/       # UsersPage, BookingsPage, ResourcesPage, TrainingsPage, etc.
│       │   ├── superadmin/  # SpacesPage
│       │   ├── MyBookingsPage.tsx   # reservas de máquina + inscripciones a capacitaciones (tabs)
│       │   └── MyCertificationsPage.tsx
│       ├── components/shared/  # Navbar, ConfirmModal, SortableHeader, etc.
│       ├── store/           # Zustand: authStore, bookingStore, resourceStore, brandingStore
│       └── utils/           # dateHelpers, apiError, colorHelpers (generación de paleta de colores)
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

- **Agendamiento multi-máquina**: una persona puede seleccionar varias máquinas en el mismo horario. El wizard crea una reserva (`Booking`) por cada máquina seleccionada, con los mismos datos de fecha/hora/propósito/detalles. Si una creación falla (ej. conflicto), las anteriores ya creadas se mantienen y el error se muestra en pantalla.
- Duración máxima de reserva **configurable por espacio** desde la página de Configuración (30 min a 4 h en intervalos de 30 min; default 4 h). Horario configurable por espacio (default lun–sáb 09:00–17:00)
- **Horario de negocio**: las reservas no pueden crearse fuera del horario configurado del espacio. El formulario muestra el horario en tiempo real y el backend lo valida independientemente.
- **Certificación por categoría**, no por máquina individual. Sin cert → reserva PENDING. Roles elevados o recursos con `requiresCertification=false` → reserva CONFIRMED directa
- **Conflicto**: `startA < endB AND endA > startB` → error 409
- Google Calendar sincroniza solo reservas CONFIRMED
- Registro auto-servicio → `isVerified=false`; admin debe verificar antes de que pueda ingresar
- **Soft delete de usuarios**: `deletedAt` marca la eliminación sin borrar el historial. Un usuario eliminado no aparece en listas ni puede iniciar sesión. Si se crea un usuario con el mismo email, la cuenta se reactiva con los nuevos datos
- **Eliminación de recursos**: solo bloqueada si hay reservas activas (PENDING o CONFIRMED) con fecha futura. Reservas pasadas o canceladas no impiden la eliminación
- **Inscripción a capacitaciones**: cupos configurables por sesión. Al llenarse, las siguientes inscripciones van a lista de espera. Al cancelar una inscripción CONFIRMED, la primera en espera se promueve automáticamente a CONFIRMED
- **Inscripción por roles elevados**: ADMIN, SUPER_ADMIN y LIDER_COMUNITARIA pueden inscribir y desinscribir a otras usuarias en capacitaciones
- **Hora excepcional**: las reservas marcadas como `isExceptional` (solo roles ADMIN/SUPER_ADMIN) omiten la validación de horario de negocio y de duración máxima. Las mantenciones sí las bloquean igualmente
- **Mantenciones**: un período de mantenimiento bloquea la creación de **cualquier** reserva (normal o excepcional) que se solape con él. El backend devuelve 409 con mensaje descriptivo
- **Edición de reservas**: el propietario de una reserva (o un rol elevado) puede editarla desde el detalle en el calendario. Al hacer click en "Editar" se abre el wizard completo pre-relleno con todos los pasos (fecha, hora, máquinas, detalles). Al confirmar, las reservas originales se cancelan y se crean las nuevas con los datos actualizados. No se puede editar si la reserva está CANCELADA o RECHAZADA
- **Revocación de certificación**: elimina la `Certification`. La usuaria vuelve a estado sin certificación y sus futuras reservas en esa categoría serán PENDING hasta que la certifiquen nuevamente
- **Agrupación de actividades en el calendario**: cuando dos o más actividades se solapan en el tiempo, se reemplazan por un único evento "N actividades" (algoritmo union-find). Al hacer click se abre un modal que lista todas las actividades con opción de acceder a cada una individualmente
- **Personalización de marca**: el color principal de la UI se almacena en BD por espacio y se aplica como CSS variables al cargar; el logo se resuelve desde `client/public/logo-{slug}.png` donde `slug` es el nombre del espacio normalizado (minúsculas, sin tildes ni espacios)

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
