import { Response } from 'express';
import * as xlsx from 'xlsx';
import { AuthRequest, resolveSpaceId } from '../middleware/auth.middleware';
import { ELEVATED_ROLES } from '../middleware/role.middleware';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { notifySpaceUsers } from '../lib/notifications';

const ENROLLMENT_INCLUDE = {
  user: { select: { id: true, name: true, email: true, organization: true } },
};

const TRAINING_INCLUDE = {
  exemptions: {
    include: {
      resource: { select: { id: true, name: true } },
    },
  },
  enrollments: {
    include: ENROLLMENT_INCLUDE,
    orderBy: { createdAt: 'asc' as const },
  },
};

export const getTrainings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);
    const trainings = await prisma.training.findMany({
      where: spaceId ? { spaceId } : {},
      include: TRAINING_INCLUDE,
      orderBy: { startTime: 'asc' },
    });
    res.json(trainings);
  } catch {
    res.status(500).json({ error: 'Error al obtener capacitaciones' });
  }
};

export const createTraining = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, startTime: startRaw, endTime: endRaw, capacity: capacityRaw, exemptResourceIds } = req.body;

    if (!title || !startRaw || !endRaw) {
      res.status(400).json({ error: 'Título, hora de inicio y hora de fin son requeridos' });
      return;
    }

    const startTime = new Date(startRaw);
    const endTime = new Date(endRaw);

    if (startTime >= endTime) {
      res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });
      return;
    }

    const capacity = Math.max(1, Number(capacityRaw) || 10);

    const spaceId = resolveSpaceId(req);
    if (!spaceId) {
      res.status(400).json({ error: 'Se requiere contexto de espacio' });
      return;
    }

    const training = await prisma.$transaction(async (tx) => {
      const created = await tx.training.create({
        data: {
          title,
          description: description ?? null,
          startTime,
          endTime,
          capacity,
          createdBy: req.user!.id,
          spaceId,
        },
      });

      if (Array.isArray(exemptResourceIds) && exemptResourceIds.length > 0) {
        await tx.trainingExemption.createMany({
          data: exemptResourceIds.map((resourceId: string) => ({
            trainingId: created.id,
            resourceId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.training.findUnique({
        where: { id: created.id },
        include: TRAINING_INCLUDE,
      });
    });

    res.status(201).json(training);

    // Notificar a todas las usuarias del espacio (en background, no bloquea la respuesta)
    const fmtDate = (d: Date) => d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const fmtTime = (d: Date) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
    notifySpaceUsers(spaceId, {
      type: 'TRAINING_NEW',
      title: 'Nueva capacitación disponible',
      message: `"${title}" — ${fmtDate(startTime)} ${fmtTime(startTime)}`,
      linkTo: '/my-trainings',
    }, req.user!.id).catch(() => {});
  } catch (error) {
    logger.error({ err: error }, 'Error al crear capacitación');
    res.status(500).json({ error: 'Error al crear la capacitación' });
  }
};

export const updateTraining = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, startTime: startRaw, endTime: endRaw, capacity: capacityRaw } = req.body;

    const training = await prisma.training.findUnique({ where: { id: req.params.id } });
    if (!training) {
      res.status(404).json({ error: 'Capacitación no encontrada' });
      return;
    }

    const startTime = startRaw ? new Date(startRaw) : training.startTime;
    const endTime = endRaw ? new Date(endRaw) : training.endTime;

    if (startTime >= endTime) {
      res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });
      return;
    }

    const updated = await prisma.training.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(startRaw && { startTime }),
        ...(endRaw && { endTime }),
        ...(capacityRaw !== undefined && { capacity: Math.max(1, Number(capacityRaw) || 10) }),
      },
      include: TRAINING_INCLUDE,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Error al actualizar la capacitación' });
  }
};

export const deleteTraining = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const training = await prisma.training.findUnique({ where: { id: req.params.id } });
    if (!training) {
      res.status(404).json({ error: 'Capacitación no encontrada' });
      return;
    }

    await prisma.training.delete({ where: { id: req.params.id } });
    res.json({ message: 'Capacitación eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar la capacitación' });
  }
};

