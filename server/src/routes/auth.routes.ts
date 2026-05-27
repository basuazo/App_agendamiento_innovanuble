import { Router } from 'express';
import { register, login, getMe, updateMe, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);
router.patch('/me/password', authenticate, changePassword);

export default router;
