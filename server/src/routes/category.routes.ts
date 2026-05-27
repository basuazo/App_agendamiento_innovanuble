import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireComunitaria } from '../middleware/role.middleware';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../controllers/category.controller';

const router = Router();

router.get('/', authenticate, getCategories);
router.post('/', authenticate, requireComunitaria, createCategory);
router.put('/reorder', authenticate, requireComunitaria, reorderCategories);
router.put('/:id', authenticate, requireComunitaria, updateCategory);
router.delete('/:id', authenticate, requireComunitaria, deleteCategory);

export default router;
