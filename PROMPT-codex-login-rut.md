# Prompt para Codex — Reemplazar email por RUT (usuario) en el login

Pégalo en Codex corriendo en la raíz del repo. Es un cambio de autenticación: reemplaza el correo electrónico por un **nombre de usuario que es el RUT** (sin puntos ni guión). Toca backend, frontend, esquema de BD y seed. No hay usuarias reales que preservar (se puede recrear/re-sembrar la base). No se valida dígito verificador, solo se normaliza el formato.

## Decisión de diseño

- El campo de login pasa a llamarse **`username`** en el modelo, y su valor es el **RUT normalizado**.
- **Normalización del RUT** (aplícala en registro, login y creación/edición de usuarias): quitar puntos, guión y espacios, y pasar a mayúscula (por la "K"). Ejemplo: `12.345.678-9` → `123456789`; `7.654.321-k` → `7654321K`. **No** se valida el dígito verificador.
- Se **elimina** el campo `email` por completo (no queda como opcional).
- En la interfaz, el campo se etiqueta como **"RUT"** (aunque internamente el campo sea `username`).

## 1. Utilidad de normalización

Crea `server/src/lib/rut.ts`:
```ts
export function normalizeRut(raw: string): string {
  return (raw ?? '').replace(/[.\-\s]/g, '').toUpperCase();
}
```

## 2. Base de datos (`prisma/schema.prisma`)

En el modelo `User`, reemplaza el campo `email String @unique` por `username String @unique`. No cambies el resto de campos. Genera la migración correspondiente (por ejemplo `npx prisma migrate dev --name replace_email_with_username`). Como no hay datos que preservar, está bien resetear la base de desarrollo (`npx prisma migrate reset`).

## 3. Backend

**`server/src/controllers/auth.controller.ts`**
- `register`: recibir `username` en vez de `email`. Normalizarlo con `normalizeRut`. Validar que venga (mensaje: "RUT y contraseña son requeridos"). Verificar unicidad por `username` (mensaje 409: "El RUT ya está registrado"). Guardar `username` normalizado. Actualizar el mensaje de la notificación `USER_PENDING` para usar el nombre/RUT en vez del email.
- `login`: recibir `username` + `password`. Normalizar `username`. Buscar con `findUnique({ where: { username } })`. Mantener las validaciones de `deletedAt` e `isVerified`.
- JWT: en el payload reemplaza `email` por `username`.
- Respuesta de `login` y `getMe`: devolver `username` en vez de `email`.
- `updateMe`: quitar el manejo de `email`. El usuario **no** puede cambiar su propio `username` (RUT); solo se editan `name`, `organization`, `phone`.

**`server/src/controllers/user.controller.ts`**
- Crear y editar usuaria: reemplazar `email` por `username`, normalizándolo con `normalizeRut`. Mantener las verificaciones de unicidad (adaptadas a `username`). El resto de la lógica (roles, verificación, soft delete, cambio de contraseña por admin) queda igual.

**`server/src/controllers/booking.controller.ts`**
- En los `select` de `user` reemplaza `email` por `username`.
- En la exportación a Excel, cambia la columna `'Email Usuario'` por `'RUT Usuario'` usando `username`.

**Otros controladores** (`training.controller.ts`, `certification.controller.ts`) y **`server/src/middleware/auth.middleware.ts`**: reemplaza cualquier referencia a `email` (en `select` de Prisma o en el payload del token) por `username`.

**Seeds** (`prisma/seed.ts`, `server/prisma/seed.ts`, `server/prisma/insert-usuarias-pa.ts`): reemplaza los `email` de los usuarios de prueba por `username` con RUTs normalizados de ejemplo (inventa RUTs plausibles, distintos entre sí, ya normalizados sin puntos ni guión). Mantén las contraseñas de prueba.

## 4. Frontend

Reemplaza `email` por `username` (etiquetado "RUT" en la UI) en:

- **`client/src/types/index.ts`**: en el tipo `User`, `email` → `username`.
- **`client/src/store/authStore.ts`** y **`client/src/services/auth.service.ts`**: el tipo/payload de login y del usuario usa `username`. El login envía `{ username, password }`.
- **`client/src/pages/LoginPage.tsx`**: el campo "Correo/Email" pasa a ser **"RUT"** (input de tipo texto, `inputMode="text"`), con un placeholder como `12.345.678-9` y una ayuda breve ("puedes escribirlo con o sin puntos y guión"). Envía el valor tal cual; el backend lo normaliza.
- **`client/src/pages/RegisterPage.tsx`**: reemplaza el campo de correo por **RUT** con la misma lógica.
- **`client/src/services/user.service.ts`**: `email` → `username` en tipos y payloads.
- **`client/src/pages/admin/UsersPage.tsx`**: la columna y el formulario de crear/editar usaria muestran **"RUT"** (`username`). Ajusta también el buscador si filtra por email.
- **`client/src/pages/admin/UserDetailPage.tsx`** y **`client/src/pages/ProfilePage.tsx`**: mostrar el RUT (`username`) en vez del correo. En el perfil, el RUT se muestra como dato **no editable**.
- **`client/src/pages/CalendarPage.tsx`** (componente `UserCombobox`), **`client/src/components/booking/BookingWizard.tsx`**, **`client/src/components/booking/BookingModal.tsx`**, **`client/src/pages/admin/CertificationsPage.tsx`**, **`client/src/pages/admin/BookingsPage.tsx`**, **`client/src/pages/admin/TrainingsPage.tsx`**: donde se busque o muestre el email de una usuaria, usar `username` (RUT). Actualiza los textos de búsqueda tipo "buscar por nombre o email" → "buscar por nombre o RUT".

## 5. Verificación

- `cd server && npx tsc --noEmit` y `cd client && npx tsc --noEmit` pasan sin errores.
- No queda ninguna referencia a `email` de usuaria en `server/src` ni en `client/src` (búsqueda global). La única aparición válida de "email" es `SERVICE_ACCOUNT_EMAIL` en `googleCalendar.service.ts`, que **no** se toca.
- Registro con un RUT con puntos y guión queda guardado normalizado (sin puntos ni guión).
- Login funciona escribiendo el RUT con o sin formato (porque se normaliza en ambos lados).
- Dos usuarias no pueden tener el mismo RUT (unicidad).
- `cd server && npm run seed` crea las usuarias de prueba con RUT.

## 6. Nota de despliegue (para el usuario, no para Codex)

Como el campo único cambió, en producción (Neon) hay que aplicar la migración sobre una base sin datos: resetear/recrear la base y volver a correr el seed. Documentar esto en el `README` (sección deploy) y actualizar la tabla de credenciales de prueba para usar RUT en vez de email.
