import { Router } from 'express';
import { getTrainings, createTraining, updateTraining, deleteTraining, updateExemptions, enrollTraining, unenrollTraining, exportTrainings } from '../controllers/training.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.get('/trainings', authenticate, getTrainings);
router.post('/trainings/:id/enroll', authenticate, enrollTraining);
router.delete('/trainings/:id/enroll', authenticate, unenrollTraining);

router.get('/admin/trainings/export', authenticate, requireAdmin, exportTrainings);
router.post('/admin/trainings', authenticate, requireAdmin, createTraining);
router.patch('/admin/trainings/:id', authenticate, requireAdmin, updateTraining);
router.delete('/admin/trainings/:id', authenticate, requireAdmin, deleteTraining);
router.patch('/admin/trainings/:id/exemptions', authenticate, requireAdmin, updateExemptions);

export default router;
