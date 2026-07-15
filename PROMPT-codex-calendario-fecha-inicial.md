# Prompt para Codex — Fecha inicial inteligente del calendario (CoWork)

Pégalo en Codex corriendo en la raíz del repo. Trabaja solo en `/client`. No toques backend ni lógica de negocio. No alteres la experiencia desktop más allá de lo indicado.

---

## Objetivo

Cambiar la **fecha en la que abre el calendario** (`initialDate` de FullCalendar) según la hora y el día, para que las usuarias vean la agenda relevante sin navegar:

1. **Después de las 18:00 de cada día**, la vista de agenda móvil debe abrir mostrando **el día siguiente** (no el día que ya terminó).
2. **En la vista semanal** (desktop), a partir del **viernes 20:00** y durante el fin de semana, debe abrir mostrando **la semana siguiente**, **salvo que haya algún evento agendado en sábado o domingo** de este fin de semana (en ese caso, se queda en la semana actual).
3. En la **lista móvil** aplican **ambas reglas combinadas**: tras las 18:00 salta al día siguiente, y desde el viernes 20:00 salta a la próxima semana si no hay eventos de fin de semana.

"Evento de fin de semana" = **cualquier** reserva, capacitación o mantención cuyo inicio caiga en sábado o domingo.

---

## Contexto de código

- `client/src/components/calendar/CalendarView.tsx` renderiza `<FullCalendar>`. Ya recibe por props `bookings`, `trainings`, `maintenances`, y usa `useIsMobile()`.
- Hoy la vista se deriva así (aprox. líneas 328 y 409-416):
  ```ts
  const calendarView = isMobile ? 'listWeek' : 'timeGridWeek';
  ...
  <FullCalendar
    key={calendarView}
    plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
    initialView={calendarView}
    headerToolbar={isMobile
      ? { left: 'prev,next', center: 'title', right: 'listWeek,timeGridDay' }
      : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
    ...
  />
  ```
- El componente ya se remonta al cambiar `calendarView` (por el `key`), así que `initialDate` se recalcula al montar. Los datos de eventos ya están cargados cuando `CalendarView` se monta (la página lo monta solo cuando `calendarReady`).

---

## Implementación

### 1. Lista móvil como agenda rodante de 7 días

Para que la regla "mostrar el día siguiente" funcione, la lista móvil debe **empezar en la fecha inicial** y no en el lunes de la semana calendario. `listWeek` siempre muestra la semana completa que contiene la fecha, así que **reemplázala por una vista de lista rodante** de 7 días:

```ts
views={{
  listRolling: { type: 'list', duration: { days: 7 }, buttonText: 'Agenda' },
}}
```

- En móvil: `calendarView = 'listRolling'`, y en el `headerToolbar` móvil usa `right: 'listRolling,timeGridDay'`.
- En desktop: mantén `timeGridWeek` como default (sin cambios de vista); puedes dejar `listWeek` en el toolbar desktop como está.

### 2. Helper para calcular la fecha inicial

Agrega una función pura (en el mismo archivo o en `client/src/utils/dateHelpers.ts`, donde encaje mejor) y cúbrela con un `useMemo` en `CalendarView`:

```ts
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }

/**
 * Calcula la fecha en que debe abrir el calendario.
 * @param now      fecha/hora actual
 * @param isMobile true = lista móvil (reglas combinadas); false = semana desktop (solo regla 2)
 * @param events   inicios de todos los eventos (reservas + capacitaciones + mantenciones)
 */
function computeInitialDate(now: Date, isMobile: boolean, events: Date[]): Date {
  const day = now.getDay();   // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sáb
  const hour = now.getHours();

  // Ventana de fin de semana: viernes >= 20:00, sábado o domingo
  const inWeekendWindow = (day === 5 && hour >= 20) || day === 6 || day === 0;

  // ¿Hay eventos este sábado o domingo?
  let weekendHasEvents = false;
  if (inWeekendWindow) {
    const satOffset = day === 5 ? 1 : day === 6 ? 0 : -1; // Vie→+1, Sáb→0, Dom→-1
    const sat = addDays(now, satOffset);
    const sun = addDays(sat, 1);
    weekendHasEvents = events.some((e) => sameDay(e, sat) || sameDay(e, sun));
  }

  // Regla 2: saltar al lunes de la próxima semana
  if (inWeekendWindow && !weekendHasEvents) {
    const daysUntilNextMonday = ((8 - day) % 7) || 7;
    return startOfDay(addDays(now, daysUntilNextMonday));
  }

  // Regla 1 (solo lista móvil): después de las 18:00, día siguiente
  if (isMobile && hour >= 18) {
    return startOfDay(addDays(now, 1));
  }

  return startOfDay(now);
}
```

### 3. Usar el helper en CalendarView

```ts
const initialDate = useMemo(() => {
  const events: Date[] = [
    ...bookings.map((b) => new Date(b.startTime)),
    ...trainings.map((t) => new Date(t.startTime)),
    ...maintenances.map((m) => new Date(m.startTime)),
  ];
  return computeInitialDate(new Date(), isMobile, events);
}, [bookings, trainings, maintenances, isMobile]);
```

Pásalo al calendario:

```tsx
<FullCalendar
  key={calendarView}
  initialDate={initialDate}
  ...
/>
```

---

## Precisiones de comportamiento (para que quede exacto)

- **Desktop, semana:** martes 19:00 → semana actual (la regla 1 NO aplica a la vista semana). Viernes 21:00 sin eventos de finde → semana siguiente. Viernes 21:00 con una reserva el sábado → semana actual.
- **Móvil, lista:** martes 19:00 → la agenda empieza mañana (miércoles). Viernes 21:00 sin eventos de finde → empieza el lunes próximo. Viernes 21:00 con evento el sábado → empieza mañana (sábado), para que se vea ese evento.
- El salto usa la hora **local del navegador** (es lo que ve la usuaria).
- `initialDate` solo afecta el montaje. Como el calendario se remonta por el `key`, basta con esto; no hace falta un timer que lo actualice si la pestaña queda abierta (fuera de alcance).

---

## Verificación

- `cd client && npx tsc --noEmit` pasa sin errores.
- Prueba manual cambiando la hora del sistema o inyectando un `now` fijo temporal:
  - Después de 18:00 en móvil, la agenda abre en el día siguiente.
  - Viernes ≥20:00 sin eventos de finde: desktop abre en la semana siguiente; móvil en el lunes próximo.
  - Viernes ≥20:00 con un evento el sábado: ambos se quedan en la semana/fin de semana actual.
  - Entre semana y antes de las 18:00: comportamiento normal (hoy / semana actual).
- Los clicks sobre eventos siguen abriendo los modales de siempre (no se tocó `eventClick`).
- Desktop conserva su vista semanal por defecto; solo cambia la fecha inicial en la ventana de fin de semana.

## Nota sobre el cambio de vista móvil

Este prompt reemplaza la lista `listWeek` (semana calendario) por una **lista rodante de 7 días** en móvil, porque es la única forma de que "empezar desde mañana" funcione de verdad. Es un cambio de comportamiento intencional y más intuitivo para la agenda. Si se prefiere conservar `listWeek`, la regla 1 en móvil no podría cumplirse tal cual (la lista seguiría mostrando la semana completa).
