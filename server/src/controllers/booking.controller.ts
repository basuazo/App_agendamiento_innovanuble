import { Response } from 'express';
import * as xlsx from 'xlsx';
import { AuthRequest, resolveSpaceId } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { checkConflict } from '../services/booking.service';
import { createCalendarEvent, deleteCalendarEvent } from '../services/googleCalendar.service';
import { logAudit } from '../lib/audit';
import logger from '../lib/logger';

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDateTime(d: Date) {
  return `${fmtDate(d)} ${fmtTime(d)}`;
}

const BOOKING_INCLUDE = {
  user: { select: { id: true, name: true, email: true, organization: true } },
  resource: { select: { id: true, name: true, category: { select: { id: true, name: true, slug: true, color: true } } } },
};

// Helper: filtro de espacio que maneja bookings con y sin resource
function spaceFilter(spaceId: string | null) {
  if (!spaceId) return {};
  return {
    OR: [
      { resource: { spaceId } },
      { resourceId: null as null, user: { spaceId } },
    ],
  };
}

export const getAllBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);
    const bookings = await prisma.booking.findMany({
      where: { status: 'CONFIRMED', ...spaceFilter(spaceId) },
      include: BOOKING_INCLUDE,
      orderBy: { startTime: 'asc' },
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
};

export const getAdminBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);
    const bookings = await prisma.booking.findMany({
      where: spaceId ? spaceFilter(spaceId) : {},
      include: BOOKING_INCLUDE,
      orderBy: { startTime: 'desc' },
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
};

export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user!.id },
      include: BOOKING_INCLUDE,
      orderBy: { startTime: 'desc' },
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
};

export const checkAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startTime: startRaw, endTime: endRaw } = req.query as { startTime?: string; endTime?: string };
    if (!startRaw || !endRaw) {
      res.status(400).json({ error: 'startTime y endTime son requeridos' });
      return;
    }

    const startTime = new Date(startRaw);
    const endTime = new Date(endRaw);

    const overlapWhere = {
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    };

    const spaceId = resolveSpaceId(req);
    const resources = await prisma.resource.findMany({
      where: { isActive: true, ...(spaceId ? { spaceId } : {}) },
      select: { id: true, category: { select: { slug: true } }, capacity: true },
    });

    const confirmedBookings = await prisma.booking.findMany({
      where: { status: 'CONFIRMED', ...overlapWhere },
      select: { resourceId: true, quantity: true },
    });

    const trainings = await prisma.training.findMany({
      where: { ...overlapWhere, ...(spaceId ? { spaceId } : {}) },
      include: { exemptions: { select: { resourceId: true } } },
    });

    const maintenances = await prisma.maintenance.findMany({
      where: { ...overlapWhere, ...(spaceId ? { spaceId } : {}) },
    });

    const mesonResource = resources.find((r) => r.category.slug === 'MESON_CORTE');
    const reunionResource = resources.find((r) => r.category.slug === 'ESPACIO_REUNION');
    const hasMesonBooking = mesonResource
      ? confirmedBookings.some((b) => b.resourceId === mesonResource.id)
      : false;
    const hasReunionBooking = reunionResource
      ? confirmedBookings.some((b) => b.resourceId === reunionResource.id)
      : false;

    const availability: Record<string, { status: string; reason?: string; availableCapacity?: number }> = {};

    for (const resource of resources) {
      if (maintenances.length > 0) {
        availability[resource.id] = { status: 'blocked', reason: 'Mantención del espacio' };
        continue;
      }

      const blockingTraining = trainings.find(
        (t) => !t.exemptions.some((e) => e.resourceId === resource.id)
      );
      if (blockingTraining) {
        availability[resource.id] = { status: 'blocked', reason: 'Bloqueada por Capacitación' };
        continue;
      }

      if (resource.category.slug === 'ESPACIO_REUNION' && hasMesonBooking) {
        availability[resource.id] = { status: 'blocked', reason: 'Mesones en uso' };
        continue;
      }
      if (resource.category.slug === 'MESON_CORTE' && hasReunionBooking) {
        availability[resource.id] = { status: 'blocked', reason: 'Espacio de Reuniones reservado' };
        continue;
      }

      if (resource.capacity > 1) {
        const usedQty = confirmedBookings
          .filter((b) => b.resourceId === resource.id)
          .reduce((sum, b) => sum + b.quantity, 0);
        if (usedQty >= resource.capacity) {
          availability[resource.id] = { status: 'booked', reason: 'Sin disponibilidad' };
        } else {
          availability[resource.id] = {
            status: 'available',
            availableCapacity: resource.capacity - usedQty,
          };
        }
        continue;
      }

      const isBooked = confirmedBookings.some((b) => b.resourceId === resource.id);
      if (isBooked) {
        availability[resource.id] = { status: 'booked', reason: 'Reservada' };
      } else {
        availability[resource.id] = { status: 'available' };
      }
    }

    res.json(availability);
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar disponibilidad' });
  }
};

