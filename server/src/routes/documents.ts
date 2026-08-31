import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { upload as uploadDoc, list, remove } from '../controllers/documentController';

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();
router.post('/', requireAuth, requireAdmin, upload.single('file'), uploadDoc);
router.get('/', requireAuth, list);
router.delete('/:id', requireAuth, requireAdmin, remove);

export default router;
