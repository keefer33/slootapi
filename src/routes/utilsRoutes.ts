import express from 'express';
import formatJson from '../controllers/utils/formatJson';
import toolsSchemaGenerator from '../controllers/utils/toolsSchemaGenerator';
import chatCompletions from '../controllers/utils/chatCompletions';
import { verifyJWT } from '../middleware/jwtAuth';

const router = express.Router();

router.use(verifyJWT);

// POST refresh token
router.post('/json-formatter', formatJson);
router.post('/tools-schema-generator', toolsSchemaGenerator);
router.post('/chat-completions', chatCompletions);

export default router;
