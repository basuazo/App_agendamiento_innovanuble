import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, resolveSpaceId } from '../middleware/auth.middleware';

const RESOURCE_INCLUDE = {
  category: { select: { id: true, name: true, slug: true, color: true } },
};

export const getResources = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.all === 'true';
    const spaceId = resolveSpaceId(req);
    const spaceFilter = spaceId ? { spaceId } : {};
    const resources = await prisma.resource.findMany({
      where: { ...spaceFilter, ...(includeInactive ? {} : { isActive: true }) },
      include: RESOURCE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recursos' });
  }
};

export const getResourceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
      include: RESOURCE_INCLUDE,
    });
    if (!resource) {
      res.status(404).json({ error: 'Recurso no encontrado' });
      return;
    }
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recurso' });
  }
};

export const createResource = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, categoryId, requiresCertification, imageUrl, capacity } = req.body;
    if (!name || !categoryId) {
      res.status(400).json({ error: 'Nombre y categoría son requeridos' });
      return;
    }
    const spaceId = resolveSpaceId(req);
    if (!spaceId) {
      res.status(400).json({ error: 'Se requiere contexto de espacio' });
      return;
    }
    const resource = await prisma.resource.create({
      data: {
        name, description, categoryId,
        requiresCertification: requiresCertification !== false,
        imageUrl,
        capacity: capacity ? Number(capacity) : 1,
        spaceId,
      },
      include: RESOURCE_INCLUDE,
    });
    res.status(201).json(resource);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear recurso' });
  }
};

export const updateResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, categoryId, requiresCertification, imageUrl, capacity } = req.body;
    const resource = await prisma.resource.update({
      where: { id: req.params.id },
      data: {
        name, description, categoryId, requiresCertification, imageUrl,
        ...(capacity !== undefined && { capacity: Number(capacity) }),
      },
      include: RESOURCE_INCLUDE,
    });
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar recurso' });
  }
};

export const deleteResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) {
      res.status(404).json({ error: 'Recurso no encontrado' });
      return;
    }
    const now = new Date();
    const activeBookingCount = await prisma.booking.count({
      where: { resourceId: id, status: { in: ['PENDING', 'CONFIRMED'] }, endTime: { gt: now } },
    });
    if (activeBookingCount > 0) {
      res.status(409).json({ error: `No se puede eliminar: el recurso tiene ${activeBookingCount} reserva(s) activa(s) próximas. Cancélalas primero o desactívalo en su lugar.` });
      return;
    }
    // Eliminar exenciones y todas las reservas pasadas/canceladas antes de borrar el recurso
    await prisma.trainingExemption.deleteMany({ where: { resourceId: id } });
    await prisma.booking.deleteMany({ where: { resourceId: id } });
    await prisma.resource.delete({ where: { id } });
    res.json({ message: 'Recurso eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar recurso' });
  }
};

export const toggleResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const resource = await prisma.resource.findUnique({ where: { id: req.params.id } });
    if (!resource) {
      res.status(404).json({ error: 'Recurso no encontrado' });
      return;
    }
    const updated = await prisma.resource.update({
      where: { id: req.params.id },
      data: { isActive: !resource.isActive },
      include: RESOURCE_INCLUDE,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado del recurso' });
  }
};
