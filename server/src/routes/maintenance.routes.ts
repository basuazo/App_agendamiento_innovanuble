import { Router } from 'express';
import { getMaintenances, createMaintenance, updateMaintenance, deleteMaintenance } from '../controllers/maintenance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

// GET es público para todos los autenticados (necesario para mostrar bloqueos en el calendario)
router.get('/maintenances', authenticate, getMaintenances);
router.post('/admin/maintenances', authenticate, requireAdmin, createMaintenance);
router.patch('/admin/maintenances/:id', authenticate, requireAdmin, updateMaintenance);
router.delete('/admin/maintenances/:id', authenticate, requireAdmin, deleteMaintenance);

export default router;
