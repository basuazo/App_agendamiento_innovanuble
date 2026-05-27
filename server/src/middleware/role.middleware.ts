import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

// Grupos de roles reutilizables
export const ADMIN_ROLES   = ['ADMIN', 'SUPER_ADMIN'] as const;
export const COMUNITARIA_ROLES = ['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'] as const; // reservas + usuarios + categorías
export const ELEVATED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'] as const; // recursos

/** Factory: permite acceso a cualquiera de los roles indicados */
export const requireAnyOf = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acceso denegado.' });
      return;
    }
    next();
  };

/** Permite acceso a ADMIN y SUPER_ADMIN */
export const requireAdmin = requireAnyOf(...ADMIN_ROLES);

/** Permite acceso solo a SUPER_ADMIN */
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de super administrador.' });
    return;
  }
  next();
};

/** ADMIN + SUPER_ADMIN + LIDER_COMUNITARIA: reservas, categorías, verificar usuarios */
export const requireComunitaria = requireAnyOf(...COMUNITARIA_ROLES);

/** Cualquier rol elevado (todos excepto USER) */
export const requireElevated = requireAnyOf(...ELEVATED_ROLES);
