# Prompt para Codex — Corregir el borrado de espacios (cascada)

Pégalo en Codex corriendo en la raíz del repo. Corrige un bug: al eliminar un espacio, `prisma.space.delete()` falla con un error de foreign key (`Resource_spaceId_fkey`, `BusinessHours`, etc.) porque no se eliminan los registros que dependen del espacio. Solo backend, sin migración.

## Contexto

`server/src/controllers/space.controller.ts` → función `deleteSpace`. Hoy:
1. Bloquea el borrado si el espacio tiene usuarias asignadas (mantener esta validación).
2. Hace `prisma.space.delete({ where: { id } })` directamente → falla porque quedan `resources`, `categories`, `businessHours`, `trainings`, `maintenances`, `comments`, etc. referenciando el espacio.

## Tarea

Reescribe `deleteSpace` para que, **manteniendo la validación de usuarias**, elimine todos los dependientes del espacio dentro de una **transacción** (`prisma.$transaction`) en el orden correcto (hijos antes que padres), y recién al final borre el espacio. Mantén el `logAudit` de `SPACE_DELETED`.

Como la validación garantiza que el espacio no tiene usuarias, no hay reservas/comentarios/certificaciones creados por usuarias de ese espacio; aun así, limpia también las reservas que apunten a recursos del espacio, por seguridad.

Implementación sugerida (ajusta nombres de modelos según el schema real en `prisma/schema.prisma`):

```ts
export const deleteSpace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const space = await prisma.space.findUnique({
      where: { id },
      include: { users: { select: { id: true } } },
    });
    if (!space) {
      res.status(404).json({ error: 'Espacio no encontrado' });
      return;
    }
    if (space.users.length > 0) {
      res.status(400).json({ error: 'No se puede eliminar un espacio con usuarias asignadas. Elimina o reasigna primero las usuarias.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const resources = await tx.resource.findMany({ where: { spaceId: id }, select: { id: true } });
      const trainings = await tx.training.findMany({ where: { spaceId: id }, select: { id: true } });
      const categories = await tx.category.findMany({ where: { spaceId: id }, select: { id: true } });
      const resourceIds = resources.map((r) => r.id);
      const trainingIds = trainings.map((t) => t.id);
      const categoryIds = categories.map((c) => c.id);

      await tx.booking.deleteMany({ where: { resourceId: { in: resourceIds } } });
      await tx.trainingExemption.deleteMany({
        where: { OR: [{ trainingId: { in: trainingIds } }, { resourceId: { in: resourceIds } }] },
      });
      await tx.trainingEnrollment.deleteMany({ where: { trainingId: { in: trainingIds } } });
      await tx.training.deleteMany({ where: { spaceId: id } });
      await tx.certification.deleteMany({ where: { categoryId: { in: categoryIds } } });
      await tx.resource.deleteMany({ where: { spaceId: id } });
      await tx.category.deleteMany({ where: { spaceId: id } });
      await tx.maintenance.deleteMany({ where: { spaceId: id } });
      await tx.comment.deleteMany({ where: { spaceId: id } });
      await tx.businessHours.deleteMany({ where: { spaceId: id } });
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
    // loguear el error real para diagnóstico
    res.status(500).json({ error: 'Error al eliminar espacio' });
  }
};
```

Requisitos:
- Revisa el `schema.prisma` y confirma que la lista de dependientes esté completa; si existe alguna otra relación que apunte a `Space`, `Category`, `Resource` o `Training` y que no esté cubierta, agrégala al orden de borrado.
- Usa una transacción para que, si algo falla, no quede el espacio a medio borrar.
- Cambia el `catch` para registrar el error real (con el `logger`) en vez de tragárselo, así se puede diagnosticar si algo queda fuera.

## Verificación

- `cd server && npx tsc --noEmit` pasa.
- Repasa mentalmente el orden: no se borra un padre antes que sus hijos.
- Confirma que la validación de "espacio con usuarias" sigue funcionando (no se debe poder borrar un espacio que aún tiene usuarias).
