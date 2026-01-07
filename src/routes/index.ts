import express, { Request, Response } from 'express';

// Import route modules
import authRoutes from './authRoutes';
import agentRoutes from './agentRoutes';
import toolsRoutes from './toolsRoutes';
import utilsRoutes from './utilsRoutes';
import pipedreamRoutes from './pipedreamRoutes';
import paymentRoutes from './paymentRoutes';
import accountRoutes from './accountRoutes';
import fluxRoutes from './tools/flux/fluxRoutes';
import coolifyRoutes from './coolify/coolifyRoutes';
import webhooksRoutes from './webhooksRoutes';

const router = express.Router();

// Route definitions
router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);
router.use('/tools', toolsRoutes);
router.use('/pipedream', pipedreamRoutes);
router.use('/utils', utilsRoutes);
router.use('/payments', paymentRoutes);
router.use('/account', accountRoutes);
router.use('/flux', fluxRoutes);
router.use('/coolify', coolifyRoutes);
router.use('/webhooks', webhooksRoutes);

// Test route to verify routing is working
router.get('/healthcheck', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API is online!',
    timestamp: new Date().toISOString(),
  });
});

// API info endpoint
router.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to Sloot API',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      health: '/health',
      agents: '/agents',
      agents_anthropic: '/agents/anthropic',
      agents_openai: '/agents/openai',
      agents_gemini: '/agents/gemini',
      agents_xai: '/agents/xai',
      tools: '/tools',
      tools_execute: '/tools/execute',
      payments: '/payments',
      account: '/account',
      account_apikeys: '/account/apikeys',
      coolify: '/coolify',
      coolify_resources: '/coolify/resources',
      coolify_applications: '/coolify/applications',
      coolify_databases: '/coolify/databases',
      coolify_servers: '/coolify/servers',
      coolify_services: '/coolify/services',
      coolify_user_databases: '/coolify/user-databases',
    },
    documentation: 'API documentation coming soon...',
  });
});

export default router;
