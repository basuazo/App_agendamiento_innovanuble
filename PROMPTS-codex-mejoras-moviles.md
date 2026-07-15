# Prompts para Codex — Mejoras de experiencia móvil (CoWork)

Basado en `PLAN-mejoras-moviles.md`. Cada prompt es **independiente y desplegable por separado**. Ejecútalos en orden: cada uno asume que el anterior ya está aplicado. Pégalos uno a uno en Codex, corriendo en la raíz del repo.

**Reglas comunes (aplican a todos los prompts):**
- Frontend en `/client` (React 18 + TypeScript + Vite + Tailwind + FullCalendar + Zustand).
- No cambiar backend ni lógica de negocio.
- No alterar la experiencia en `≥ md` (768px+): todo cambio móvil va detrás de breakpoints `md:` o del hook `useIsMobile`.
- Al terminar cada prompt: correr `cd client && npx tsc --noEmit` (debe pasar) y entregar un resumen de archivos tocados.

---

## Prompt 1 — Hook `useIsMobile` (detección reactiva)

**Tarea:** Crear un hook reutilizable que detecte viewport móvil de forma reactiva y reemplazar la detección puntual existente.

1. Crea `client/src/hooks/useIsMobile.ts` con un hook `useIsMobile(breakpoint = 767)` que use `window.matchMedia('(max-width: ${breakpoint}px)')`, se suscriba al evento `change` y devuelva un `boolean`. Maneja SSR/undefined `window` con un valor inicial seguro y limpia el listener en el `useEffect` de retorno.
2. En `client/src/components/calendar/CalendarView.tsx`, reemplaza la línea `const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;` (aprox. línea 299) por `const isMobile = useIsMobile();` e importa el hook. Verifica que el resto del componente que depende de `isMobile` (config de FullCalendar `initialView`/`headerToolbar`) siga funcionando.

**Verificación:** `npx tsc --noEmit` pasa; al redimensionar/rotar, el calendario cambia entre vista día y semana sin recargar.

---

## Prompt 2 — Barra de navegación inferior (bottom tab bar)

**Tarea:** Agregar una barra de navegación inferior fija visible solo en móvil, y reducir el menú hamburguesa a lo secundario.

Contexto: hoy toda la navegación móvil está en el hamburguesa de `client/src/components/shared/Navbar.tsx`. El layout está en `client/src/App.tsx` (componente `Layout`).

1. Crea `client/src/components/shared/BottomNav.tsx`:
   - Visible solo en `< md` (`md:hidden`), `fixed bottom-0 inset-x-0 z-50`, fondo blanco, borde superior y sombra.
   - 4 ítems con ícono (SVG inline, mismo estilo que el Navbar) + etiqueta corta: **Calendario** (`/calendar`), **Mis Reservas** (`/my-bookings`), **Comunidad** (`/community`), **Permisos** (`/my-certifications`).
   - Estado activo según `useLocation().pathname` (color `text-brand-600`, inactivo `text-gray-500`).
   - Cada ítem `min-h-[56px]`, área táctil cómoda, distribuidos con `flex justify-around`.
   - Respetar el safe-area de iPhone: `style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}`.
2. En `client/src/App.tsx`, renderiza `<BottomNav />` dentro de `Layout` (después de `<main>`) y agrega `pb-16 md:pb-0` al contenedor de `main` (o al div raíz del Layout) para que la barra no tape el contenido.
3. En `Navbar.tsx`, dentro del menú móvil desplegable, **quita** los enlaces que ahora están en la barra inferior (Calendario, Mis Reservas, Comunidad, Permisos de Uso) para evitar duplicación. Mantén en el hamburguesa: Notificaciones, selector de espacio (SUPER_ADMIN), Espacios, submenú Admin, Perfil y Salir.
4. Notificaciones: mantenla en el hamburguesa con su badge (no la muevas a la barra inferior en esta iteración).

**Verificación:** `npx tsc --noEmit` pasa; en 375px la barra inferior aparece con los 4 accesos y estado activo correcto; en `≥ md` no aparece y el Navbar se ve igual que antes; el contenido no queda tapado por la barra.

---

## Prompt 3 — Vista de agenda/lista en el calendario

**Tarea:** Ofrecer una vista de lista (agenda) en FullCalendar, por defecto en móvil.

Contexto: `client/src/components/calendar/CalendarView.tsx` ya usa `dayGridPlugin`, `timeGridPlugin`, `interactionPlugin` y cambia a `timeGridDay` en móvil (`initialView`, `headerToolbar`).

