import { Request } from 'express';
import { User, UserProfile } from '../types';
import { getClient } from './supabaseClient';

// Global user state management
let currentUser: User | null = null;

/**
 * Set the current user (typically called from middleware)
 * @param user - The user object to set as current
 */
export const setCurrentUser = (user: User): void => {
  currentUser = user;
};

/**
 * Get the current user from global state
 * @returns The current user or null if not set
 */
export const getCurrentUser = (): User | null => {
  return currentUser;
};

/**
 * Clear the current user from global state
 */
export const clearCurrentUser = (): void => {
  currentUser = null;
};

/**
 * Get user from request object (for use in route handlers)
 * @param req - Express request object
 * @returns The user from the request or null if not found
 */
export const getUserFromRequest = (req: Request): User | null => {
  return (req as any).user || null;
};

/**
 * Get user by ID from database
 * @param userId - The user ID to fetch
 * @returns Promise<User | null> - The user object or null if not found
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const { supabase } = await getClient();

    // Get user profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('balance, currency')
      .eq('user_id', userId)
      .single();

    if (userProfileError) {
      console.error('Error fetching user profile:', userProfileError);
      return null;
    }

    // Get user model (you might need to adjust this based on your schema)
    const { data: userModel, error: userModelError } = await supabase
      .from('user_models')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userModelError) {
      console.error('Error fetching user model:', userModelError);
      return null;
    }

    // Get basic user info (you might need to adjust this based on your schema)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
      return null;
    }

    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      userId: userData.id,
      token: '', // No token when fetching from DB
      userModel: userModel || ({} as any),
      userProfile: userProfile || ({} as UserProfile),
    } as User;
  } catch (error) {
    console.error('Error in getUserById:', error);
    return null;
  }
};

/**
 * Get user by email from database
 * @param email - The email to search for
 * @returns Promise<User | null> - The user object or null if not found
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const { supabase } = await getClient();

    // Get user by email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email)
      .single();

    if (userError) {
      console.error('Error fetching user by email:', userError);
      return null;
    }

    // Use getUserById to get the complete user object
    return await getUserById(userData.id);
  } catch (error) {
    console.error('Error in getUserByEmail:', error);
    return null;
  }
};

/**
 * Update user profile
 * @param userId - The user ID to update
 * @param profileData - The profile data to update
 * @returns Promise<boolean> - Success status
 */
export const updateUserProfile = async (
  userId: string,
  profileData: Partial<UserProfile>
): Promise<boolean> => {
  try {
    const { supabase } = await getClient();

    const { error } = await supabase
      .from('user_profiles')
      .update(profileData)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating user profile:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return false;
  }
};

/**
 * Check if user has sufficient balance
 * @param userId - The user ID to check
 * @param requiredAmount - The amount required
 * @returns Promise<boolean> - Whether user has sufficient balance
 */
export const hasSufficientBalance = async (
  userId: string,
  requiredAmount: number
): Promise<boolean> => {
  try {
    const user = await getUserById(userId);
    if (!user) return false;

    return user.userProfile.balance >= requiredAmount;
  } catch (error) {
    console.error('Error checking user balance:', error);
    return false;
  }
};

/**
 * Deduct amount from user balance
 * @param userId - The user ID
 * @param amount - The amount to deduct
 * @returns Promise<boolean> - Success status
 */
export const deductUserBalance = async (
  userId: string,
  amount: number
): Promise<boolean> => {
  try {
    const user = await getUserById(userId);
    if (!user) return false;

    if (user.userProfile.balance < amount) return false;

    const newBalance = user.userProfile.balance - amount;
    return await updateUserProfile(userId, { balance: newBalance });
  } catch (error) {
    console.error('Error deducting user balance:', error);
    return false;
  }
};

/**
 * Add amount to user balance
 * @param userId - The user ID
 * @param amount - The amount to add
 * @returns Promise<boolean> - Success status
 */
export const addUserBalance = async (
  userId: string,
  amount: number
): Promise<boolean> => {
  try {
    const user = await getUserById(userId);
    if (!user) return false;

    const newBalance = user.userProfile.balance + amount;
    return await updateUserProfile(userId, { balance: newBalance });
  } catch (error) {
    console.error('Error adding to user balance:', error);
    return false;
  }
};

// Convenience function that works with both request and global state
export const getUser = (req?: Request): User | null => {
  if (req) {
    return getUserFromRequest(req);
  }
  return getCurrentUser();
};