export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      resourceId,
      groupName: groupNameRaw,
      startTime: startRaw,
      endTime: endRaw,
      notes,
      purpose,
      produceItem,
      produceQty,
      quantity: quantityRaw,
      isPrivate,
      attendees: attendeesRaw,
      companionRelation,
      targetUserId,
      localDate,
      localStartTime,
      localEndTime,
      isExceptional: isExceptionalRaw,
    } = req.body;

    const ELEVATED = ['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'];
    const isElevatedActor = ELEVATED.includes(req.user!.role);
    const isExceptional = !!(isExceptionalRaw && isElevatedActor);

    const bookingUserId = (isElevatedActor && targetUserId) ? targetUserId : req.user!.id;

    if (!startRaw || !endRaw || !purpose) {
      res.status(400).json({ error: 'startTime, endTime y purpose son requeridos' });
      return;
    }

    const startTime = new Date(startRaw);
    const endTime = new Date(endRaw);

    if (endTime <= startTime) {
      res.status(400).json({ error: 'La hora de término debe ser posterior a la hora de inicio' });
      return;
    }

    if (startTime < new Date()) {
      res.status(400).json({ error: 'No se pueden crear reservas en el pasado' });
      return;
    }

    if (purpose === 'PRODUCE' && (!produceItem || !produceQty)) {
      res.status(400).json({ error: 'Para producir se requiere indicar qué se producirá y la cantidad' });
      return;
    }

    // Normalizar attendees — mínimo 1
    const attendees = Math.max(1, Number(attendeesRaw) || 1);

    // Resolver groupName: del body o del perfil del usuario que agenda
    let groupName: string | null = groupNameRaw?.trim() || null;
    if (!groupName) {
      const bookingUser = await prisma.user.findUnique({
        where: { id: bookingUserId },
        select: { organization: true },
      });
      groupName = bookingUser?.organization ?? null;
    }

    // ── RUTA SIN RECURSO ──────────────────────────────────────────────────────
    if (!resourceId) {
      // Necesitamos el spaceId del usuario para validaciones y aforo
      const bookingUser = await prisma.user.findUnique({
        where: { id: bookingUserId },
        select: { name: true, spaceId: true },
      });

      if (!bookingUser?.spaceId) {
        res.status(400).json({ error: 'No se puede determinar el espacio para la reserva' });
        return;
      }
      const spaceId = bookingUser.spaceId;

      // Validar duración máxima
      const spaceForLimit = await prisma.space.findUnique({
        where: { id: spaceId },
        select: { maxBookingMinutes: true, maxCapacity: true, lunchBreakEnabled: true, lunchBreakStart: true, lunchBreakEnd: true },
      });
      const durationMs = endTime.getTime() - startTime.getTime();
      const maxMs = (spaceForLimit?.maxBookingMinutes ?? 240) * 60 * 1000;
      if (!isExceptional && durationMs > maxMs) {
        const m = spaceForLimit?.maxBookingMinutes ?? 240;
        const h = Math.floor(m / 60); const min = m % 60;
        const maxLabel = min === 0 ? `${h} hora${h > 1 ? 's' : ''}` : `${h}:${String(min).padStart(2, '0')} horas`;
        res.status(400).json({ error: `La reserva no puede durar más de ${maxLabel}` });
        return;
      }

      // Validar horario de negocio
      if (!isExceptional && localDate && localStartTime && localEndTime) {
        const dayOfWeek = new Date(`${localDate}T12:00:00`).getDay();
        const bh = await prisma.businessHours.findUnique({
          where: { spaceId_dayOfWeek: { spaceId, dayOfWeek } },
        });
        if (bh) {
          if (!bh.isOpen) { res.status(400).json({ error: 'El espacio no abre ese día' }); return; }
          if (localStartTime < bh.openTime) { res.status(400).json({ error: `El espacio abre a las ${bh.openTime}` }); return; }
          if (localEndTime > bh.closeTime) { res.status(400).json({ error: `El espacio cierra a las ${bh.closeTime}` }); return; }
        }
      }

      // Validar colación
      if (!isExceptional && spaceForLimit?.lunchBreakEnabled && spaceForLimit.lunchBreakStart && spaceForLimit.lunchBreakEnd && localStartTime && localEndTime) {
        const lb = spaceForLimit.lunchBreakStart;
        const le = spaceForLimit.lunchBreakEnd;
        if (localStartTime < le && localEndTime > lb) {
          res.status(400).json({ error: `No se puede agendar en horario de colación. Debes agendar antes de las ${lb} y después de las ${le}` });
          return;
        }
      }

      // Bloqueo por mantención
      const maintenanceBlock = await prisma.maintenance.findFirst({
        where: { spaceId, startTime: { lt: endTime }, endTime: { gt: startTime } },
      });
      if (maintenanceBlock) {
        res.status(409).json({ error: `El espacio está en mantención: "${maintenanceBlock.title}". No se pueden crear reservas en ese horario.` });
        return;
      }

      // Aforo general: suma de attendees de reservas activas (sin máquina y con máquina no-reunión)
      if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        const maxGeneral = spaceForLimit?.maxCapacity ?? 12;
        const occupancy = await prisma.booking.aggregate({
          _sum: { attendees: true },
          where: {
            status: { in: ['CONFIRMED', 'PENDING'] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            OR: [
              { resourceId: null as null, user: { spaceId } },
              { resource: { spaceId, category: { slug: { not: 'ESPACIO_REUNION' } } } },
            ],
          },
        });
        const currentTotal = occupancy._sum.attendees ?? 0;
        if (currentTotal + attendees > maxGeneral) {
          const available = Math.max(0, maxGeneral - currentTotal);
          res.status(409).json({
            error: `El espacio ya tiene ${currentTotal} persona(s) en ese horario. Solo quedan ${available} lugar(es) disponibles (aforo máximo: ${maxGeneral}).`,
          });
          return;
        }
      }

      const booking = await prisma.booking.create({
        data: {
          userId: bookingUserId,
          resourceId: null,
          groupName,
          startTime,
          endTime,
          notes: notes ?? null,
          purpose,
          produceItem: purpose === 'PRODUCE' ? produceItem : null,
          produceQty: purpose === 'PRODUCE' ? Number(produceQty) : null,
          quantity: 1,
          isPrivate: false,
          attendees,
          companionRelation: null,
          isExceptional,
          status: 'CONFIRMED',
        },
        include: BOOKING_INCLUDE,
      });

      res.status(201).json(booking);
      return;
    }

    // ── RUTA CON RECURSO (lógica original intacta) ────────────────────────────

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: { category: { select: { id: true, name: true, slug: true, color: true } } },
    });

    const durationMs = endTime.getTime() - startTime.getTime();
    const spaceForLimit = resource
      ? await prisma.space.findUnique({ where: { id: resource.spaceId }, select: { maxBookingMinutes: true, lunchBreakEnabled: true, lunchBreakStart: true, lunchBreakEnd: true } })
      : null;
    const maxMs = (spaceForLimit?.maxBookingMinutes ?? 240) * 60 * 1000;
    const maxLabel = (() => {
      const m = spaceForLimit?.maxBookingMinutes ?? 240;
      const h = Math.floor(m / 60); const min = m % 60;
      return min === 0 ? `${h} hora${h > 1 ? 's' : ''}` : `${h}:${String(min).padStart(2, '0')} horas`;
    })();
    if (!isExceptional && durationMs > maxMs) {
      res.status(400).json({ error: `La reserva no puede durar más de ${maxLabel}` });
      return;
    }
    if (!resource) {
      res.status(404).json({ error: 'Recurso no encontrado' });
      return;
    }
    if (!resource.isActive) {
      res.status(400).json({ error: 'El recurso no está disponible actualmente' });
      return;
    }

    if (!isExceptional && localDate && localStartTime && localEndTime) {
      const dayOfWeek = new Date(`${localDate}T12:00:00`).getDay();
      const bh = await prisma.businessHours.findUnique({
        where: { spaceId_dayOfWeek: { spaceId: resource.spaceId, dayOfWeek } },
      });
      if (bh) {
        if (!bh.isOpen) { res.status(400).json({ error: 'El espacio no abre ese día' }); return; }
        if (localStartTime < bh.openTime) { res.status(400).json({ error: `El espacio abre a las ${bh.openTime}` }); return; }
        if (localEndTime > bh.closeTime) { res.status(400).json({ error: `El espacio cierra a las ${bh.closeTime}` }); return; }
      }
    }

    if (!isExceptional && spaceForLimit?.lunchBreakEnabled && spaceForLimit.lunchBreakStart && spaceForLimit.lunchBreakEnd && localStartTime && localEndTime) {
      const lb = spaceForLimit.lunchBreakStart;
      const le = spaceForLimit.lunchBreakEnd;
      if (localStartTime < le && localEndTime > lb) {
        res.status(400).json({ error: `No se puede agendar en horario de colación. Debes agendar antes de las ${lb} y después de las ${le}` });
        return;
      }
    }

    const quantity = Math.max(1, Math.min(Number(quantityRaw) || 1, resource.capacity));

    const hasConflict = await checkConflict(resourceId, startTime, endTime, undefined, quantity, resource.capacity);
    if (hasConflict) {
      const msg = resource.capacity > 1
        ? 'No hay suficientes mesones disponibles en ese horario.'
        : 'El recurso ya está reservado en ese horario. Por favor elige otro horario.';
      res.status(409).json({ error: msg });
      return;
    }

    if (resource.category.slug === 'ESPACIO_REUNION') {
      const mesonRes = await prisma.resource.findFirst({
        where: { category: { slug: 'MESON_CORTE' }, isActive: true, spaceId: resource.spaceId },
      });
      if (mesonRes) {
        const mesonConflict = await prisma.booking.findFirst({
          where: {
            resourceId: mesonRes.id, status: 'CONFIRMED',
            AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
          },
        });
        if (mesonConflict) {
          res.status(409).json({ error: 'Los Mesones de Corte están en uso en ese horario.' });
          return;
        }
      }
    }
    if (resource.category.slug === 'MESON_CORTE') {
      const reunionRes = await prisma.resource.findFirst({
        where: { category: { slug: 'ESPACIO_REUNION' }, isActive: true, spaceId: resource.spaceId },
      });
      if (reunionRes) {
        const reunionConflict = await prisma.booking.findFirst({
          where: {
            resourceId: reunionRes.id, status: 'CONFIRMED',
            AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
          },
        });
        if (reunionConflict) {
          res.status(409).json({ error: 'El Espacio de Reuniones está reservado en ese horario.' });
          return;
        }
      }
    }

    const maintenanceBlock = await prisma.maintenance.findFirst({
      where: {
        spaceId: resource.spaceId,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (maintenanceBlock) {
      res.status(409).json({ error: `El espacio está en mantención: "${maintenanceBlock.title}". No se pueden crear reservas en ese horario.` });
      return;
    }

    const trainingBlock = await prisma.training.findFirst({
      where: {
        spaceId: resource.spaceId,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        exemptions: { none: { resourceId } },
      },
    });
    if (trainingBlock) {
      res.status(409).json({ error: `Horario bloqueado por capacitación: "${trainingBlock.title}". Contacta al administrador.` });
      return;
    }

    // Límite de aforo (no aplica a ADMIN/SUPER_ADMIN)
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
      const space = await prisma.space.findUnique({
        where: { id: resource.spaceId },
        select: { maxCapacity: true, maxCapacityReunion: true },
      });
      const isReunion = resource.category.slug === 'ESPACIO_REUNION';

      if (isReunion) {
        const maxReunion = space?.maxCapacityReunion ?? 12;
        if (attendees > maxReunion) {
          res.status(409).json({
            error: `El aforo de la sala de reuniones es de ${maxReunion} persona(s). Has indicado ${attendees}.`,
          });
          return;
        }
      } else {
        const occupancy = await prisma.booking.aggregate({
          _sum: { attendees: true },
          where: {
            status: { in: ['CONFIRMED', 'PENDING'] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            OR: [
              { resourceId: null as null, user: { spaceId: resource.spaceId } },
              { resource: { spaceId: resource.spaceId, category: { slug: { not: 'ESPACIO_REUNION' } } } },
            ],
          },
        });
        const maxGeneral = space?.maxCapacity ?? 12;
        const currentTotal = occupancy._sum.attendees ?? 0;
        if (currentTotal + attendees > maxGeneral) {
          const available = Math.max(0, maxGeneral - currentTotal);
          res.status(409).json({
            error: `El espacio ya tiene ${currentTotal} persona(s) en ese horario. Solo quedan ${available} lugar(es) disponibles (aforo máximo: ${maxGeneral}).`,
          });
          return;
        }
      }
    }

    let bookingStatus: 'CONFIRMED' | 'PENDING' = 'CONFIRMED';
    if (resource.category.slug === 'ESPACIO_REUNION' && isPrivate) {
      bookingStatus = 'PENDING';
    } else if (!['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'].includes(req.user!.role) && resource.requiresCertification) {
      const cert = await prisma.certification.findUnique({
        where: { userId_categoryId: { userId: req.user!.id, categoryId: resource.categoryId } },
      });
      if (!cert) bookingStatus = 'PENDING';
    }

    const bookingUserForCalendar = await prisma.user.findUnique({
      where: { id: bookingUserId },
      select: { name: true },
    });

    const booking = await prisma.booking.create({
      data: {
        userId: bookingUserId,
        resourceId,
        groupName,
        startTime,
        endTime,
        notes: notes ?? null,
        purpose,
        produceItem: purpose === 'PRODUCE' ? produceItem : null,
        produceQty: purpose === 'PRODUCE' ? Number(produceQty) : null,
        quantity,
        isPrivate: !!isPrivate,
        attendees,
        companionRelation: companionRelation ?? null,
        isExceptional,
        status: bookingStatus,
      },
      include: BOOKING_INCLUDE,
    });

    if (bookingStatus === 'CONFIRMED') {
      const purposeLabel: Record<string, string> = { LEARN: 'Aprender', PRODUCE: 'Producir', DESIGN: 'Diseñar', REUNION: 'Reunión' };
      const description = `Propósito: ${purposeLabel[purpose]}${
        purpose === 'PRODUCE' ? ` | ${produceItem} x${produceQty} unidades` : ''
      }${notes ? ` | Notas: ${notes}` : ''}`;

      const googleEventId = await createCalendarEvent({
        summary: `[${resource.name}] ${bookingUserForCalendar?.name ?? 'Usuario'}`,
        description,
        startTime,
        endTime,
        resourceType: resource.category.slug,
      });

      if (googleEventId) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { googleCalendarEventId: googleEventId },
        });
      }
    }

    res.status(201).json(booking);
  } catch (error) {
    logger.error({ err: error }, 'Error al crear reserva');
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
};

