import express from 'express';
import { createToken } from '../controllers/authController';

const router = express.Router();

// POST refresh token
router.post('/create-token', createToken);

export default router;
