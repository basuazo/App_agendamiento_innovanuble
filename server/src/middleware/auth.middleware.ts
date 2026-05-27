import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string; spaceId?: string | null };
}

/** Devuelve el spaceId que aplica para la petición actual.
 *  - SUPER_ADMIN:        lee el header X-Space-Id (puede ser null si no se especifica)
 *  - Todos los demás:   devuelve su propio spaceId */
export function resolveSpaceId(req: AuthRequest): string | null {
  if (req.user?.role === 'SUPER_ADMIN') {
    return (req.headers['x-space-id'] as string) || null;
  }
  return req.user?.spaceId ?? null;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token no proporcionado' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      role: string;
      email: string;
      spaceId?: string | null;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