export const updateBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { notes, startTime: startRaw, endTime: endRaw, localDate, localStartTime, localEndTime } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      res.status(404).json({ error: 'Reserva no encontrada' });
      return;
    }

    const isElevated = ['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'].includes(req.user!.role);
    if (!isElevated && booking.userId !== req.user!.id) {
      res.status(403).json({ error: 'No tienes permiso para editar esta reserva' });
      return;
    }

    if (['CANCELLED', 'REJECTED'].includes(booking.status)) {
      res.status(400).json({ error: 'No se puede editar una reserva cancelada o rechazada' });
      return;
    }

    const startTime = startRaw ? new Date(startRaw) : new Date(booking.startTime);
    const endTime = endRaw ? new Date(endRaw) : new Date(booking.endTime);

    if (endTime <= startTime) {
      res.status(400).json({ error: 'La hora de término debe ser posterior a la hora de inicio' });
      return;
    }

    if (startTime < new Date()) {
      res.status(400).json({ error: 'No se pueden hacer cambios en el pasado' });
      return;
    }

    // Obtener resource solo si la reserva tiene uno
    const resource = booking.resourceId
      ? await prisma.resource.findUnique({
          where: { id: booking.resourceId },
          select: { spaceId: true, capacity: true },
        })
      : null;

    const spaceForLimit = resource
      ? await prisma.space.findUnique({ where: { id: resource.spaceId }, select: { maxBookingMinutes: true, lunchBreakEnabled: true, lunchBreakStart: true, lunchBreakEnd: true } })
      : null;
    const durationMs = endTime.getTime() - startTime.getTime();
    const maxMs = (spaceForLimit?.maxBookingMinutes ?? 240) * 60 * 1000;
    const maxLabel = (() => {
      const m = spaceForLimit?.maxBookingMinutes ?? 240;
      const h = Math.floor(m / 60); const min = m % 60;
      return min === 0 ? `${h} hora${h > 1 ? 's' : ''}` : `${h}:${String(min).padStart(2, '0')} horas`;
    })();
    if (!booking.isExceptional && durationMs > maxMs) {
      res.status(400).json({ error: `La reserva no puede durar más de ${maxLabel}` });
      return;
    }

    if (!booking.isExceptional && localDate && localStartTime && localEndTime && resource) {
      const dayOfWeek = new Date(`${localDate}T12:00:00`).getDay();
      const bh = await prisma.businessHours.findUnique({
        where: { spaceId_dayOfWeek: { spaceId: resource.spaceId, dayOfWeek } },
      });
      if (bh) {
        if (!bh.isOpen) { res.status(400).json({ error: 'El espacio no abre ese día' }); return; }
        if (localStartTime < bh.openTime) { res.status(400).json({ error: `El espacio abre a las ${bh.openTime}` }); return; }
        if (localEndTime > bh.closeTime) { res.status(400).json({ error: `El espacio cierra a las ${bh.closeTime}` }); return; }
      }
    }

    if (!booking.isExceptional && spaceForLimit?.lunchBreakEnabled && spaceForLimit.lunchBreakStart && spaceForLimit.lunchBreakEnd && localStartTime && localEndTime) {
      const lb = spaceForLimit.lunchBreakStart;
      const le = spaceForLimit.lunchBreakEnd;
      if (localStartTime < le && localEndTime > lb) {
        res.status(400).json({ error: `No se puede agendar en horario de colación. Debes agendar antes de las ${lb} y después de las ${le}` });
        return;
      }
    }

    // Solo verificar conflicto de recurso si la reserva tiene uno
    if (booking.resourceId) {
      const hasConflict = await checkConflict(
        booking.resourceId, startTime, endTime, booking.id,
        booking.quantity, resource?.capacity ?? 1
      );
      if (hasConflict) {
        res.status(409).json({ error: 'El recurso ya está reservado en ese horario. Por favor elige otro horario.' });
        return;
      }
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        ...(startRaw && { startTime }),
        ...(endRaw && { endTime }),
        ...(notes !== undefined && { notes }),
      },
      include: BOOKING_INCLUDE,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la reserva' });
  }
};

