import { Request, Response } from 'express';
import axios from 'axios';

// Coolify Resources API Types
export interface CoolifyResource {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CoolifyResourcesResponse {
  data: CoolifyResource[];
  total: number;
  page: number;
  per_page: number;
}

export interface CoolifyError {
  error: string;
  message?: string;
}

// Get all resources from Coolify
export const getCoolifyResources = async (
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

    const response = await axios.get(`${coolifyBaseUrl}/api/v1/resources`, {
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
      'Coolify Resources API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch resources from Coolify',
    });
  }
};

// Get a specific resource by ID
export const getCoolifyResource = async (
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
      `${coolifyBaseUrl}/api/v1/resources/${id}`,
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
      'Coolify Resource API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch resource from Coolify',
    });
  }
};
