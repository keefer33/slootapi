import express from 'express';
import { loadAgent } from '../controllers/agentController';
import { verifyJWT } from '../middleware/jwtAuth';
import { getAgent } from '../middleware/getAgent';

const router = express.Router();

router.use(verifyJWT);
// Apply API key authentication to all agent routes
router.use(getAgent);

/*
// Example of req.user
req.user = {
    userId: '',
    token: '1234567890',
    userModel: {},
}
*/

// POST /agents - Get all agents data using API key authentication
router.post('/', loadAgent);

export default router;
