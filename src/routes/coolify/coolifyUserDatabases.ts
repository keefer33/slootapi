import { Request, Response } from 'express';
import { getClient } from '../../utils/supabaseClient';
import { getCurrentUser } from '../../utils/userUtils';

// Database Types for user_cloud_databases table
export interface UserCloudDatabase {
  id?: number;
  created_at?: string;
  user_id?: string;
  database_uuid?: string;
  type?: string;
  public_port?: number;
  external_db_url?: string;
  internal_db_url?: string;
  config?: any;
  response?: any;
}

// Create User Cloud Database Request Interface
export interface CreateUserCloudDatabaseRequest {
  database_uuid: string;
  type: string;
  public_port?: number;
  external_db_url?: string;
  internal_db_url?: string;
  config?: any;
  response?: any;
}

// Update User Cloud Database Request Interface
export interface UpdateUserCloudDatabaseRequest {
  database_uuid?: string;
  type?: string;
  public_port?: number;
  external_db_url?: string;
  internal_db_url?: string;
  config?: any;
  response?: any;
}

// Get all user cloud databases
export const getUserCloudDatabasesByUserId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('Getting user cloud databases by user ID');
    const currentUser = getCurrentUser();

    if (!currentUser?.id) {
      res.status(400).json({
        success: false,
        error: 'Current user ID is required',
      });
      return;
    }

    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_cloud_databases')
      .select('*')
      .eq('user_id', currentUser?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting user cloud databases:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user cloud databases',
      });
      return;
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('Error getting user cloud databases:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user cloud databases',
    });
  }
};

// Get a specific user cloud database by ID
export const getUserCloudDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser();

    if (!currentUser?.id) {
      res.status(400).json({
        success: false,
        error: 'Current user ID is required',
      });
      return;
    }

    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_cloud_databases')
      .select('*')
      .eq('id', id)
      .eq('user_id', currentUser?.id)
      .single();

    if (error) {
      console.error('Error getting user cloud database:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user cloud database',
      });
      return;
    }

    res.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Error getting user cloud database:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user cloud database',
    });
  }
};

// Create a new user cloud database
export const createUserCloudDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const currentUser = getCurrentUser();

    if (!currentUser?.id) {
      res.status(400).json({
        success: false,
        error: 'Current user ID is required',
      });
      return;
    }

    const databaseData: CreateUserCloudDatabaseRequest = req.body;

    // Validate required fields
    if (!databaseData.database_uuid || !databaseData.type) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: database_uuid, type',
      });
      return;
    }

    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_cloud_databases')
      .insert({
        user_id: currentUser?.id,
        database_uuid: databaseData.database_uuid,
        type: databaseData.type,
        public_port: databaseData.public_port,
        external_db_url: databaseData.external_db_url,
        internal_db_url: databaseData.internal_db_url,
        config: databaseData.config,
        response: databaseData.response,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user cloud database:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create user cloud database',
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Error creating user cloud database:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create user cloud database',
    });
  }
};

// Update a user cloud database
export const updateUserCloudDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser();

    if (!currentUser?.id) {
      res.status(400).json({
        success: false,
        error: 'Current user ID is required',
      });
      return;
    }

    const updateData: UpdateUserCloudDatabaseRequest = req.body;

    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_cloud_databases')
      .update({
        database_uuid: updateData.database_uuid,
        type: updateData.type,
        public_port: updateData.public_port,
        external_db_url: updateData.external_db_url,
        internal_db_url: updateData.internal_db_url,
        config: updateData.config,
        response: updateData.response,
      })
      .eq('id', id)
      .eq('user_id', currentUser?.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user cloud database:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user cloud database',
      });
      return;
    }

    res.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Error updating user cloud database:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update user cloud database',
    });
  }
};

// Delete a user cloud database
export const deleteUserCloudDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser();

    if (!currentUser?.id) {
      res.status(400).json({
        success: false,
        error: 'Current user ID is required',
      });
      return;
    }

    const { supabase } = await getClient();
    const { error } = await supabase
      .from('user_cloud_databases')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser?.id);

    if (error) {
      console.error('Error deleting user cloud database:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete user cloud database',
      });
      return;
    }

    res.json({
      success: true,
      message: 'User cloud database deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting user cloud database:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user cloud database',
    });
  }
};

// Get user cloud database by database UUID
export const getUserCloudDatabaseByUuid = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { uuid } = req.params;
    const currentUser = getCurrentUser();

    if (!currentUser?.id) {
      res.status(400).json({
        success: false,
        error: 'Current user ID is required',
      });
      return;
    }

    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_cloud_databases')
      .select('*')
      .eq('database_uuid', uuid)
      .eq('user_id', currentUser?.id)
      .single();

    if (error) {
      console.error('Error getting user cloud database by UUID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user cloud database',
      });
      return;
    }

    res.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Error getting user cloud database by UUID:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user cloud database',
    });
  }
};