1. Agrega la dependencia `@fullcalendar/list` en `client/package.json` con la **misma versión** que los demás paquetes de FullCalendar (`^6.1.15`) y ejecuta la instalación.
2. En `CalendarView.tsx`: importa `listPlugin from '@fullcalendar/list'` y añádelo al array `plugins`.
3. Cuando `isMobile` sea true, usa `initialView="listWeek"` y `headerToolbar={{ left: 'prev,next', center: 'title', right: 'listWeek,timeGridDay' }}`. En desktop, mantén la configuración actual pero agrega `listWeek` como opción adicional en el `right` del toolbar.
4. Asegúrate de que los eventos en la vista lista muestren título legible (agrupación/usuaria + recurso) y que el click en un evento siga disparando los handlers existentes (`onTrainingClick`, `onMaintenanceClick`, edición/cancelación de reserva). No dupliques lógica: reutiliza los `eventClick`/render existentes.
5. Revisa el CSS de `client/src/index.css` (bloque FullCalendar) por si la vista lista necesita ajustes menores de tipografía/espaciado en móvil.

**Verificación:** `npx tsc --noEmit` pasa; en móvil el calendario abre en lista legible y permite cambiar a día; en desktop sigue abriendo en semana; los clicks sobre eventos abren los mismos modales de siempre.

---

## Prompt 4 — Modales como bottom-sheet en móvil

**Tarea:** Que los modales principales ocupen todo el ancho y suban desde abajo en móvil (patrón bottom-sheet), manteniendo el diseño centrado en desktop.

Aplica el patrón a **todos los overlays modales** del cliente (búscalos por `fixed inset-0`). Empieza por el wizard, que es el flujo central:
- `client/src/components/booking/BookingWizard.tsx`
- `client/src/components/booking/BookingModal.tsx` (si está en uso)
- `client/src/components/booking/ExceptionalBookingModal.tsx`
- `client/src/components/admin/TrainingModal.tsx`
- `client/src/components/admin/MaintenanceModal.tsx`
- `client/src/components/shared/ConfirmModal.tsx`
- Los modales de detalle inline en `client/src/pages/CalendarPage.tsx` (capacitación y mantención) y el mini-dialog de elección.

Para cada overlay:
1. Contenedor overlay: `items-end sm:items-center` (en vez de solo `items-center`).
2. Panel del modal: `w-full sm:max-w-md` (o el `max-w-*` que ya tuviera), `rounded-t-2xl sm:rounded-2xl`, `max-h-[90dvh] overflow-y-auto`.
3. Añadir safe-area inferior donde haya botones de acción al fondo: `pb-[env(safe-area-inset-bottom)]` o padding equivalente.
4. No cambiar la lógica interna de pasos/formularios; solo el contenedor y clases de presentación.

5. **IMPORTANTE — coordinar con la barra de navegación inferior.** `BottomNav.tsx` es `fixed bottom-0 z-50` y los overlays modales también usan `z-50`, así que un bottom-sheet chocaría con la barra justo en la zona de botones. Resuélvelo así:
   - Sube el z-index de **todos** los overlays modales a `z-[60]` (backdrop incluido) para que el sheet y su fondo oscuro queden **por encima** de la barra inferior y la tapen por completo mientras el modal está abierto.
   - Verifica que el backdrop (`bg-black/50 fixed inset-0`) cubra toda la pantalla incluyendo la zona de la barra, para que no quede un borde de la `BottomNav` asomando bajo el sheet.
   - No hace falta desmontar la `BottomNav`; basta con el z-index correcto y que el backdrop la cubra.

**Verificación:** `npx tsc --noEmit` pasa; en 375px el wizard y los modales suben desde abajo, ocupan el ancho completo y se completan sin scroll horizontal ni zoom; **con un modal abierto, la barra inferior queda tapada por el backdrop y no se solapa con los botones del sheet**; en desktop siguen centrados igual que antes.

---

## Prompt 5 — Botones de acción del calendario + áreas táctiles

**Tarea:** Simplificar la cabecera del calendario en móvil y agrandar controles táctiles.

1. En `client/src/pages/CalendarPage.tsx`, la cabecera tiene hasta 4 botones (Nueva Reserva, Capacitación, Hora Excepcional, Mantención) con `flex-wrap`. En móvil (`< md`): deja visible solo **Nueva Reserva** como botón principal y agrupa **Capacitación / Hora Excepcional / Mantención** en un menú desplegable "Más" (solo para roles con esos permisos). En `≥ md` mantén los botones como están hoy.
2. El input de filtro por agrupación usa `w-64` fijo: cámbialo a `w-full sm:w-64` para que en móvil use todo el ancho.
3. Áreas táctiles en móvil: revisa controles interactivos clave (links del menú móvil del Navbar, ítems de la barra inferior, botones de modales, filtros y selects) y asegura `min-h-[44px]` y padding vertical cómodo (`py-2.5`/`py-3`) sin afectar el diseño desktop.

**Verificación:** `npx tsc --noEmit` pasa; en 375px la cabecera del calendario no se amontona, el filtro ocupa el ancho completo y ningún control interactivo mide menos de ~44px de alto; en desktop la cabecera se ve igual que antes.

---

## Orden y despliegue

Recomendado: aplicar Prompt 1 → 2 → 3 (Fase A, mayor impacto) y desplegar/probar en el teléfono antes de seguir con 4 → 5 (Fase B, refinamientos). Cada uno puede ir en su propio commit y deploy a Render por separado.
