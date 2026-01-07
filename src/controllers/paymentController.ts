import { Request, Response } from 'express';
import Stripe from 'stripe';
import { getClient } from '../utils/supabaseClient';
import { AuthenticatedRequest } from '../types';

// Initialize Stripe with lazy loading
let stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!stripe) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    console.log('🔑 Stripe Secret Key loaded:', stripeSecretKey ? 'Yes' : 'No');
    console.log(
      '🔑 Available env vars:',
      Object.keys(process.env).filter(key => key.includes('STRIPE'))
    );

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-08-27.basil',
    });
  }
  return stripe;
};

// Create PaymentIntent
export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const userId =
      (req as AuthenticatedRequest).user?.userId ||
      (req as AuthenticatedRequest).user?.id;

    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Minimum is $1.00',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amount,
      currency: 'usd',
      metadata: {
        userId: userId,
        type: 'add_funds',
      },
    });

    // Store payment intent in database for tracking
    const { supabase } = await getClient();
    const { error: dbError } = await supabase
      .from('stripe_payment_intents')
      .insert({
        user_id: userId,
        stripe_payment_intent_id: paymentIntent.id,
        amount: amount,
        currency: 'usd',
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the request, just log the error
    }

    return res.status(200).json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create payment intent',
    });
  }
};

// Confirm PaymentIntent
export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.body;
    const userId =
      (req as AuthenticatedRequest).user?.userId ||
      (req as AuthenticatedRequest).user?.id;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent =
      await getStripe().paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: 'Payment not completed',
      });
    }

    // Verify the payment intent belongs to this user
    if (paymentIntent.metadata.userId !== userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID not found in payment intent',
      });
    }

    const amountInDollars = paymentIntent.amount / 100;

    // Add balance to user account using Supabase function
    const { supabase } = await getClient();
    console.log('🔍 Calling add_user_balance with:', {
      userId,
      amountInDollars,
      paymentIntentId,
    });

    // First, check if user exists in user_profiles
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('user_id, balance')
      .eq('user_id', userId)
      .single();

    console.log('🔍 User profile check:', { userProfile, userError });

    if (userError && userError.code !== 'PGRST116') {
      // PGRST116 = no rows found
      console.error('❌ Error checking user profile:', userError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check user profile',
        details: userError.message,
      });
    }

    // If user doesn't exist, create them
    if (!userProfile) {
      console.log('🔍 Creating user profile for:', userId);
      const { error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          balance: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (createError) {
        console.error('❌ Error creating user profile:', createError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user profile',
          details: createError.message,
        });
      }
    }

    const { data: functionResult, error: transactionError } =
      await supabase.rpc('add_user_balance', {
        p_user_id: userId,
        p_amount: amountInDollars,
        p_payment_intent_id: paymentIntentId,
        p_description: `Added $${amountInDollars.toFixed(2)} to account balance`,
      });

    console.log('🔍 Function result:', functionResult);
    console.log('🔍 Function error:', transactionError);

    if (transactionError) {
      console.error('❌ Database function error:', transactionError);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        details: transactionError.message,
      });
    }

    if (!functionResult) {
      console.error(
        '❌ Function returned false - check Supabase logs for details'
      );
      return res.status(500).json({
        success: false,
        error: 'Failed to update balance',
        details: 'Function returned false - check database logs',
      });
    }

    // Update payment intent status in database
    await supabase
      .from('stripe_payment_intents')
      .update({
        status: 'succeeded',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', paymentIntentId);

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      amount: amountInDollars,
    });
  } catch (error) {
    console.error('❌ Error confirming payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to confirm payment',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Add funds (alternative endpoint)
export const addFunds = async (req: Request, res: Response) => {
  try {
    const { amount, paymentMethodId } = req.body;
    const userId =
      (req as AuthenticatedRequest).user?.userId ||
      (req as AuthenticatedRequest).user?.id;

    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Minimum is $1.00',
      });
    }

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Payment method is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Create and confirm payment intent
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        userId: userId,
        type: 'add_funds',
      },
    });

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: 'Payment failed',
      });
    }

    const amountInDollars = amount / 100;

    // Add balance to user account
    const { supabase } = await getClient();
    // In paymentController.ts, update the function call
    const { data: functionResult, error: transactionError } =
      await supabase.rpc('add_user_balance', {
        p_amount: amountInDollars, // NUMERIC - first parameter
        p_description: `Added $${amountInDollars.toFixed(2)} to account balance`, // TEXT - second parameter
        p_payment_intent_id: paymentIntent.id, // TEXT - third parameter
        p_user_id: userId, // TEXT - fourth parameter
      });

    if (transactionError) {
      console.error('❌ Database function error:', transactionError);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        details: transactionError.message,
      });
    }

    if (!functionResult) {
      console.error(
        '❌ Function returned false - check Supabase logs for details'
      );
      return res.status(500).json({
        success: false,
        error: 'Failed to update balance',
        details: 'Function returned false - check database logs',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Funds added successfully',
      amount: amountInDollars,
    });
  } catch (error) {
    console.error('Error adding funds:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add funds',
    });
  }
};

// Deduct usage from balance
export const deductUsage = async (req: Request, res: Response) => {
  try {
    const { amount, usageId, description } = req.body;
    const userId =
      (req as AuthenticatedRequest).user?.userId ||
      (req as AuthenticatedRequest).user?.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
      });
    }

    if (!usageId) {
      return res.status(400).json({
        success: false,
        error: 'Usage ID is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const amountInDollars = amount / 100;

    // Deduct usage from balance
    const { supabase } = await getClient();
    const { data: success, error: transactionError } = await supabase.rpc(
      'deduct_usage_balance',
      {
        user_id: userId,
        amount: amountInDollars,
        usage_id: usageId,
        description:
          description || `Usage charge: $${amountInDollars.toFixed(4)}`,
      }
    );

    if (transactionError) {
      console.error('Database error:', transactionError);
      return res.status(500).json({
        success: false,
        error: 'Failed to deduct usage',
      });
    }

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Usage deducted successfully',
      amount: amountInDollars,
    });
  } catch (error) {
    console.error('Error deducting usage:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to deduct usage',
    });
  }
};

// Get user balance
export const getBalance = async (req: Request, res: Response) => {
  try {
    const userId =
      (req as AuthenticatedRequest).user?.userId ||
      (req as AuthenticatedRequest).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('balance, currency')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching balance:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch balance',
      });
    }

    return res.status(200).json({
      success: true,
      balance: data?.balance || 0,
      currency: data?.currency || 'usd',
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch balance',
    });
  }
};

// Get user transactions
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const userId =
      (req as AuthenticatedRequest).user?.userId ||
      (req as AuthenticatedRequest).user?.id;
    const { limit = 50, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      console.error('Error fetching transactions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
      });
    }

    return res.status(200).json({
      success: true,
      transactions: data || [],
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
    });
  }
};
