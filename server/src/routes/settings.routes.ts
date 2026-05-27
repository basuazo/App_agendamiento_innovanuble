import { Router } from 'express';
import { getBusinessHours, updateBusinessHours, getCustomization, updateCustomizationColors } from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.get('/settings/business-hours', authenticate, getBusinessHours);
router.put('/settings/business-hours', authenticate, requireAdmin, updateBusinessHours);

router.get('/settings/customization', authenticate, getCustomization);
router.put('/settings/customization/colors', authenticate, requireAdmin, updateCustomizationColors);

export default router;
