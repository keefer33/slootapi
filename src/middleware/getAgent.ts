import { getClient } from '../utils/supabaseClient';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

export const getAgent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { supabase } = await getClient();

    // Query user_models table to find user by api_key
    const { data: userModel, error: userError } = await supabase
      .from('user_models')
      .select('*,model_id(*,brand_id(*)),apikey(key)')
      .eq('id', req.body.agent_id)
      .single();

    if (userError || !userModel) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid',
      });
      return;
    }

    // Add user info to request for use in route handlers
    (req as AuthenticatedRequest).user = {
      ...(req as any).user,
      userModel: userModel,
    } as any;

    next();
  } catch (error: any) {
    console.error('Error in API key authentication:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
