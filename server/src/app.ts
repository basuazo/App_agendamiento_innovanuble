import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import logger from './lib/logger';

import prisma from './lib/prisma';
import authRoutes from './routes/auth.routes';
import resourceRoutes from './routes/resource.routes';
import bookingRoutes from './routes/booking.routes';
import userRoutes from './routes/user.routes';
import commentRoutes from './routes/comment.routes';
import trainingRoutes from './routes/training.routes';
import certificationRoutes from './routes/certification.routes';
import settingsRoutes from './routes/settings.routes';
import spaceRoutes from './routes/space.routes';
import categoryRoutes from './routes/category.routes';
import notificationRoutes from './routes/notification.routes';
import maintenanceRoutes from './routes/maintenance.routes';

// ── Validación de variables de entorno críticas ───────────────────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Variable de entorno requerida no encontrada: ${key}`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET!.length < 32) {
  console.error('[startup] JWT_SECRET debe tener al menos 32 caracteres');
  process.exit(1);
}

export { default as logger } from './lib/logger';

// ── App Express ───────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT ?? 3001;

// Confiar en el proxy de Render para obtener la IP real del cliente
app.set('trust proxy', 1);

// Compresión HTTP (gzip/brotli)
app.use(compression());

// Seguridad: headers HTTP
app.use(helmet());

// Logging de requests
app.use(pinoHttp({ logger }));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
  credentials: true,
}));

// Body con límite de tamaño
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Archivos estáticos (en producción sirve el build del cliente)
app.use(express.static(path.join(__dirname, '../public')));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Demasiados intentos. Intente nuevamente en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Rutas API ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', trainingRoutes);
app.use('/api', certificationRoutes);
app.use('/api', settingsRoutes);
app.use('/api', maintenanceRoutes);

// SPA fallback (solo en producción, para react-router)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });
}

// ── Error handler global ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Error no manejado');
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
  });
});

// ── Inicio del servidor ───────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
});

server.setTimeout(30_000);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async () => {
  logger.info('Cerrando servidor...');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Servidor cerrado');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
