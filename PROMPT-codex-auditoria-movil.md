# Prompt para Codex — Auditoría de la Fase B móvil + fecha inicial (CoWork)

Pégalo en Codex corriendo en la raíz del repo. Trabaja solo en `/client`. Es una **auditoría**: revisa, reporta hallazgos y **corrige** los problemas que encuentres, sin cambiar lógica de negocio ni la experiencia desktop. Al terminar corre `cd client && npx tsc --noEmit` y entrega un resumen de hallazgos + archivos modificados.

## Contexto

Se implementaron mejoras móviles (bottom nav, vista lista, bottom-sheets, header de acciones, áreas táctiles) y una lógica de fecha inicial del calendario. Audita que todo quede consistente en móvil (≤767px) sin romper desktop (≥768px).

## 1. Problema conocido a corregir (prioritario)

En `client/src/index.css` hay una regla global de área táctil:
```css
@media (max-width: 767px) { button, input, select { min-height: 44px } }
```
Esta regla **deforma checkboxes y radios** (p. ej. los radios del paso "¿para quién?" y el checkbox de selección de máquina en `BookingWizard.tsx`, que queda 16px de ancho × 44px de alto). Corrígela para excluir esos tipos:
```css
@media (max-width: 767px) {
  button,
  input:not([type="checkbox"]):not([type="radio"]),
  select { min-height: 44px; }
}
```
Verifica también que la regla `min-height: 44px` sobre `button` no deforme botones-ícono pequeños (la "X" de cerrar modales, el limpiar-filtro, la campana). Si genera espacios raros, acota la regla para no afectar botones que solo contienen un ícono (por ejemplo con una clase utilitaria en esos botones, sin cambiar su comportamiento).

## 2. Overlays / bottom-sheets vs barra inferior

- Confirma que **todos** los overlays modales usen `z-[60]` (no `z-50`) y un backdrop `fixed inset-0` que cubra toda la pantalla, para que tapen la `BottomNav` (`z-50`) al abrirse. Busca por `fixed inset-0` en `client/src` y revisa cada uno.
- Verifica el patrón bottom-sheet en móvil: `items-end sm:items-center`, panel `w-full sm:max-w-*`, `rounded-t-2xl sm:rounded-2xl`, `max-h-[90dvh]` con scroll interno, y padding inferior con `env(safe-area-inset-bottom)` donde haya botones al fondo.
- Prueba mental de modales anidados (p. ej. en el wizard: confirmar cancelar, "¿qué vas a producir?"): que el z-index y el backdrop sigan correctos.
- Desktop: los modales deben seguir **centrados** (`sm:items-center`, `sm:rounded-2xl`, `sm:max-w-*`, `sm:px-4`).

## 3. Fecha inicial del calendario

En `client/src/components/calendar/CalendarView.tsx`, revisa `computeInitialDate` y su `useMemo`:
- Ventana de fin de semana: viernes ≥20:00, sábado o domingo.
- "Evento de finde" = cualquier reserva/capacitación/mantención en sábado o domingo → se mantiene la semana/día actual.
- Regla de las 18:00 (día siguiente) solo en móvil (lista rodante).
- Confirma que `initialDate` se pasa a `<FullCalendar>` y que el `key={calendarView}` no cause pérdidas de estado indebidas.
- Revisa zonas horarias: se usa hora local del navegador de forma consistente (sin mezclar UTC).
- Edge cases: viernes 19:59 vs 20:00; domingo por la noche; semana con un solo evento el domingo.

## 4. Header de acciones (móvil)

En `client/src/pages/CalendarPage.tsx`:
- En móvil se ve solo "Nueva Reserva" + menú "Más"; en desktop, los 4 botones como antes.
- El menú "Más" solo muestra opciones según permisos del rol (no exponer acciones no permitidas).
- El menú se cierra al elegir opción y al hacer click fuera (revisa listener de click-outside y limpieza en unmount).

## 5. Barra de navegación inferior

En `client/src/components/shared/BottomNav.tsx` y `App.tsx`:
- Solo visible en `< md`; `main` con `pb-16 md:pb-0` para no tapar contenido.
- Estado activo correcto por ruta; safe-area inferior aplicada.
- No aparece en Login/Registro (esas rutas no usan el Layout — confírmalo).
- No hay enlaces duplicados con el menú hamburguesa del `Navbar`.

## 6. Regresión general

- `eventClick` del calendario sin cambios: los modales/handlers de reserva, capacitación y mantención siguen abriéndose igual en lista y en semana.
- Accesibilidad básica: los botones-ícono sin texto tienen `aria-label`.
- Nada de `console.log` de depuración dejado en el código.

## Entregable

Un reporte con: (a) lista de hallazgos por sección con severidad, (b) archivos corregidos y qué se cambió, (c) confirmación de `npx tsc --noEmit` en verde. No incluyas cambios de fin de línea masivos: toca solo las líneas necesarias.
