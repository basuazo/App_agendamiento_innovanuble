import { Router } from 'express';
import {
  getAllBookings,
  getMyBookings,
  createBooking,
  updateBooking,
  cancelBooking,
  approveBooking,
  rejectBooking,
  getAdminBookings,
  checkAvailability,
  exportBookings,
} from '../controllers/booking.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireComunitaria } from '../middleware/role.middleware';

const router = Router();

// Rutas específicas antes de /:id para evitar conflictos de parámetros
router.get('/availability', authenticate, checkAvailability);
router.get('/export', authenticate, requireComunitaria, exportBookings);

router.get('/', authenticate, getAllBookings);
router.get('/mine', authenticate, getMyBookings);
router.post('/', authenticate, createBooking);
router.patch('/:id', authenticate, updateBooking);
router.patch('/:id/cancel', authenticate, cancelBooking);
router.patch('/:id/approve', authenticate, requireComunitaria, approveBooking);
router.patch('/:id/reject', authenticate, requireComunitaria, rejectBooking);

// Admin / Líder Comunitaria
router.get('/admin/all', authenticate, requireComunitaria, getAdminBookings);

export default router;