export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      res.status(404).json({ error: 'Reserva no encontrada' });
      return;
    }

    if (booking.status === 'CANCELLED') {
      res.status(400).json({ error: 'La reserva ya está cancelada' });
      return;
    }

    if (!['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'].includes(req.user!.role) && booking.userId !== req.user!.id) {
      res.status(403).json({ error: 'No tienes permiso para cancelar esta reserva' });
      return;
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
      include: BOOKING_INCLUDE,
    });

    if (booking.googleCalendarEventId) {
      await deleteCalendarEvent(booking.googleCalendarEventId);
    }

    if (['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role) && booking.userId !== req.user!.id) {
      await logAudit({
        actorId: req.user!.id,
        action: 'BOOKING_CANCELLED',
        targetType: 'Booking',
        targetId: booking.id,
        meta: {
          userId: booking.userId,
          resourceId: booking.resourceId ?? null,
          startTime: booking.startTime,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al cancelar la reserva' });
  }
};

export const approveBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, organization: true } },
        resource: { include: { category: { select: { id: true, name: true, slug: true, color: true } } } },
      },
    });

    if (!booking) {
      res.status(404).json({ error: 'Reserva no encontrada' });
      return;
    }
    if (booking.status !== 'PENDING') {
      res.status(400).json({ error: 'Solo se pueden aprobar reservas pendientes' });
      return;
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED' },
      include: BOOKING_INCLUDE,
    });

    // Sincronizar Google Calendar solo si la reserva tiene recurso
    if (booking.resource) {
      const purposeLabel: Record<string, string> = { LEARN: 'Aprender', PRODUCE: 'Producir', DESIGN: 'Diseñar', REUNION: 'Reunión' };
      const description = `Propósito: ${purposeLabel[booking.purpose]}${
        booking.purpose === 'PRODUCE' ? ` | ${booking.produceItem} x${booking.produceQty} unidades` : ''
      }${booking.notes ? ` | Notas: ${booking.notes}` : ''}`;

      const googleEventId = await createCalendarEvent({
        summary: `[${booking.resource.name}] ${(booking.user as { name: string }).name}`,
        description,
        startTime: booking.startTime,
        endTime: booking.endTime,
        resourceType: (booking.resource as { category: { slug: string } }).category.slug,
      });

      if (googleEventId) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { googleCalendarEventId: googleEventId },
        });
      }
    }

    await logAudit({
      actorId: req.user!.id,
      action: 'BOOKING_APPROVED',
      targetType: 'Booking',
      targetId: booking.id,
      meta: {
        userId: booking.userId,
        userName: (booking.user as { name: string }).name,
        resourceName: booking.resource?.name ?? 'Sin máquina',
        startTime: booking.startTime,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al aprobar la reserva' });
  }
};

export const rejectBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });

    if (!booking) {
      res.status(404).json({ error: 'Reserva no encontrada' });
      return;
    }
    if (booking.status !== 'PENDING') {
      res.status(400).json({ error: 'Solo se pueden rechazar reservas pendientes' });
      return;
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
      include: BOOKING_INCLUDE,
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'BOOKING_REJECTED',
      targetType: 'Booking',
      targetId: booking.id,
      meta: { userId: booking.userId, resourceId: booking.resourceId ?? null, startTime: booking.startTime },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar la reserva' });
  }
};

