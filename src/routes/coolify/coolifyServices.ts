import { Request, Response } from 'express';
import axios from 'axios';
import { getClient } from '../../utils/supabaseClient';
import { getCurrentUser } from '../../utils/userUtils';

// Coolify Service Creation API Types
export interface CreateServiceRequest {
  type: string;
  name: string;
  description?: string;
  project_uuid?: string;
  environment_name?: string;
  environment_uuid?: string;
  server_uuid?: string;
  destination_uuid?: string;
  instant_deploy?: boolean;
  docker_compose_raw?: string;
  cloud_services_id?: string;
}

export interface CreateServiceResponse {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
  project_uuid: string;
  environment_uuid: string;
  server_uuid: string;
  destination_uuid: string;
}

export interface CoolifyError {
  error: string;
  message?: string;
}

// Database Types for user_cloud_services table
export interface UserCloudService {
  id?: string;
  created_at?: string;
  user_id?: string;
  service_id?: string;
  domain?: string;
  type?: string;
  config?: any;
  response?: any;
  env?: any;
  cloud_services_id?: string;
}

// Database helper functions
export const saveUserCloudService = async (
  serviceData: UserCloudService
): Promise<UserCloudService | null> => {
  try {
    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_cloud_services')
      .insert([serviceData])
      .select()
      .single();

    if (error) {
      console.error('Error saving user cloud service:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error saving user cloud service:', error);
    return null;
  }
};

export const updateUserCloudService = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Service ID is required',
      });
      return;
    }

    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_cloud_services')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user cloud service:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user cloud service',
      });
      return;
    }

    if (!data) {
      res.status(404).json({
        success: false,
        error: 'Service not found or update failed',
      });
      return;
    }

    res.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Update User Cloud Service Error:', error);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update user cloud service',
    });
  }
};

export const deleteUserCloudService = async (id: string): Promise<boolean> => {
  const currentUser = getCurrentUser();
  try {
    const { supabase } = await getClient();
    const { error } = await supabase
      .from('user_cloud_services')
      .delete()
      .eq('service_id', id)
      .eq('user_id', currentUser?.id);

    if (error) {
      console.error('Error deleting user cloud service:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting user cloud service:', error);
    return false;
  }
};

export const getUserCloudService = async (
  id: string
): Promise<UserCloudService | null> => {
  try {
    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_cloud_services')
      .select(`
        *,
        cloud_service:cloud_services_id (
          id,
          name,
          type,
          description,
          category,
          tags,
          home_url,
          logo,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error getting user cloud service:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting user cloud service:', error);
    return null;
  }
};

export const getUserCloudServicesByUserId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('Getting user cloud services by user ID');
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
      .from('user_cloud_services')
      .select(`
        *,
        cloud_service:cloud_services_id (
          id,
          name,
          type,
          description,
          category,
          tags,
          home_url,
          logo,
          created_at
        )
      `)
      .eq('user_id', currentUser?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting user cloud services:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user cloud services',
      });
      return;
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('Error getting user cloud services:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user cloud services',
    });
  }
};

// Create a new service
export const createCoolifyService = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const serviceData: CreateServiceRequest = req.body;

    // Validate required fields
    if (!serviceData.type || !serviceData.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: type, name',
      });
      return;
    }

    // Build payload with only provided fields and defaults
    const payload: any = {
      type: serviceData.type,
      name: serviceData.name,
      project_uuid: serviceData.project_uuid || 'zgcogowo04ww0k8cc4gc4wsg',
      server_uuid: serviceData.server_uuid || 'b08o4o4ck8wo4kc0k8w848o8',
      environment_name: serviceData.environment_name || 'production',
      instant_deploy: serviceData.instant_deploy || true,
    };

    // Add optional fields only if provided
    if (serviceData.description) {payload.description = serviceData.description;}

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/services`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    //console.log('response',response);
    // Save to database
    const userCloudServiceData: UserCloudService = {
      user_id: (req as any).user?.id || req.body.user_id,
      service_id: response.data.uuid,
      type: payload.type,
      domain: response.data.domains[0] || null,
      config: payload,
      response: response.data,
      env: (payload as any).env || null,
      cloud_services_id: serviceData.cloud_services_id || '',
    };

    const savedService = await saveUserCloudService(userCloudServiceData);

    res.status(201).json({
      success: true,
      data: response.data,
      database_record: savedService,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create Service API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create service in Coolify',
    });
  }
};

// Update a service
export const updateCoolifyService = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Service ID is required',
      });
      return;
    }

    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const serviceData: Partial<CreateServiceRequest> = req.body;

    const response = await axios.patch(
      `${coolifyBaseUrl}/api/v1/services/${id}`,
      serviceData,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Update database record
    const updateData: Partial<UserCloudService> = {
      ...(serviceData.type && { type: serviceData.type }),
      config: serviceData,
      response: response.data,
      env: (serviceData as any).env || null,
    };

    const { supabase } = await getClient();
    const { data: updatedService } = await supabase
      .from('user_cloud_services')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    res.json({
      success: true,
      data: response.data,
      database_record: updatedService,
    });
  } catch (error: any) {
    console.error(
      'Coolify Update Service API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to update service in Coolify',
    });
  }
};

