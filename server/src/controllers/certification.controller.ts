import { Response } from 'express';
import { AuthRequest, resolveSpaceId } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';

const CATEGORY_SELECT = { select: { id: true, name: true, slug: true, color: true } };

const CERT_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  certifier: { select: { id: true, name: true } },
  category: CATEGORY_SELECT,
};

// ── Usuario ──────────────────────────────────────────────────────────────────

export const getMyCertifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const certs = await prisma.certification.findMany({
      where: { userId: req.user!.id },
      include: { certifier: { select: { name: true } }, category: CATEGORY_SELECT },
      orderBy: { certifiedAt: 'desc' },
    });
    res.json(certs);
  } catch {
    res.status(500).json({ error: 'Error al obtener certificaciones' });
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const getAllCertifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);
    const { userId } = req.query;
    const certs = await prisma.certification.findMany({
      where: {
        ...(spaceId ? { user: { spaceId } } : {}),
        ...(userId ? { userId: userId as string } : {}),
      },
      include: CERT_INCLUDE,
      orderBy: { certifiedAt: 'desc' },
    });
    res.json(certs);
  } catch {
    res.status(500).json({ error: 'Error al obtener certificaciones' });
  }
};

export const certifyUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, categoryId, notes } = req.body as {
      userId: string;
      categoryId: string;
      notes?: string;
    };
    if (!userId || !categoryId) {
      res.status(400).json({ error: 'userId y categoryId son requeridos' });
      return;
    }

    const cert = await prisma.certification.upsert({
      where: { userId_categoryId: { userId, categoryId } },
      create: { userId, categoryId, certifiedById: req.user!.id, notes },
      update: { certifiedById: req.user!.id, certifiedAt: new Date(), notes },
      include: CERT_INCLUDE,
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'CERT_REQUEST_APPROVED',
      targetType: 'Certification',
      targetId: cert.id,
      meta: { userId, categoryId, notes: notes ?? null },
    });

    res.status(201).json(cert);
  } catch {
    res.status(500).json({ error: 'Error al certificar usuaria' });
  }
};

export const revokeCertification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cert = await prisma.certification.findUnique({ where: { id: req.params.id } });
    if (!cert) {
      res.status(404).json({ error: 'Certificación no encontrada' });
      return;
    }
    await prisma.certification.delete({ where: { id: req.params.id } });

    await logAudit({
      actorId: req.user!.id,
      action: 'CERTIFICATION_REVOKED',
      targetType: 'Certification',
      targetId: req.params.id,
      meta: { userId: cert.userId, categoryId: cert.categoryId },
    });

    res.json({ message: 'Certificación revocada' });
  } catch {
    res.status(500).json({ error: 'Error al revocar certificación' });
  }
};
