import express from 'express';
import { verifyJWT } from '../middleware/jwtAuth';
import { loadSlootTools, runTool } from '../controllers/toolsController';
import {
  getUserPollingFiles,
  getUserPollingFileById,
} from '../controllers/pollingFIleController';

const router = express.Router();

router.use(verifyJWT);

// /tools/* routes
router.post('/run', runTool);
router.get('/sloot', loadSlootTools);
//router.post('/polling-file', createUserPollingFile as any);
router.get('/polling-files', getUserPollingFiles as any);
router.get('/polling-file/:id', getUserPollingFileById as any);

export default router;
