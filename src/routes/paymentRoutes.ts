import express from 'express';
import { verifyJWT } from '../middleware/jwtAuth';
import {
  createPaymentIntent,
  confirmPayment,
  addFunds,
  deductUsage,
  getBalance,
  getTransactions,
} from '../controllers/paymentController';

const router = express.Router();

// All payment routes require authentication
router.use(verifyJWT);

// Payment routes
router.post('/create-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);
router.post('/add-funds', addFunds);
router.post('/deduct-usage', deductUsage);
router.get('/balance', getBalance);
router.get('/transactions', getTransactions);

export default router;
