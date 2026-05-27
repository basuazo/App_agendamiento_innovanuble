import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, resolveSpaceId } from '../middleware/auth.middleware';

// Slugify básico: convierte un nombre en slug tipo RECTA_CASERA
function toSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quita tildes
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export const getCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);
    const includeInactive = req.query.all === 'true';
    const categories = await prisma.category.findMany({
      where: {
        ...(spaceId ? { spaceId } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, color, order } = req.body;
    if (!name) {
      res.status(400).json({ error: 'El nombre es requerido' });
      return;
    }
    const spaceId = resolveSpaceId(req);
    if (!spaceId) {
      res.status(400).json({ error: 'Se requiere contexto de espacio' });
      return;
    }

    const slug = toSlug(name);

    // Verificar slug único por espacio
    const existing = await prisma.category.findUnique({
      where: { spaceId_slug: { spaceId, slug } },
    });
    if (existing) {
      res.status(409).json({ error: 'Ya existe una categoría con ese nombre en este espacio' });
      return;
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        color: color ?? '#6b7280',
        order: order !== undefined ? Number(order) : 0,
        spaceId,
      },
    });
    res.status(201).json(category);
  } catch {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, color, order, isActive } = req.body;
    const spaceId = resolveSpaceId(req);

    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Categoría no encontrada' });
      return;
    }
    if (spaceId && existing.spaceId !== spaceId) {
      res.status(403).json({ error: 'No tienes permiso para editar esta categoría' });
      return;
    }

    // Si cambia el nombre, actualizar el slug solo si no entra en conflicto
    let slug = existing.slug;
    if (name && name !== existing.name) {
      const newSlug = toSlug(name);
      const conflict = await prisma.category.findUnique({
        where: { spaceId_slug: { spaceId: existing.spaceId, slug: newSlug } },
      });
      if (conflict && conflict.id !== existing.id) {
        res.status(409).json({ error: 'Ya existe una categoría con ese nombre en este espacio' });
        return;
      }
      slug = newSlug;
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name, slug }),
        ...(color !== undefined && { color }),
        ...(order !== undefined && { order: Number(order) }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(category);
  } catch {
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { resources: true },
    });
    if (!category) {
      res.status(404).json({ error: 'Categoría no encontrada' });
      return;
    }

    const resourceIds = category.resources.map((r) => r.id);

    // Bloquear solo si hay reservas activas con fecha futura
    if (resourceIds.length > 0) {
      const now = new Date();
      const activeCount = await prisma.booking.count({
        where: { resourceId: { in: resourceIds }, status: { in: ['PENDING', 'CONFIRMED'] }, endTime: { gt: now } },
      });
      if (activeCount > 0) {
        res.status(409).json({
          error: `No se puede eliminar: hay ${activeCount} reserva(s) activa(s) próximas en esta categoría. Cancélalas primero.`,
        });
        return;
      }
    }

    // Eliminar en cascada dentro de una transacción
    await prisma.$transaction(async (tx) => {
      if (resourceIds.length > 0) {
        // Eliminar exenciones de capacitaciones
        await tx.trainingExemption.deleteMany({ where: { resourceId: { in: resourceIds } } });
        // Eliminar todas las reservas de esos recursos (pasadas, canceladas, rechazadas)
        await tx.booking.deleteMany({ where: { resourceId: { in: resourceIds } } });
        // Eliminar recursos
        await tx.resource.deleteMany({ where: { id: { in: resourceIds } } });
      }

      // Eliminar certificaciones de esta categoría
      await tx.certification.deleteMany({ where: { categoryId: req.params.id } });

      // Eliminar la categoría
      await tx.category.delete({ where: { id: req.params.id } });
    });

    res.json({ message: 'Categoría eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
};

export const reorderCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Body: [{ id, order }, ...]
    const items = req.body as { id: string; order: number }[];
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Se espera un array de { id, order }' });
      return;
    }
    await prisma.$transaction(
      items.map((item) =>
        prisma.category.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );
    res.json({ message: 'Orden actualizado' });
  } catch {
    res.status(500).json({ error: 'Error al reordenar categorías' });
  }
};
