import prisma from './prisma';
import { AuditAction, Prisma } from '@prisma/client';

export async function logAudit(params: {
  actorId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  meta?: Prisma.InputJsonObject;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        meta: (params.meta ?? {}) as Prisma.InputJsonObject,
      },
    });
  } catch {
    // Audit failures must never break the main operation
  }
}
