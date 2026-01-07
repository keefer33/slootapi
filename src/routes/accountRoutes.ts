import express, { Request, Response } from 'express';
import { verifyJWT } from '../middleware/jwtAuth';
import { getClient } from '../utils/supabaseClient';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

// Get user's API keys
router.get(
  '/apikeys',
  verifyJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { user } = req as AuthenticatedRequest;
      const { supabase } = await getClient();

      const { data: apikeys, error } = await supabase
        .from('user_apikeys')
        .select('id, name, key, settings, created_at')
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching API keys:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch API keys',
          message: 'An error occurred while retrieving your API keys',
        });
        return;
      }

      // Mask API keys for security
      const maskedApikeys = (apikeys || []).map((apikey: any) => ({
        ...apikey,
        key:
          apikey.key.length > 8
            ? `${apikey.key.substring(0, 4)}...${apikey.key.substring(apikey.key.length - 4)}`
            : `${apikey.key.substring(0, 2)}...${apikey.key.substring(apikey.key.length - 2)}`,
      }));

      res.status(200).json({
        success: true,
        data: maskedApikeys,
      });
    } catch (error: any) {
      console.error('Error in /apikeys route:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      });
    }
  }
);

export default router;
