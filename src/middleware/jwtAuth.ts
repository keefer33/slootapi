import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User, UserProfile } from '../types';
import { getClient } from '../utils/supabaseClient';
import { setCurrentUser } from '../utils/userUtils';

export const verifyJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'No token provided',
      message: 'Access token is required',
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  try {
    const jwtSecret =
      process.env.JWT_SECRET ||
      'your-super-secret-jwt-key-change-this-in-production';
    const decoded = jwt.verify(token, jwtSecret) as any;
    //get user_profile from supabase
    const { supabase } = await getClient();
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('balance, currency')
      .eq('user_id', decoded.u)
      .single();
    if (userProfileError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Token is invalid or expired',
      });
    }

    // Create user object
    const user = {
      id: decoded.u || decoded.id || '',
      email: decoded.email || '',
      name: decoded.name || '',
      userId: decoded.u || decoded.userId || '',
      token: token,
      userModel: decoded.userModel || ({} as any),
      userProfile: userProfile || ({} as UserProfile),
    } as User;

    // Add user info to request object
    (req as any).user = user;

    // Set global user state
    setCurrentUser(user);

    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'Token is invalid or expired',
    });
  }
};
