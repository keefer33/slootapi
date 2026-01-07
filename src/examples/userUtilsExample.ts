/**
 * Example usage of the global user utility
 * This file demonstrates how to use the userUtils across your application
 */

import {
  getUser,
  getCurrentUser,
  getUserById,
  getUserByEmail,
  hasSufficientBalance,
  deductUserBalance,
  addUserBalance,
  updateUserProfile,
} from '../utils/userUtils';
import { Request } from 'express';

// Example 1: Using getUser in a route handler
export const exampleRouteHandler = async (req: Request, res: any) => {
  // Get user from request (recommended for route handlers)
  const user = getUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  console.log('Current user:', user.email);
  console.log('User balance:', user.userProfile.balance);
};

// Example 2: Using getCurrentUser in any file (after middleware has run)
export const someUtilityFunction = () => {
  const user = getCurrentUser();

  if (user) {
    console.log('Global user:', user.name);
  } else {
    console.log('No user currently set');
  }
};

// Example 3: Getting user by ID from database
export const getUserData = async (userId: string) => {
  const user = await getUserById(userId);

  if (user) {
    console.log('User found:', user.email);
    return user;
  } else {
    console.log('User not found');
    return null;
  }
};

// Example 4: Getting user by email
export const findUserByEmail = async (email: string) => {
  const user = await getUserByEmail(email);

  if (user) {
    console.log('User found by email:', user.name);
    return user;
  } else {
    console.log('User not found with email:', email);
    return null;
  }
};

// Example 5: Checking user balance
export const checkUserBalance = async (
  userId: string,
  requiredAmount: number
) => {
  const hasBalance = await hasSufficientBalance(userId, requiredAmount);

  if (hasBalance) {
    console.log('User has sufficient balance');
    return true;
  } else {
    console.log('User has insufficient balance');
    return false;
  }
};

// Example 6: Deducting user balance
export const processPayment = async (userId: string, amount: number) => {
  const success = await deductUserBalance(userId, amount);

  if (success) {
    console.log('Payment processed successfully');
    return true;
  } else {
    console.log('Payment failed - insufficient balance');
    return false;
  }
};

// Example 7: Adding to user balance
export const addCredits = async (userId: string, amount: number) => {
  const success = await addUserBalance(userId, amount);

  if (success) {
    console.log('Credits added successfully');
    return true;
  } else {
    console.log('Failed to add credits');
    return false;
  }
};

// Example 8: Updating user profile
export const updateUserSettings = async (
  userId: string,
  newBalance: number
) => {
  const success = await updateUserProfile(userId, { balance: newBalance });

  if (success) {
    console.log('User profile updated successfully');
    return true;
  } else {
    console.log('Failed to update user profile');
    return false;
  }
};

// Example 9: Complete workflow with user operations
export const completeWorkflow = async (req: Request, res: any) => {
  try {
    // Get current user
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check balance
    const requiredAmount = 0.01;
    const hasBalance = await hasSufficientBalance(user.userId, requiredAmount);

    if (!hasBalance) {
      return res.status(402).json({
        error: 'Insufficient balance',
        message: `You need at least ${requiredAmount} credits`,
      });
    }

    // Process payment
    const paymentSuccess = await deductUserBalance(user.userId, requiredAmount);

    if (!paymentSuccess) {
      return res.status(500).json({ error: 'Payment processing failed' });
    }

    // Get updated user data
    const updatedUser = await getUserById(user.userId);

    return res.json({
      success: true,
      message: 'Operation completed successfully',
      user: {
        id: updatedUser?.id,
        email: updatedUser?.email,
        balance: updatedUser?.userProfile.balance,
      },
    });
  } catch (error) {
    console.error('Workflow error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
