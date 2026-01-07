import express from 'express';
import { Request, Response } from 'express';
import { verifyJWT } from '../middleware/jwtAuth';
import {
  pipedreamApps,
  pipedreamAccountsList,
  pipedreamGetApp,
  pipedreamDeleteConnectedAccount,
  pipedreamCreateConnectToken,
  pipedreamAppCategories,
  pipedreamGetAccountApp,
  deletePipedreamTools,
  runPipedreamActionRoute,
} from '../controllers/pipedreamController';

const router = express.Router();

router.use(verifyJWT);

router.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Pipedream routes are working!',
    timestamp: new Date().toISOString(),
  });
});

// /pipedream/* routes
router.get('/connect/token', pipedreamCreateConnectToken);
router.post('/run', runPipedreamActionRoute);
router.get('/apps', pipedreamApps);
router.get('/app/:appId', pipedreamGetApp);
router.get('/app/categories', pipedreamAppCategories);
router.post('/accounts/list', pipedreamAccountsList);
router.get('/account/app/:accountId', pipedreamGetAccountApp);
router.post('/account/tools/delete', deletePipedreamTools);
router.post('/account/delete', pipedreamDeleteConnectedAccount);

export default router;
