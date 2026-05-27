import { Router } from 'express';
import {
  getMyCertifications,
  getAllCertifications,
  certifyUser,
  revokeCertification,
} from '../controllers/certification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireElevated } from '../middleware/role.middleware';

const router = Router();

// Usuario
router.get('/certifications/mine', authenticate, getMyCertifications);

// Admin / Roles elevados (ADMIN, SUPER_ADMIN, LIDER_COMUNITARIA)
router.get('/admin/certifications', authenticate, requireElevated, getAllCertifications);
router.post('/admin/certifications', authenticate, requireElevated, certifyUser);
router.delete('/admin/certifications/:id', authenticate, requireElevated, revokeCertification);

export default router;
