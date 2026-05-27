import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as xlsx from 'xlsx';
import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';
import { AuthRequest, resolveSpaceId } from '../middleware/auth.middleware';

const USER_SELECT = { id: true, name: true, email: true, phone: true, organization: true, role: true, isVerified: true, spaceId: true, createdAt: true } as const;

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const spaceId = resolveSpaceId(req);
    const spaceFilter = spaceId ? { spaceId } : {};
    const baseWhere = { ...spaceFilter, deletedAt: null };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: baseWhere,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: baseWhere }),
    ]);

    res.json({ data: users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, spaceId: bodySpaceId, organization, phone } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
      return;
    }

    // LIDER_COMUNITARIA solo puede crear usuarios con rol USER
    if (req.user?.role === 'LIDER_COMUNITARIA' && role && role !== 'USER') {
      res.status(403).json({ error: 'Solo puedes crear usuarias con rol Usuario' });
      return;
    }

    // SUPER_ADMIN puede crear en cualquier espacio (desde body), ADMIN crea en su propio espacio
    const spaceId = req.user!.role === 'SUPER_ADMIN' ? bodySpaceId : req.user!.spaceId;
    if (!spaceId) {
      res.status(400).json({ error: 'Se requiere un espacio para crear el usuario' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && !existing.deletedAt) {
      res.status(409).json({ error: 'El email ya está registrado' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Si existe pero estaba eliminado (soft delete), reactivarlo con los nuevos datos
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name, password: hashedPassword, organization: organization?.trim() || null, phone: phone?.trim() || null, role: role ?? 'USER', isVerified: true, spaceId, deletedAt: null },
          select: USER_SELECT,
        })
      : await prisma.user.create({
          data: { name, email, password: hashedPassword, organization: organization?.trim() || null, phone: phone?.trim() || null, role: role ?? 'USER', isVerified: true, spaceId },
          select: USER_SELECT,
        });

    await logAudit({
      actorId: req.user!.id,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: user.id,
      meta: { name: user.name, email: user.email, role: user.role },
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Evitar que el admin se elimine a sí mismo
    if (id === req.user?.id) {
      res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Cancelar reservas activas antes de marcar como eliminado
    await prisma.booking.updateMany({
      where: { userId: id, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED' },
    });

    await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      actorId: req.user!.id,
      action: 'USER_DELETED',
      targetType: 'User',
      targetId: id,
      meta: { name: user.name, email: user.email },
    });

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count(),
    ]);

    res.json({ data: logs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener logs de auditoría' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, password, spaceId, organization, phone } = req.body;

    if (!name && !email && !password && spaceId === undefined && organization === undefined && phone === undefined) {
      res.status(400).json({ error: 'Debe proporcionar al menos un campo a actualizar' });
      return;
    }

    // Solo SUPER_ADMIN puede reasignar espacio
    if (spaceId !== undefined && req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Solo el Super Admin puede reasignar espacios' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    if (email && email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) {
        res.status(409).json({ error: 'El email ya está registrado por otro usuario' });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (organization !== undefined) updateData.organization = organization?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (spaceId !== undefined) updateData.spaceId = spaceId || null;
    if (password) {
      if (req.user?.role === 'LIDER_COMUNITARIA') {
        res.status(403).json({ error: 'No tienes permiso para cambiar contraseñas' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        return;
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });

    res.json(user);
  } catch {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

export const verifyUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    if (target.isVerified) {
      res.status(400).json({ error: 'El usuario ya está verificado' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isVerified: true },
      select: USER_SELECT,
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'USER_VERIFIED',
      targetType: 'User',
      targetId: id,
      meta: { name: user.name, email: user.email },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar usuario' });
  }
};

export const changeUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body;
    if (!['ADMIN', 'USER', 'LIDER_COMUNITARIA'].includes(role)) {
      res.status(400).json({ error: 'Rol inválido.' });
      return;
    }

    const before = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { name: true, role: true },
    });

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: USER_SELECT,
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: user.id,
      meta: { name: user.name, previousRole: before?.role, newRole: role },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar rol' });
  }
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Administrador',
  LIDER_COMUNITARIA: 'Líder Comunitaria', USER: 'Usuario',
};

export const exportUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);
    const spaceFilter = spaceId ? { spaceId } : {};
    const users = await prisma.user.findMany({
      where: { ...spaceFilter, deletedAt: null },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });

    const rows = users.map((u) => ({
      Nombre: u.name,
      Email: u.email,
      Teléfono: u.phone ?? '',
      Agrupación: u.organization ?? '',
      Rol: ROLE_LABELS[u.role] ?? u.role,
      Estado: u.isVerified ? 'Verificada' : 'Pendiente',
      Registrada: new Date(u.createdAt).toLocaleDateString('es-CL'),
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, 'Usuarias');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="usuarias.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ error: 'Error al exportar usuarios' });
  }
};

export const exportUserSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id, deletedAt: null }, select: USER_SELECT });
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [bookings, enrollments, certifications] = await Promise.all([
      prisma.booking.findMany({
        where: { userId: id, startTime: { gte: sixMonthsAgo } },
        include: {
          resource: { select: { name: true, category: { select: { name: true } } } },
        },
        orderBy: { startTime: 'desc' },
      }),
      prisma.trainingEnrollment.findMany({
        where: { userId: id, training: { startTime: { gte: sixMonthsAgo } } },
        include: { training: { select: { title: true, startTime: true, endTime: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.certification.findMany({
        where: { userId: id },
        include: {
          category: { select: { name: true } },
          certifier: { select: { name: true } },
        },
        orderBy: { certifiedAt: 'desc' },
      }),
    ]);

    const fmtDate = (d: Date) => d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const fmtTime = (d: Date) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const STATUS_LABELS: Record<string, string> = { CONFIRMED: 'Confirmada', PENDING: 'Pendiente', CANCELLED: 'Cancelada', REJECTED: 'Rechazada' };
    const PURPOSE_LABELS: Record<string, string> = { LEARN: 'Aprender', PRODUCE: 'Producir', DESIGN: 'Diseñar', REUNION: 'Reunión' };
    const ENROLL_LABELS: Record<string, string> = { CONFIRMED: 'Inscrita', WAITLIST: 'Lista de espera' };

    const bookingRows = bookings.map((b) => ({
      Fecha: fmtDate(new Date(b.startTime)),
      'Hora Inicio': fmtTime(new Date(b.startTime)),
      'Hora Fin': fmtTime(new Date(b.endTime)),
      Recurso: (b.resource as { name: string }).name,
      Categoría: (b.resource as { category: { name: string } }).category.name,
      Propósito: PURPOSE_LABELS[b.purpose] ?? b.purpose,
      'Ítem a Producir': b.produceItem ?? '',
      Cantidad: b.produceQty ?? '',
      Estado: STATUS_LABELS[b.status] ?? b.status,
      Notas: b.notes ?? '',
      'Fecha de Reserva': fmtDate(new Date(b.createdAt)),
    }));

    const enrollmentRows = enrollments.map((e) => ({
      Capacitación: e.training.title,
      Fecha: fmtDate(new Date(e.training.startTime)),
      'Hora Inicio': fmtTime(new Date(e.training.startTime)),
      'Hora Fin': fmtTime(new Date(e.training.endTime)),
      Estado: ENROLL_LABELS[e.status] ?? e.status,
      'Fecha Inscripción': fmtDate(new Date(e.createdAt)),
    }));

    const certRows = certifications.map((c) => ({
      Categoría: (c.category as { name: string } | null)?.name ?? '',
      'Certificada el': fmtDate(new Date(c.certifiedAt)),
      'Certificada por': (c.certifier as { name: string } | null)?.name ?? '',
      Notas: c.notes ?? '',
    }));

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(bookingRows.length ? bookingRows : [{ Info: 'Sin reservas en los últimos 6 meses' }]), 'Reservas');
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(enrollmentRows.length ? enrollmentRows : [{ Info: 'Sin capacitaciones en los últimos 6 meses' }]), 'Capacitaciones');
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(certRows.length ? certRows : [{ Info: 'Sin certificaciones' }]), 'Certificaciones');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const safeName = user.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="usuaria_${safeName}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ error: 'Error al exportar datos del usuario' });
  }
};

export const getUserSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

    const [bookings, enrollments, certifications] = await Promise.all([
      prisma.booking.findMany({
        where: { userId: id },
        include: {
          resource: { select: { id: true, name: true, category: { select: { id: true, name: true, slug: true, color: true } } } },
        },
        orderBy: { startTime: 'desc' },
        take: 50,
      }),
      prisma.trainingEnrollment.findMany({
        where: { userId: id },
        include: {
          training: { select: { id: true, title: true, startTime: true, endTime: true, capacity: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.certification.findMany({
        where: { userId: id },
        include: {
          category: true,
          certifier: { select: { id: true, name: true } },
        },
        orderBy: { certifiedAt: 'desc' },
      }),
    ]);

    const bookingStats = {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'PENDING').length,
      confirmed: bookings.filter((b) => b.status === 'CONFIRMED').length,
      cancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
      rejected: bookings.filter((b) => b.status === 'REJECTED').length,
    };

    res.json({ user, bookings, bookingStats, enrollments, certifications });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener resumen de usuario' });
  }
};
