import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me } from '../controllers/authController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
], register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], login);

router.get('/me', requireAuth, me);

export default router;