// Delete a service
export const deleteCoolifyService = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Service ID is required',
      });
      return;
    }

    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.delete(
      `${coolifyBaseUrl}/api/v1/services/${id}`,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Delete from database
    const deleted = await deleteUserCloudService(id);

    res.json({
      success: true,
      data: response.data,
      database_deleted: deleted,
    });
  } catch (error: any) {
    console.error(
      'Coolify Delete Service API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to delete service from Coolify',
    });
  }
};

// Start a service
export const startCoolifyService = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.get(
      `${coolifyBaseUrl}/api/v1/services/${id}/start`,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Start Service API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to start service in Coolify',
    });
  }
};

// Stop a service
export const stopCoolifyService = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.get(
      `${coolifyBaseUrl}/api/v1/services/${id}/stop`,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Stop Service API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to stop service in Coolify',
    });
  }
};

// Restart a service
export const restartCoolifyService = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.get(
      `${coolifyBaseUrl}/api/v1/services/${id}/restart`,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Restart Service API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to restart service in Coolify',
    });
  }
};

// Get service environment variables
export const getCoolifyServiceEnvs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.get(
      `${coolifyBaseUrl}/api/v1/services/${id}/envs`,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Service Envs API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch service environment variables from Coolify',
    });
  }
};

// Create service environment variable
export const createCoolifyServiceEnv = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const envData = req.body;

    // Validate required fields
    if (!envData.key || envData.value === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: key, value',
      });
      return;
    }

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/services/${id}/envs`,
      envData,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.status(201).json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create Service Env API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create service environment variable in Coolify',
    });
  }
};

// Update service environment variable
export const updateCoolifyServiceEnv = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, envId } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const envData = req.body;

    const response = await axios.patch(
      `${coolifyBaseUrl}/api/v1/services/${id}/envs/${envId}`,
      envData,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Update Service Env API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to update service environment variable in Coolify',
    });
  }
};

// Update service environment variables (bulk)
export const updateCoolifyServiceEnvsBulk = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const envsData = req.body;

    const response = await axios.patch(
      `${coolifyBaseUrl}/api/v1/services/${id}/envs/bulk`,
      envsData,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Update Service Envs Bulk API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to update service environment variables in bulk in Coolify',
    });
  }
};

// Delete service environment variable
export const deleteCoolifyServiceEnv = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, envId } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.delete(
      `${coolifyBaseUrl}/api/v1/services/${id}/envs/${envId}`,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Delete Service Env API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to delete service environment variable from Coolify',
    });
  }
};

// Get specific cloud service from coolify
export const getUserCloudServiceById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Service ID is required',
      });
      return;
    }

    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.get(
      `${coolifyBaseUrl}/api/v1/services/${id}`,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Filter response data to only return specified fields
    const filteredData = {
      uuid: response.data.uuid,
      name: response.data.name,
      applications: response.data.applications,
      server_status: response.data.server_status,
      service_type: response.data.service_type,
      status: response.data.status,
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
    };

    res.json({
      success: true,
      data: filteredData,
    });
  } catch (error: any) {
    console.error('Get User Cloud Service Error:', error);

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to get service from Coolify',
    });
  }
};

// Delete cloud service from database only
export const deleteUserCloudServiceById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Service ID is required',
      });
      return;
    }

    const deleted = await deleteUserCloudService(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Service not found or delete failed',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete User Cloud Service Error:', error);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user cloud service',
    });
  }
};
