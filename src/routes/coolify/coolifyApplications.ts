import { Request, Response } from 'express';
import axios from 'axios';

// Coolify Applications API Types
export interface CoolifyApplication {
  id: string;
  name: string;
  status: string;
  type: string;
  created_at: string;
  updated_at: string;
  environment_variables?: Record<string, string>;
}

export interface CoolifyApplicationsResponse {
  data: CoolifyApplication[];
  total: number;
  page: number;
  per_page: number;
}

export interface CoolifyError {
  error: string;
  message?: string;
}

// Get all applications from Coolify
export const getCoolifyApplications = async (
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

    const response = await axios.get(`${coolifyBaseUrl}/api/v1/applications`, {
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
      'Coolify Applications API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch applications from Coolify',
    });
  }
};

// Get a specific application by ID
export const getCoolifyApplication = async (
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
      `${coolifyBaseUrl}/api/v1/applications/${id}`,
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
      'Coolify Application API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch application from Coolify',
    });
  }
};

// Start an application
export const startCoolifyApplication = async (
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
      `${coolifyBaseUrl}/api/v1/applications/${id}/start`,
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
      'Coolify Start Application API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to start application in Coolify',
    });
  }
};

// Stop an application
export const stopCoolifyApplication = async (
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
      `${coolifyBaseUrl}/api/v1/applications/${id}/stop`,
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
      'Coolify Stop Application API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to stop application in Coolify',
    });
  }
};

// Restart an application
export const restartCoolifyApplication = async (
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
      `${coolifyBaseUrl}/api/v1/applications/${id}/restart`,
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
      'Coolify Restart Application API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to restart application in Coolify',
    });
  }
};
