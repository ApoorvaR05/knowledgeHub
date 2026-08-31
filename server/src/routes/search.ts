import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middleware/requireAuth';
import { search } from '../controllers/searchController';

const router = Router();

router.post('/', requireAuth, [
  body('query').trim().notEmpty().isLength({ max: 1000 }),
], search);

export default router;
