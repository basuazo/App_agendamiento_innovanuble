import { Response } from 'express';
import { AuthRequest, resolveSpaceId } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

const MAINTENANCE_INCLUDE = {
  creator: { select: { id: true, name: true } },
};

export const getMaintenances = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);
    const maintenances = await prisma.maintenance.findMany({
      where: spaceId ? { spaceId } : {},
      include: MAINTENANCE_INCLUDE,
      orderBy: { startTime: 'asc' },
    });
    res.json(maintenances);
  } catch (error) {
    logger.error({ err: error }, 'Error al obtener mantenciones');
    res.status(500).json({ error: 'Error al obtener mantenciones' });
  }
};

export const createMaintenance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, startTime: startRaw, endTime: endRaw } = req.body;

    if (!title || !startRaw || !endRaw) {
      res.status(400).json({ error: 'Título, fecha de inicio y fecha de fin son requeridos' });
      return;
    }

    const startTime = new Date(startRaw);
    const endTime = new Date(endRaw);

    if (startTime >= endTime) {
      res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });
      return;
    }

    const spaceId = resolveSpaceId(req);
    if (!spaceId) {
      res.status(400).json({ error: 'Se requiere contexto de espacio' });
      return;
    }

    const maintenance = await prisma.maintenance.create({
      data: {
        title,
        description: description?.trim() || null,
        startTime,
        endTime,
        spaceId,
        createdBy: req.user!.id,
      },
      include: MAINTENANCE_INCLUDE,
    });

    res.status(201).json(maintenance);
  } catch (error) {
    logger.error({ err: error }, 'Error al crear mantención');
    res.status(500).json({ error: 'Error al crear mantención' });
  }
};

export const updateMaintenance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, startTime: startRaw, endTime: endRaw } = req.body;

    const existing = await prisma.maintenance.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Mantención no encontrada' });
      return;
    }

    const startTime = startRaw ? new Date(startRaw) : existing.startTime;
    const endTime = endRaw ? new Date(endRaw) : existing.endTime;

    if (startTime >= endTime) {
      res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });
      return;
    }

    const maintenance = await prisma.maintenance.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description: description?.trim() || null }),
        startTime,
        endTime,
      },
      include: MAINTENANCE_INCLUDE,
    });

    res.json(maintenance);
  } catch (error) {
    logger.error({ err: error }, 'Error al actualizar mantención');
    res.status(500).json({ error: 'Error al actualizar mantención' });
  }
};

export const deleteMaintenance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.maintenance.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Mantención no encontrada' });
      return;
    }

    await prisma.maintenance.delete({ where: { id } });
    res.json({ message: 'Mantención eliminada' });
  } catch (error) {
    logger.error({ err: error }, 'Error al eliminar mantención');
    res.status(500).json({ error: 'Error al eliminar mantención' });
  }
};
