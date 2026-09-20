import { Router } from 'express';
import { login, getProfile } from '../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.get('/me', getProfile);

export default router;

