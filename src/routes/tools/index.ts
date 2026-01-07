import express from 'express';

// Import route modules
import fluxRoutes from './flux/fluxRoutes';


const router = express.Router();

// /tools/sloot/flux* routes
router.use('/flux', fluxRoutes);

export default router;
