# Prompt para Codex — Permitir borrar espacio con usuarias eliminadas + espacio por defecto en el registro

Pégalo en Codex corriendo en la raíz del repo. Son dos arreglos relacionados. Solo backend + frontend, sin migración.

---

## Problema 1 — No se puede borrar un espacio aunque se "borren" sus usuarias

Al eliminar una usuaria desde la interfaz se hace **soft delete** (`user.controller.ts` setea `deletedAt`, no borra la fila). En `server/src/controllers/space.controller.ts` → `deleteSpace`, la validación cuenta **todas** las usuarias (incluidas las soft-deleted), así que un espacio con usuarias eliminadas queda bloqueado para siempre. Y aunque pasara, la transacción no elimina esas filas de `User`, que siguen referenciando al espacio.

### Solución

En `deleteSpace`:

1. La validación debe contar solo usuarias **activas** (`deletedAt: null`). Si hay activas, se sigue bloqueando con el mensaje actual.
2. La transacción debe además eliminar las usuarias del espacio (incluidas las soft-deleted) y todos sus dependientes, en orden hijos → padres, antes de borrar el espacio.

Implementación (ajusta nombres de modelos/relaciones al `schema.prisma` real):

```ts
export const deleteSpace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const space = await prisma.space.findUnique({
      where: { id },
      include: { users: { where: { deletedAt: null }, select: { id: true } } }, // solo ACTIVAS
    });
    if (!space) {
      res.status(404).json({ error: 'Espacio no encontrado' });
      return;
    }
    if (space.users.length > 0) {
      res.status(400).json({ error: 'No se puede eliminar un espacio con usuarias activas. Elimina o reasigna primero las usuarias.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Usuarias del espacio, incluidas las soft-deleted
      const spaceUsers = await tx.user.findMany({ where: { spaceId: id }, select: { id: true } });
      const userIds = spaceUsers.map((u) => u.id);

      const [resources, trainings, categories] = await Promise.all([
        tx.resource.findMany({ where: { spaceId: id }, select: { id: true } }),
        tx.training.findMany({ where: { spaceId: id }, select: { id: true } }),
        tx.category.findMany({ where: { spaceId: id }, select: { id: true } }),
      ]);
      const resourceIds = resources.map((r) => r.id);
      const trainingIds = trainings.map((t) => t.id);
      const categoryIds = categories.map((c) => c.id);

      // Reservas: por recurso del espacio o por usuaria del espacio
      await tx.booking.deleteMany({ where: { OR: [{ resourceId: { in: resourceIds } }, { userId: { in: userIds } }] } });
      // Capacitaciones y sus dependientes
      await tx.trainingExemption.deleteMany({ where: { OR: [{ trainingId: { in: trainingIds } }, { resourceId: { in: resourceIds } }] } });
      await tx.trainingEnrollment.deleteMany({ where: { OR: [{ trainingId: { in: trainingIds } }, { userId: { in: userIds } }] } });
      await tx.training.deleteMany({ where: { spaceId: id } });
      // Certificaciones (como usuaria, como certificadora o por categoría del espacio)
      await tx.certification.deleteMany({ where: { OR: [{ categoryId: { in: categoryIds } }, { userId: { in: userIds } }, { certifiedById: { in: userIds } }] } });
      // Notificaciones y logs de auditoría de esas usuarias
      await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
      await tx.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      // Comentarios (del espacio o de esas usuarias)
      await tx.comment.deleteMany({ where: { OR: [{ spaceId: id }, { userId: { in: userIds } }] } });
      // Recursos, categorías, mantenciones, horarios del espacio
      await tx.maintenance.deleteMany({ where: { spaceId: id } });
      await tx.resource.deleteMany({ where: { spaceId: id } });
      await tx.category.deleteMany({ where: { spaceId: id } });
      await tx.businessHours.deleteMany({ where: { spaceId: id } });
      // Usuarias del espacio (ya solo soft-deleted, sin dependientes)
      await tx.user.deleteMany({ where: { spaceId: id } });
      // Finalmente el espacio
      await tx.space.delete({ where: { id } });
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'SPACE_DELETED',
      targetType: 'Space',
      targetId: id,
      meta: { name: space.name },
    });

    res.json({ message: 'Espacio eliminado' });
  } catch (error) {
    logger.error({ err: error }, 'Error al eliminar espacio');
    res.status(500).json({ error: 'Error al eliminar espacio' });
  }
};
```

Requisitos:
- Revisa el `schema.prisma` y confirma que no quede ninguna relación hacia `Space`, `User`, `Category`, `Resource` o `Training` sin cubrir en el orden de borrado. Si aparece otra, agrégala respetando hijos → padres.
- Mantén la transacción para que sea todo-o-nada.

---

## Problema 2 — El espacio por defecto al registrarse debe ser Chillán

En `client/src/pages/RegisterPage.tsx`, el selector de espacio arranca vacío. Como queremos que Chillán (que quedará como único espacio activo) sea el valor por defecto:

- En el `useEffect` que carga los espacios activos, cuando la lista ya está filtrada por `isActive`:
  - Si hay **exactamente un** espacio activo, autoselecciónalo (`setSpaceId(ese.id)`) y **oculta** el selector (no tiene sentido elegir si hay uno solo).
  - Si hay **más de uno**, preselecciona el primero de la lista para que nunca quede vacío, y deja el selector visible.
- Mantén la validación de `spaceId` requerido.

Opcional (defensa en backend): en `server/src/controllers/auth.controller.ts` → `register`, si no llega `spaceId` y existe **un solo** espacio activo, usar ese por defecto en vez de rechazar. No cambies el comportamiento cuando hay varios.

---

## Verificación

- `cd server && npx tsc --noEmit` y `cd client && npx tsc --noEmit` pasan.
- Un espacio cuyas usuarias fueron eliminadas (soft delete) ahora **sí** se puede borrar; uno con usuarias activas sigue bloqueado.
- El orden de borrado no viola ninguna foreign key (repásalo mentalmente).
- En la página de registro, con un solo espacio activo, este queda seleccionado solo y el selector no se muestra.
