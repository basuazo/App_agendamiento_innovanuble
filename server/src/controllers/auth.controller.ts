import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { notifyRolesInSpace } from '../lib/notifications';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, spaceId, organization } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
      return;
    }

    if (!organization?.trim()) {
      res.status(400).json({ error: 'La agrupación u organización es requerida' });
      return;
    }

    if (!spaceId) {
      res.status(400).json({ error: 'Debes seleccionar un espacio' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space || !space.isActive) {
      res.status(400).json({ error: 'El espacio seleccionado no existe o no está activo' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'El email ya está registrado' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name, email, password: hashedPassword, spaceId, organization: organization.trim() },
    });

    res.status(201).json({ message: 'Registro exitoso. Tu cuenta está pendiente de verificación por el administrador.' });

    // Notificar a admins y líderes comunitarias del espacio (en background)
    notifyRolesInSpace(spaceId, ['ADMIN', 'LIDER_COMUNITARIA'], {
      type: 'USER_PENDING',
      title: 'Nueva usuaria pendiente de verificación',
      message: `${name} (${email}) se registró y espera verificación.`,
      linkTo: '/admin/users',
    }).catch(() => {});
  } catch (error) {
    logger.error({ err: error }, 'Error en registro');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña son requeridos' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    if (user.deletedAt) {
      res.status(403).json({ error: 'Esta cuenta ha sido eliminada.' });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({ error: 'Tu cuenta está pendiente de verificación por el administrador.' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, spaceId: user.spaceId ?? null },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'] }
    );

    res.json({
      user: {
        id: user.id, name: user.name, email: user.email,
        organization: user.organization, role: user.role,
        spaceId: user.spaceId, createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error en login');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getMe = async (req: Request & { user?: { id: string } }, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, phone: true, organization: true, role: true, spaceId: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateMe = async (req: Request & { user?: { id: string } }, res: Response): Promise<void> => {
  try {
    const { name, email, organization, phone } = req.body;

    if (!name && !email && !organization && phone === undefined) {
      res.status(400).json({ error: 'Debe proporcionar al menos un campo para actualizar' });
      return;
    }

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== req.user!.id) {
        res.status(409).json({ error: 'El email ya está registrado por otro usuario' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(organization !== undefined && { organization: organization?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
      },
      select: { id: true, name: true, email: true, phone: true, organization: true, role: true, spaceId: true, createdAt: true },
    });

    res.json(user);
  } catch (error) {
    logger.error({ err: error }, 'Error al actualizar perfil');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const changePassword = async (req: Request & { user?: { id: string } }, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'La contraseña actual y la nueva son requeridas' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      res.status(400).json({ error: 'La contraseña actual es incorrecta' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    logger.error({ err: error }, 'Error al cambiar contraseña');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
