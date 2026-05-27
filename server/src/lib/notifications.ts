import prisma from './prisma';
import { NotificationType } from '@prisma/client';

const EXPIRES_DAYS = 5;

function expiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + EXPIRES_DAYS);
  return d;
}

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  linkTo?: string;
}

/** Notifica a todos los usuarios activos y verificados de un espacio (excluye opcionalmente a uno). */
export async function notifySpaceUsers(
  spaceId: string,
  payload: NotificationPayload,
  excludeUserId?: string,
): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      spaceId,
      deletedAt: null,
      isVerified: true,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      linkTo: payload.linkTo ?? null,
      expiresAt: expiresAt(),
    })),
  });
}

/** Notifica a roles específicos dentro de un espacio. */
export async function notifyRolesInSpace(
  spaceId: string,
  roles: string[],
  payload: NotificationPayload,
): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      spaceId,
      deletedAt: null,
      role: { in: roles as any },
    },
    select: { id: true },
  });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      linkTo: payload.linkTo ?? null,
      expiresAt: expiresAt(),
    })),
  });
}
