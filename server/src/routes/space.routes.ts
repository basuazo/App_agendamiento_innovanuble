import { Router } from 'express';
import { getSpaces, createSpace, updateSpace, deleteSpace } from '../controllers/space.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/role.middleware';

const router = Router();

// Listar espacios: público (necesario para el formulario de registro)
router.get('/', getSpaces);

// Gestión: solo SUPER_ADMIN
router.post('/', authenticate, requireSuperAdmin, createSpace);
router.put('/:id', authenticate, requireSuperAdmin, updateSpace);
router.delete('/:id', authenticate, requireSuperAdmin, deleteSpace);

export default router;
