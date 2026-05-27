import { Router, Request, Response, NextFunction } from 'express';
import { getComments, createComment } from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadSingle } from '../middleware/upload.middleware';

const router = Router();

router.get('/', authenticate, getComments);

// Multer maneja multipart/form-data; si hay error (tipo de archivo, tamaño) lo capturamos aquí
router.post(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    uploadSingle(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  createComment,
);

export default router;
