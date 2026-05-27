import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

const baseWhere = (userId: string) => ({
  userId,
  expiresAt: { gt: new Date() },
});

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await prisma.notification.findMany({
      where: baseWhere(req.user!.id),
      orderBy: { createdAt: 'desc' },
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== req.user!.id) {
      res.status(404).json({ error: 'Notificación no encontrada' });
      return;
    }
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { ...baseWhere(req.user!.id), isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
};
