import { Router } from 'express';
import { getResources, getResourceById, createResource, updateResource, toggleResource, deleteResource } from '../controllers/resource.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireElevated } from '../middleware/role.middleware';

const router = Router();

router.get('/', authenticate, getResources);
router.get('/:id', authenticate, getResourceById);
router.post('/', authenticate, requireElevated, createResource);
router.put('/:id', authenticate, requireElevated, updateResource);
router.patch('/:id/toggle', authenticate, requireElevated, toggleResource);
router.delete('/:id', authenticate, requireElevated, deleteResource);

export default router;