const PURPOSE_LABELS: Record<string, string> = {
  LEARN: 'Aprender',
  PRODUCE: 'Producir',
  DESIGN: 'Diseñar',
  REUNION: 'Reunión',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  REJECTED: 'Rechazada',
};

export const exportBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const bookings = await prisma.booking.findMany({
      where: {
        ...(spaceId ? spaceFilter(spaceId) : {}),
        startTime: { gte: sixMonthsAgo },
      },
      include: BOOKING_INCLUDE,
      orderBy: { startTime: 'desc' },
    });

    const rows = bookings.map((b) => ({
      Fecha: fmtDate(new Date(b.startTime)),
      'Hora Inicio': fmtTime(new Date(b.startTime)),
      'Hora Fin': fmtTime(new Date(b.endTime)),
      Agrupación: b.groupName ?? '',
      'N° Personas': b.attendees,
      Recurso: b.resource?.name ?? 'Sin máquina asignada',
      Categoría: (b.resource as { category?: { name: string } } | null)?.category?.name ?? '',
      Usuario: (b.user as { name: string }).name,
      'Email Usuario': (b.user as { email: string }).email,
      Propósito: PURPOSE_LABELS[b.purpose] ?? b.purpose,
      'Ítem a Producir': b.produceItem ?? '',
      Cantidad: b.produceQty ?? '',
      Estado: STATUS_LABELS[b.status] ?? b.status,
      Notas: b.notes ?? '',
      'Fecha de Reserva': fmtDateTime(new Date(b.createdAt)),
    }));

    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Reservas');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reservas.xlsx"');
    res.send(buffer);
  } catch (error) {
    logger.error({ err: error }, 'Error al exportar reservas');
    res.status(500).json({ error: 'Error al exportar reservas' });
  }
};
