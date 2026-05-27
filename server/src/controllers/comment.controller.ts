import { Response } from 'express';
import { AuthRequest, resolveSpaceId } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

const VALID_TAGS = ['GENERAL', 'MACHINE_ISSUE', 'ORDER', 'CLEANING'];

export const getComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const spaceId = resolveSpaceId(req);
    const comments = await prisma.comment.findMany({
      where: spaceId ? { spaceId } : {},
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
};

export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const content = req.body.content as string | undefined;
    const tag = (req.body.tag as string | undefined) ?? 'GENERAL';

    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'El comentario no puede estar vacío' });
      return;
    }
    if (content.length > 500) {
      res.status(400).json({ error: 'El comentario no puede superar los 500 caracteres' });
      return;
    }
    if (!VALID_TAGS.includes(tag)) {
      res.status(400).json({ error: 'Etiqueta inválida' });
      return;
    }

    const imageUrl = req.file ? req.file.filename : null;

    const spaceId = resolveSpaceId(req);
    if (!spaceId) {
      res.status(400).json({ error: 'Se requiere contexto de espacio' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        userId: req.user!.id,
        content: content.trim(),
        tag: tag as 'GENERAL' | 'MACHINE_ISSUE' | 'ORDER' | 'CLEANING',
        imageUrl,
        spaceId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(comment);
  } catch (error) {
    logger.error({ err: error }, 'Error al publicar comentario');
    res.status(500).json({ error: 'Error al publicar comentario' });
  }
};
