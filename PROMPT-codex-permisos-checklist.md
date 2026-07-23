# Prompt para Codex — Permisos de uso como checklist (toggle rápido)

Pégalo en Codex corriendo en la raíz del repo. Es un cambio **solo de frontend**, en `client/src/pages/admin/CertificationsPage.tsx`. No se toca backend ni base de datos: se reutilizan los endpoints existentes.

## Objetivo

Hoy, para otorgar un permiso hay que expandir la fila, escribir una nota y confirmar; y para revocar sale un modal de confirmación. Es lento cuando hay que gestionar varias categorías. Queremos convertir la tabla en un **checklist**: cada categoría tiene un interruptor/checkbox; al marcarlo se otorga el permiso al instante y al desmarcarlo se revoca al instante, sin notas ni modales.

## Servicios disponibles (no cambian)

`client/src/services/certification.service.ts`:
- `certificationService.certifyUser(userId, categoryId)` → otorga (la nota es opcional; **no la usaremos**).
- `certificationService.revokeCertification(certId)` → revoca.
- `certificationService.getAllCertifications(userId)` → lista los permisos de la usuaria.

## Cambios en `CertificationsPage.tsx`

Mantén: el buscador de usuaria (`UserCombobox`), la tarjeta de usuaria seleccionada, y la carga de `categories` + `userCerts`.

Reemplaza la tabla actual (con "Otorgar permiso", notas, confirmar y el modal de revocar) por un **checklist**:

1. **Una fila por categoría**, cada una con:
   - Un interruptor tipo toggle o un checkbox grande (área táctil mínima 44px, pensado para móvil).
   - El color y el nombre de la categoría.
   - Estado marcado = la usuaria tiene el permiso; desmarcado = no lo tiene.
   - Como texto secundario pequeño (opcional, si hay permiso): la fecha y quién lo otorgó.

2. **Toggle instantáneo con UI optimista**:
   - Al **marcar**: actualiza el estado visual de inmediato, llama a `certifyUser(selectedUserId, cat.id)`, y muestra un toast breve ("Permiso otorgado"). Si la llamada falla, revierte el checkbox y muestra un toast de error.
   - Al **desmarcar**: busca el `cert` correspondiente por `categoryId`, actualiza el estado visual de inmediato, llama a `revokeCertification(cert.id)`, toast ("Permiso quitado"). Si falla, revierte.
   - Mientras una fila tiene una llamada en curso, deshabilita solo ese toggle (evita dobles clics), pero permite operar otras filas.
   - **Sin** campo de notas y **sin** modal de confirmación (ni para otorgar ni para revocar). Prioriza la agilidad.
   - Tras cada operación exitosa, actualiza `userCerts` en memoria (agrega/quita el cert) sin necesidad de recargar toda la lista; si es más simple, puedes llamar a `loadUserCerts` al final, pero no bloquees la UI esperando.

3. **Acciones masivas** arriba del checklist:
   - Botón **"Otorgar todas"**: otorga las categorías que aún no tiene (en paralelo con `Promise.all`), con feedback y manejo de errores.
   - Botón **"Quitar todas"**: revoca todas las que tiene.
   - Deshabilítalos mientras corre una operación masiva y muestra un estado de "Guardando…".

4. Elimina el estado y el código que ya no se usan: `certifyingCatId`, `certNotes`, `revokeTarget`, el `ConfirmModal` de revocación y la fila expandida de notas.

5. Mantén los estados de carga (`isLoading`, `certsLoading`) y el estado vacío ("Selecciona una usuaria…").

## Detalles de UX

- El checklist debe verse bien en móvil: usa toggles o checkboxes con buen tamaño y las filas apiladas, no una tabla con scroll horizontal.
- Un toast por acción está bien; para "Otorgar/Quitar todas", un solo toast al terminar.
- No cambies los permisos de acceso a la página (sigue siendo para ADMIN, SUPER_ADMIN y LIDER_COMUNITARIA).

## Verificación

- `cd client && npx tsc --noEmit` pasa.
- Marcar un toggle otorga el permiso sin pasos intermedios; desmarcarlo lo revoca sin modal.
- Si el backend falla, el toggle vuelve a su estado anterior (probar mentalmente el revert).
- "Otorgar todas" y "Quitar todas" funcionan y dejan el checklist consistente con lo que hay en la base.
- No quedó código muerto del flujo anterior (notas, modal de revocar).

## Nota (opcional, si quieres optimizar)

Si el rendimiento de "Otorgar/Quitar todas" con muchas categorías te preocupa, se puede agregar más adelante un endpoint de backend que reciba la lista completa de permisos de una usuaria y la sincronice de una sola vez. No es necesario para esta tarea; con las llamadas en paralelo basta.
