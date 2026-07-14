# Plan de mejoras de visualización móvil — CoWork (App de Agendamiento Innova Ñuble)

**Objetivo:** hacer la navegación en teléfono más intuitiva y la lectura de pantalla más clara, sin rehacer la app. La base responsive ya existe; este plan corrige puntos concretos que hoy dificultan el uso con una mano.

---

## 1. Diagnóstico del estado actual

Lo que **ya funciona** en móvil:

- Menú hamburguesa con desplegable (`Navbar.tsx`, `md:hidden`), incluyendo submenú Admin y selector de espacio.
- El calendario cambia automáticamente a vista de día (`timeGridDay`) bajo 768px (`CalendarView.tsx:381`).
- Tablas admin con scroll horizontal y columnas que se ocultan (`md:table-cell`, `lg:table-cell`).
- Modales con `max-h` y scroll interno.

Lo que **entorpece** el uso en teléfono:

| # | Problema | Dónde | Impacto |
|---|----------|-------|---------|
| 1 | Toda la navegación principal está escondida tras el hamburguesa (arriba-derecha), incómodo con el pulgar | `Navbar.tsx` | Alto |
| 2 | El calendario en móvil usa grilla de horas (`timeGridDay`), apretada y difícil de leer | `CalendarView.tsx:381` | Alto |
| 3 | `isMobile` se calcula una sola vez con `window.innerWidth`; no reacciona a rotación ni resize | `CalendarView.tsx:299` | Medio |
| 4 | Wizard de reserva y modales de detalle son ventanas centradas `max-w-md`, no aprovechan la pantalla chica | `BookingWizard.tsx`, `CalendarPage.tsx` | Medio |
| 5 | Hasta 4 botones de acción se amontonan con `flex-wrap` en la cabecera del calendario | `CalendarPage.tsx` | Medio |
| 6 | Controles con `py-1.5 text-sm` quedan bajo el mínimo táctil (~44px) | filtros, selects, links | Bajo |

---

## 2. Plan priorizado

### Fase A — Alto impacto, esfuerzo acotado

**A1. Barra de navegación inferior (bottom tab bar) en móvil**

Crear un componente `BottomNav.tsx` visible solo en `< md`, fijo abajo (`fixed bottom-0`), con los accesos que más se usan: **Calendario · Mis Reservas · Comunidad · Permisos**. Cada ítem con ícono + etiqueta corta y estado activo por ruta (reutilizar la lógica `isActive` del `Navbar`).

- El hamburguesa se conserva pero se reduce a lo secundario: Admin, Notificaciones, Perfil, Salir, selector de espacio.
- Agregar `padding-bottom` al `<main>` (o al `Layout`) para que la barra no tape el contenido (`pb-16 md:pb-0`).
- Notificaciones puede ir como ícono con badge en la barra inferior o quedarse en el hamburguesa (decisión de diseño — recomendado: en la barra, por el badge de no leídas).

```
┌───────────────────────────────┐
│  (contenido de la página)     │
│                               │
│                               │
├───────────────────────────────┤
│  📅        📋        💬       ✔️  │
│ Calend.  Reservas  Comun.  Permisos │
└───────────────────────────────┘
      barra fija inferior (solo móvil)
```

**A2. Vista de agenda/lista en el calendario**

Agregar el plugin `@fullcalendar/list` (ya es parte del ecosistema FullCalendar, misma versión 6.1.x) y ofrecer `listWeek` como **vista por defecto en móvil**, con toggle a día/semana.

- Reemplaza la grilla apretada por una lista cronológica legible ("Hoy 10:00 – Agrupación X – Máquina Y").
- Mantener `timeGridDay`/`timeGridWeek` como opciones en el `headerToolbar` móvil.
- Ajustar `headerToolbar` móvil a: `left: 'prev,next'`, `center: 'title'`, `right: 'listWeek,timeGridDay'`.

```
Vista lista (móvil):
┌───────────────────────────────┐
│  <  Semana 14–19 Jul  >       │
├───────────────────────────────┤
│ LUN 14                        │
│  09:00  Agrup. Las Rosas · Recta│
│  11:00  Reunión · Sala        │
│ MAR 15                        │
│  10:00  Capacitación: Overlock │
└───────────────────────────────┘
```

**A3. Detección de móvil reactiva**

Crear hook `useIsMobile()` basado en `window.matchMedia('(max-width: 767px)')` con listener, y reemplazar el cálculo puntual de `CalendarView.tsx:299`. Deja la app consistente ante rotación/resize y queda reutilizable para BottomNav y modales.

### Fase B — Refinamientos

**B1. Modales como bottom-sheet en móvil.** Wizard de reserva y modales de detalle: en `< md` que ocupen todo el ancho, anclados abajo, con esquinas superiores redondeadas y scroll interno (`items-end sm:items-center`, `w-full sm:max-w-md`, `rounded-t-2xl sm:rounded-2xl`, `max-h-[90dvh]`). Prioridad: el `BookingWizard` primero por ser el flujo central.

**B2. Botones de acción del calendario.** En móvil dejar visible solo **Nueva Reserva**; agrupar Capacitación / Hora Excepcional / Mantención en un menú "Más" (o un FAB "+"). En desktop se mantienen como están.

**B3. Áreas táctiles.** Subir a `min-h-[44px]` y `py-2.5`/`py-3` los controles interactivos clave en móvil (links del menú, filtros, selects, botones de modal). Revisar el filtro de agrupación (`w-64` fijo → `w-full` en móvil).

---

## 3. Criterios de aceptación

- En un viewport de 375px:
  - La navegación principal es alcanzable con el pulgar sin abrir menús.
  - El calendario abre en vista lista legible, con opción de cambiar a día.
  - El wizard de reserva se puede completar sin zoom ni scroll horizontal.
  - Ningún control interactivo mide menos de ~44px de alto.
  - Rotar el teléfono ajusta la vista sin recargar.
- En `≥ md` (desktop/tablet) la interfaz **no cambia**: la barra inferior no aparece y el calendario mantiene la vista semanal.
- `npx tsc --noEmit` pasa en `/client`.

---

## 4. Alcance y orden sugerido

1. `useIsMobile()` (A3) — base para el resto.
2. `BottomNav.tsx` + ajuste de `Layout`/`Navbar` (A1).
3. Vista lista en `CalendarView` (A2).
4. Bottom-sheet del `BookingWizard` (B1).
5. Botones de acción + áreas táctiles (B2, B3).

Cada paso es independiente y desplegable por separado, sin tocar backend ni lógica de negocio. Sin dependencias nuevas salvo `@fullcalendar/list`.

---

## 5. Riesgos / notas

- **FullCalendar list plugin**: verificar que la versión coincida con las demás (`^6.1.15`) para evitar conflictos de peer deps.
- **Barra inferior + teclado móvil**: al abrir el teclado en formularios, la barra fija puede estorbar; ocultarla cuando haya un modal/sheet abierto.
- **Safe area (iPhone)**: usar `env(safe-area-inset-bottom)` en la barra inferior para no quedar tapada por la barra de gestos.
- Mantener todo detrás de breakpoints `md:` para no alterar la experiencia desktop actual.