export const updateExemptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { exemptResourceIds } = req.body;

    if (!Array.isArray(exemptResourceIds)) {
      res.status(400).json({ error: 'exemptResourceIds debe ser un array' });
      return;
    }

    const training = await prisma.training.findUnique({ where: { id: req.params.id } });
    if (!training) {
      res.status(404).json({ error: 'Capacitación no encontrada' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.trainingExemption.deleteMany({ where: { trainingId: req.params.id } });

      if (exemptResourceIds.length > 0) {
        await tx.trainingExemption.createMany({
          data: exemptResourceIds.map((resourceId: string) => ({
            trainingId: req.params.id,
            resourceId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.training.findUnique({
        where: { id: req.params.id },
        include: TRAINING_INCLUDE,
      });
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Error al actualizar exenciones' });
  }
};

export const enrollTraining = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const actorRole = req.user!.role;
    const isElevated = (ELEVATED_ROLES as readonly string[]).includes(actorRole);

    const { targetUserId } = req.body ?? {};
    let userId = req.user!.id;

    if (targetUserId) {
      if (!isElevated) {
        res.status(403).json({ error: 'No tienes permiso para inscribir a otras usuarias' });
        return;
      }
      userId = targetUserId;
    }

    const training = await prisma.training.findUnique({
      where: { id },
      include: {
        _count: { select: { enrollments: { where: { status: 'CONFIRMED' } } } },
      },
    });
    if (!training) {
      res.status(404).json({ error: 'Capacitación no encontrada' });
      return;
    }

    const existing = await prisma.trainingEnrollment.findUnique({
      where: { trainingId_userId: { trainingId: id, userId } },
    });
    if (existing) {
      res.status(409).json({ error: 'La usuaria ya está inscrita en esta capacitación' });
      return;
    }

    const confirmedCount = training._count.enrollments;
    const status = confirmedCount < training.capacity ? 'CONFIRMED' : 'WAITLIST';

    const enrollment = await prisma.trainingEnrollment.create({
      data: { trainingId: id, userId, status },
      include: ENROLLMENT_INCLUDE,
    });

    res.status(201).json(enrollment);
  } catch {
    res.status(500).json({ error: 'Error al inscribirse en la capacitación' });
  }
};

export const unenrollTraining = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const actorRole = req.user!.role;
    const isElevated = (ELEVATED_ROLES as readonly string[]).includes(actorRole);

    const targetUserId = (req.body?.targetUserId ?? req.query.targetUserId) as string | undefined;
    let userId = req.user!.id;

    if (targetUserId) {
      if (!isElevated) {
        res.status(403).json({ error: 'No tienes permiso para desinscribir a otras usuarias' });
        return;
      }
      userId = targetUserId;
    }

    const enrollment = await prisma.trainingEnrollment.findUnique({
      where: { trainingId_userId: { trainingId: id, userId } },
    });
    if (!enrollment) {
      res.status(404).json({ error: 'La usuaria no está inscrita en esta capacitación' });
      return;
    }

    const wasConfirmed = enrollment.status === 'CONFIRMED';

    await prisma.$transaction(async (tx) => {
      await tx.trainingEnrollment.delete({
        where: { trainingId_userId: { trainingId: id, userId } },
      });

      // Si tenía cupo confirmado, promover al primero en lista de espera
      if (wasConfirmed) {
        const firstWaiting = await tx.trainingEnrollment.findFirst({
          where: { trainingId: id, status: 'WAITLIST' },
          orderBy: { createdAt: 'asc' },
        });
        if (firstWaiting) {
          await tx.trainingEnrollment.update({
            where: { id: firstWaiting.id },
            data: { status: 'CONFIRMED' },
          });
        }
      }
    });

    res.json({ message: 'Inscripción cancelada' });
  } catch {
    res.status(500).json({ error: 'Error al cancelar inscripción' });
  }
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

export const exportTrainings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const trainings = await prisma.training.findMany({
      where: {
        ...(spaceId ? { spaceId } : {}),
        startTime: { gte: sixMonthsAgo },
      },
      include: {
        enrollments: {
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const rows: Record<string, string | number>[] = [];

    for (const t of trainings) {
      const confirmedCount = t.enrollments.filter((e) => e.status === 'CONFIRMED').length;
      const waitlistCount = t.enrollments.filter((e) => e.status === 'WAITLIST').length;

      if (t.enrollments.length === 0) {
        rows.push({
          Capacitación: t.title,
          Descripción: t.description ?? '',
          Fecha: fmtDate(new Date(t.startTime)),
          'Hora Inicio': fmtTime(new Date(t.startTime)),
          'Hora Fin': fmtTime(new Date(t.endTime)),
          'Cupos totales': t.capacity,
          Confirmadas: confirmedCount,
          'Lista de espera': waitlistCount,
          'Usuaria inscrita': '',
          'Email usuaria': '',
          'Estado inscripción': '',
          'Fecha inscripción': '',
        });
      } else {
        for (const e of t.enrollments) {
          rows.push({
            Capacitación: t.title,
            Descripción: t.description ?? '',
            Fecha: fmtDate(new Date(t.startTime)),
            'Hora Inicio': fmtTime(new Date(t.startTime)),
            'Hora Fin': fmtTime(new Date(t.endTime)),
            'Cupos totales': t.capacity,
            Confirmadas: confirmedCount,
            'Lista de espera': waitlistCount,
            'Usuaria inscrita': e.user.name,
            'Email usuaria': e.user.email,
            'Estado inscripción': e.status === 'CONFIRMED' ? 'Confirmada' : 'Lista de espera',
            'Fecha inscripción': fmtDate(new Date(e.createdAt)),
          });
        }
      }
    }

    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Capacitaciones');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="capacitaciones.xlsx"');
    res.send(buffer);
  } catch (error) {
    logger.error({ err: error }, 'Error al exportar capacitaciones');
    res.status(500).json({ error: 'Error al exportar capacitaciones' });
  }
};
