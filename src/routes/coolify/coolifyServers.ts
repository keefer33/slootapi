import { Request, Response } from 'express';
import axios from 'axios';

// Coolify Servers API Types
export interface CoolifyServer {
  id: string;
  name: string;
  description?: string;
  ip: string;
  port: number;
  user: string;
  private_key_uuid: string;
  is_build_server: boolean;
  instant_validate: boolean;
  proxy_type?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateServerRequest {
  name: string;
  description?: string;
  ip: string;
  port: number;
  user: string;
  private_key_uuid: string;
  is_build_server?: boolean;
  instant_validate?: boolean;
  proxy_type?: string;
}

export interface CoolifyServersResponse {
  data: CoolifyServer[];
  total: number;
  page: number;
  per_page: number;
}

export interface CoolifyError {
  error: string;
  message?: string;
}

// Get all servers from Coolify
export const getCoolifyServers = async (
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

    const response = await axios.get(`${coolifyBaseUrl}/api/v1/servers`, {
      headers: {
        Authorization: `Bearer ${coolifyApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Servers API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch servers from Coolify',
    });
  }
};

// Get a specific server by ID
export const getCoolifyServer = async (
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

    const response = await axios.get(`${coolifyBaseUrl}/api/v1/servers/${id}`, {
      headers: {
        Authorization: `Bearer ${coolifyApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Server API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch server from Coolify',
    });
  }
};

// Create a new server
export const createCoolifyServer = async (
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

    const serverData: CreateServerRequest = req.body;

    // Validate required fields
    if (
      !serverData.name ||
      !serverData.ip ||
      !serverData.port ||
      !serverData.user ||
      !serverData.private_key_uuid
    ) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: name, ip, port, user, private_key_uuid',
      });
      return;
    }

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/servers`,
      serverData,
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
      'Coolify Create Server API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create server in Coolify',
    });
  }
};

// Update a server
export const updateCoolifyServer = async (
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

    const serverData: Partial<CreateServerRequest> = req.body;

    const response = await axios.patch(
      `${coolifyBaseUrl}/api/v1/servers/${id}`,
      serverData,
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
      'Coolify Update Server API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to update server in Coolify',
    });
  }
};

// Delete a server
export const deleteCoolifyServer = async (
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

    const response = await axios.delete(
      `${coolifyBaseUrl}/api/v1/servers/${id}`,
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
      'Coolify Delete Server API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to delete server from Coolify',
    });
  }
};

// Get server resources
export const getCoolifyServerResources = async (
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
      `${coolifyBaseUrl}/api/v1/servers/${id}/resources`,
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
      'Coolify Server Resources API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch server resources from Coolify',
    });
  }
};

// Get server domains
export const getCoolifyServerDomains = async (
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
      `${coolifyBaseUrl}/api/v1/servers/${id}/domains`,
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
      'Coolify Server Domains API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch server domains from Coolify',
    });
  }
};

// Validate server
export const validateCoolifyServer = async (
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
      `${coolifyBaseUrl}/api/v1/servers/${id}/validate`,
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
      'Coolify Validate Server API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to validate server in Coolify',
    });
  }
};
