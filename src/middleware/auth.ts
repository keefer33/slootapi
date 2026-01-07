import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware, ValidationMiddleware } from '../types';

export const authenticateToken: AuthMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access token required',
      message: 'Please provide a valid authentication token',
    });
    return;
  }

  // TODO: Implement JWT token verification
  // jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
  //   if (err) {
  //     return res.status(403).json({
  //       success: false,
  //       error: 'Invalid token',
  //       message: 'Token is invalid or expired'
  //     });
  //   }
  //   req.user = user;
  //   next();
  // });

  // For now, just mock the authentication
  (req as any).user = {
    id: 'mock-user-id-123',
    email: 'john@example.com',
    name: 'John Doe',
  };
  next();
};

export const validateUser: ValidationMiddleware = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'Name, email, and password are required',
    });
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({
      success: false,
      error: 'Invalid email format',
      message: 'Please provide a valid email address',
    });
    return;
  }

  // Basic password validation
  if (password.length < 6) {
    res.status(400).json({
      success: false,
      error: 'Password too short',
      message: 'Password must be at least 6 characters long',
    });
    return;
  }

  next();
};
