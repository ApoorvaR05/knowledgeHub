import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { create, list, update, remove } from '../controllers/qaController';

const router = Router();

const qaValidation = [
  body('question').trim().notEmpty().isLength({ max: 2000 }),
  body('answer').trim().notEmpty().isLength({ max: 10000 }),
];

router.post('/', requireAuth, requireAdmin, qaValidation, create);
router.get('/', requireAuth, list);
router.put('/:id', requireAuth, requireAdmin, qaValidation, update);
router.delete('/:id', requireAuth, requireAdmin, remove);

export default router;
