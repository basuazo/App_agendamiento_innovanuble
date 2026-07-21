import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';
import logger from '../lib/logger';

export const getSpaces = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaces = await prisma.space.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(spaces);
  } catch {
    res.status(500).json({ error: 'Error al obtener espacios' });
  }
};

export const createSpace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'El nombre del espacio es requerido' });
      return;
    }

    const space = await prisma.space.create({
      data: { name: name.trim() },
    });

    // Crear BusinessHours por defecto para el nuevo espacio
    const defaultDays = [0, 1, 2, 3, 4, 5, 6];
    await prisma.businessHours.createMany({
      data: defaultDays.map((day) => ({
        spaceId: space.id,
        dayOfWeek: day,
        isOpen: day !== 0, // Domingo cerrado
        openTime: '09:00',
        closeTime: '17:00',
      })),
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'SPACE_CREATED',
      targetType: 'Space',
      targetId: space.id,
      meta: { name: space.name },
    });

    res.status(201).json(space);
  } catch {
    res.status(500).json({ error: 'Error al crear espacio' });
  }
};

export const updateSpace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, isActive } = req.body;
    const { id } = req.params;

    const existing = await prisma.space.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Espacio no encontrado' });
      return;
    }

    const space = await prisma.space.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'SPACE_UPDATED',
      targetType: 'Space',
      targetId: id,
      meta: { name: space.name, isActive: space.isActive },
    });

    res.json(space);
  } catch {
    res.status(500).json({ error: 'Error al actualizar espacio' });
  }
};

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
      const [resources, trainings, categories] = await Promise.all([
        tx.resource.findMany({ where: { spaceId: id }, select: { id: true } }),
        tx.training.findMany({ where: { spaceId: id }, select: { id: true } }),
        tx.category.findMany({ where: { spaceId: id }, select: { id: true } }),
      ]);
      const resourceIds = resources.map((resource) => resource.id);
      const trainingIds = trainings.map((training) => training.id);
      const categoryIds = categories.map((category) => category.id);

      await tx.booking.deleteMany({ where: { resourceId: { in: resourceIds } } });
      await tx.trainingExemption.deleteMany({
        where: {
          OR: [
            { trainingId: { in: trainingIds } },
            { resourceId: { in: resourceIds } },
          ],
        },
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
    logger.error({ err: error }, 'Error al eliminar espacio');
    res.status(500).json({ error: 'Error al eliminar espacio' });
  }
};
