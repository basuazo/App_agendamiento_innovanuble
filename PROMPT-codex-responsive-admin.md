# Prompt para Codex — Corregir adaptabilidad móvil de las páginas de administración

Pégalo en Codex corriendo en la raíz del repo. Es un cambio **solo de frontend/estilos** (clases Tailwind) en las páginas admin. No cambies lógica ni datos. Todo detrás de breakpoints `sm:`/`md:` para no alterar la vista desktop. Objetivo: eliminar descuadres y overflow horizontal en móvil (~375px).

Los números de línea son aproximados (referencia); ubica el fragmento por su clase y aplícale la corrección.

---

## 1. `client/src/pages/admin/UsersPage.tsx` — ALTA prioridad

La cabecera no se apila y el input tiene ancho fijo, provocando desborde a la derecha en móvil.

- Cabecera (≈línea 88): `flex items-center justify-between mb-6`
  → `flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between`
- Grupo derecho (≈línea 97): `flex items-center gap-3`
  → `flex flex-col sm:flex-row sm:items-center gap-3`
- Input de búsqueda (≈línea 103): `w-64` → `w-full sm:w-64`
- Botones "Exportar Excel" y "Nueva Usuaria" (≈líneas 106-127): añadir `w-full sm:w-auto justify-center` a cada uno.

(La tabla y los modales ya están correctos; no los toques.)

## 2. `client/src/pages/admin/SettingsPage.tsx` — ALTA prioridad

Las filas de horarios tienen un bloque de ancho fijo + dos selects que no envuelven → overflow horizontal dentro del card.

- Fila de horario por día (≈línea 240): `flex items-center justify-between gap-4`
  → `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4`
- Grupo de horas "Desde/Hasta" (≈línea 265): `flex items-center gap-2 flex-1 justify-end`
  → `flex flex-wrap items-center gap-2 flex-1 sm:justify-end`
- Horario de colación (≈línea 210): `flex items-center gap-3`
  → `flex flex-wrap items-center gap-3`

(El grid de aforo ya usa `grid-cols-1 sm:grid-cols-2`; dejarlo.)

## 3. `client/src/pages/admin/UserDetailPage.tsx` — ALTA prioridad

La barra de pestañas no hace scroll y las etiquetas largas no caben en 375px.

- Contenedor de pestañas (≈línea 191): `flex border-b border-gray-100`
  → `flex border-b border-gray-100 overflow-x-auto`
- Botones de pestaña (≈línea 197): añadir `whitespace-nowrap flex-shrink-0` y reducir padding en móvil: `px-3 sm:px-5`.
- Cabecera (≈línea 121): `flex items-center justify-between gap-3`
  → `flex flex-wrap items-center justify-between gap-3` (y opcionalmente el `h1` a `text-xl sm:text-2xl`).

(Stats grid, ficha y tablas de tabs ya están bien.)

## 4. `client/src/pages/admin/ResourcesPage.tsx` — MODERADA

- Grupo derecho de la cabecera (≈línea 61): `flex items-center gap-3`
  → `flex flex-col sm:flex-row sm:items-center gap-3`
- Input (≈línea 67): `w-56` → `w-full sm:w-56`
- Botón "Nuevo Recurso" (≈línea 69): añadir `w-full sm:w-auto justify-center`.

## 5. `client/src/pages/admin/CategoriesPage.tsx` — MODERADA

- Grupo derecho de la cabecera (≈línea 153): `flex items-center gap-3`
  → `flex flex-col sm:flex-row sm:items-center gap-3`
- Input (≈línea 159): `w-52` → `w-full sm:w-52`
- Botón "Nueva Categoría" (≈línea 161): añadir `w-full sm:w-auto justify-center`.
- (Opcional) Banner de inactivas (≈línea 174): `flex items-center justify-between` → `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`.

## 6. `client/src/pages/superadmin/SpacesPage.tsx` — MODERADA

- Cabecera (≈línea 101): `flex items-center justify-between mb-6`
  → `flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between`
- Botón "Nuevo Espacio" (≈línea 106): añadir `w-full sm:w-auto justify-center`.
- Formulario de creación (≈línea 121): `flex gap-3` → `flex flex-col sm:flex-row gap-3`
- (Menor, consistencia) Contenedor (≈línea 100): `px-4 py-8` → `px-4 sm:px-6 lg:px-8 py-8`.

## 7. `client/src/pages/admin/TrainingsPage.tsx` — MENOR

- Grupo de botones de la cabecera (≈línea 222): `flex items-center gap-2`
  → `flex flex-wrap items-center gap-2` (o `w-full sm:w-auto` en cada botón).

## 8. `client/src/pages/admin/BookingsPage.tsx` — MEJORA OPCIONAL

Ya no descuadra. Para mejorar la lectura en móvil (la tabla tiene 7 columnas y ninguna se oculta), añadir `hidden md:table-cell` a las celdas de columnas secundarias, tanto en el `<th>` como en el `<td>` correspondiente:
- "Agrupación" (≈líneas 208 y 226)
- "Propósito" (≈líneas 211 y 256)

## Páginas que NO requieren cambios

`CustomizationPage.tsx` ya está bien resuelta para móvil. `CertificationsPage.tsx` no está en esta lista porque se está rehaciendo como checklist en otro prompt.

---

## Verificación

- `cd client && npx tsc --noEmit` pasa.
- Revisa en un viewport de 375px que ninguna de estas páginas genere **scroll horizontal de toda la página**; las cabeceras se apilan, los inputs ocupan el ancho completo y las filas de horarios envuelven sin cortarse.
- En `≥ sm`/`md` (desktop) las páginas se ven igual que antes (los cambios solo agregan comportamiento apilado en móvil).
- Las tablas siguen con su `overflow-x-auto` para el scroll interno controlado.
