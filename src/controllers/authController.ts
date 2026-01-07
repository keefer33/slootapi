import { getClient } from '../utils/supabaseClient';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { ApiResponse } from '../types';

export const createToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No valid authorization header',
        message: 'Bearer token is required',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const { supabase } = await getClient();

    // Use the token to get user info
    const {
      data: { user: userData },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: userError.message,
      });
      return;
    }

    // Generate ultra-minimal JWT token (just user ID)
    const permanentToken = jwt.sign(
      { u: userData.id },
      process.env.JWT_SECRET ||
        'your-super-secret-jwt-key-change-this-in-production'
    );

    const response: ApiResponse = {
      success: true,
      data: {
        user: userData.id,
        token: permanentToken,
        expiresIn: 'never',
      },
      message: 'User authenticated successfully',
    };

    res.status(200).json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
      message: error.message,
    });
  }
};
