import express from 'express';
import { kieaiWebhook } from '../utils/kieaiApi';
import { supabaseWebhookPollingFile } from '../controllers/pollingFIleController';
const router = express.Router();

// POST kieai webhook
router.post('/kieai', kieaiWebhook);
router.post('/polling', supabaseWebhookPollingFile as any);
router.get('/polling', (req: any, res: any) => {
  res.json({
    success: true,
    data: 'Polling file retrieved successfully',
  });
});

export default router;
