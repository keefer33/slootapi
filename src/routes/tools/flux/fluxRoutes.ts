import express from 'express';
import { verifyJWT } from '../../../middleware/jwtAuth';
import {
  createFluxKontextRequest,
  pollFluxKontextResult,
  generateFluxKontextImage,
} from './fluxKontextPro';
import {
  createFluxKontextMaxRequest,
  pollFluxKontextMaxResult,
  generateFluxKontextMaxImage,
} from './fluxKontextMax';
import {
  createFluxProUltraRequest,
  pollFluxProUltraResult,
  generateFluxProUltraImage,
} from './fluxProUltra';
import {
  createFluxProRequest,
  pollFluxProResult,
  generateFluxProImage,
} from './fluxPro';
import {
  createFluxDevRequest,
  pollFluxDevResult,
  generateFluxDevImage,
} from './fluxDev';

const router = express.Router();

router.use(verifyJWT);

// FLUX.1 Kontext routes
// POST /flux/flux-kontext-pro - Create a new image generation request
// GET /flux/flux-kontext-pro/poll?polling_url=... - Poll for result status
// POST /flux/flux-kontext-pro/generate - Create request and poll until completion
router.post('/flux-kontext-pro', createFluxKontextRequest);
router.get('/flux-kontext-pro/poll', pollFluxKontextResult);
router.post('/flux-kontext-pro/generate', generateFluxKontextImage);

// FLUX Kontext Max routes
// POST /flux/flux-kontext-max - Create a new FLUX Kontext Max image generation request
// GET /flux/flux-kontext-max/poll?polling_url=... - Poll for result status
// POST /flux/flux-kontext-max/generate - Create request and poll until completion
router.post('/flux-kontext-max', createFluxKontextMaxRequest);
router.get('/flux-kontext-max/poll', pollFluxKontextMaxResult);
router.post('/flux-kontext-max/generate', generateFluxKontextMaxImage);

// FLUX 1.1 Pro routes
// POST /flux/flux-pro - Create a new FLUX 1.1 Pro image generation request
// GET /flux/flux-pro/poll?polling_url=... - Poll for result status
// POST /flux/flux-pro/generate - Create request and poll until completion
router.post('/flux-pro', createFluxProRequest);
router.get('/flux-pro/poll', pollFluxProResult);
router.post('/flux-pro/generate', generateFluxProImage);

// FLUX.1 Dev routes
// POST /flux/flux-dev - Create a new FLUX.1 Dev image generation request
// GET /flux/flux-dev/poll?polling_url=... - Poll for result status
// POST /flux/flux-dev/generate - Create request and poll until completion
router.post('/flux-dev', createFluxDevRequest);
router.get('/flux-dev/poll', pollFluxDevResult);
router.post('/flux-dev/generate', generateFluxDevImage);

// FLUX Pro Ultra routes
// POST /flux/flux-pro-ultra - Create a new FLUX Pro Ultra image generation request
// GET /flux/flux-pro-ultra/poll?polling_url=... - Poll for result status
// POST /flux/flux-pro-ultra/generate - Create request and poll until completion
router.post('/flux-pro-ultra', createFluxProUltraRequest);
router.get('/flux-pro-ultra/poll', pollFluxProUltraResult);
router.post('/flux-pro-ultra/generate', generateFluxProUltraImage);

export default router;
