import { Request, Response } from 'express';
import { getUser } from '../../../utils/userUtils';
import { convertImageUrlToBase64 } from '../../../utils/fileUtils';

// FLUX 1.1 Pro API Types
export interface FluxProRequest {
  prompt: string | null;
  image_prompt?: string | null;
  width?: number;
  height?: number;
  prompt_upsampling?: boolean;
  seed?: number | null;
  safety_tolerance?: number;
  output_format?: 'jpeg' | 'png' | null;
  webhook_url?: string | null;
  webhook_secret?: string | null;
}

export interface FluxProResponse {
  id: string;
  polling_url: string;
}

export interface FluxProResult {
  status: 'Pending' | 'Ready' | 'Error' | 'Failed';
  result?: {
    sample: string;
  };
  error?: string;
}

export interface FluxProError {
  error: string;
  message?: string;
}

// Create FLUX 1.1 Pro image generation request
export const createFluxProRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      prompt,
      image_prompt,
      width,
      height,
      prompt_upsampling,
      seed,
      safety_tolerance,
      output_format,
      webhook_url,
      webhook_secret,
    } = req.body as FluxProRequest;

    // Validate required fields
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
      return;
    }

    // Get current user
    const user = getUser(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    // Get BFL API key from environment
    const bflApiKey = process.env.BFL_API_KEY;
    if (!bflApiKey) {
      res.status(500).json({
        success: false,
        error: 'BFL API key not configured',
      });
      return;
    }

    // Process image_prompt if it's a URL
    let processedImagePrompt = image_prompt || null;
    if (image_prompt && !image_prompt.startsWith('data:')) {
      // It's a URL, convert to base64
      processedImagePrompt = await convertImageUrlToBase64(image_prompt);
      if (!processedImagePrompt) {
        res.status(400).json({
          success: false,
          error: 'Failed to convert image URL to base64',
          message: 'The provided image URL could not be processed',
        });
        return;
      }

      // Extract just the base64 string (BFL API expects base64 without data URL prefix)
      const base64Data = processedImagePrompt.split(',')[1];
      if (!base64Data) {
        res.status(400).json({
          success: false,
          error: 'Invalid base64 data URL',
          message: 'Could not extract base64 data from the converted URL',
        });
        return;
      }

      if (base64Data.length > 10000000) {
        // 10MB limit
        res.status(400).json({
          success: false,
          error: 'Image too large',
          message:
            'The image is too large for processing. Please use a smaller image.',
        });
        return;
      }

      processedImagePrompt = base64Data;
    }

    // Validate width and height constraints
    const validWidth = width || 1024;
    const validHeight = height || 768;

    if (validWidth < 256 || validWidth > 1440 || validWidth % 32 !== 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid width',
        message:
          'Width must be between 256 and 1440 pixels and a multiple of 32',
      });
      return;
    }

    if (validHeight < 256 || validHeight > 1440 || validHeight % 32 !== 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid height',
        message:
          'Height must be between 256 and 1440 pixels and a multiple of 32',
      });
      return;
    }

    // Validate safety_tolerance range
    const validSafetyTolerance = safety_tolerance || 2;
    if (validSafetyTolerance < 0 || validSafetyTolerance > 6) {
      res.status(400).json({
        success: false,
        error: 'Invalid safety tolerance',
        message: 'Safety tolerance must be between 0 and 6',
      });
      return;
    }

    // Prepare request payload
    const requestPayload: FluxProRequest = {
      prompt,
      image_prompt: processedImagePrompt,
      width: validWidth,
      height: validHeight,
      prompt_upsampling: prompt_upsampling || false,
      seed: seed || null,
      safety_tolerance: validSafetyTolerance,
      output_format: output_format || 'jpeg',
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
    };

    // Make request to BFL API
    const response = await fetch('https://api.bfl.ai/v1/flux-pro-1.1', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-key': bflApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as FluxProError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX 1.1 Pro request',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxProResponse;

    res.status(200).json({
      success: true,
      data: {
        request_id: result.id,
        polling_url: result.polling_url,
      },
    });
  } catch (error: any) {
    console.error('Error creating FLUX 1.1 Pro request:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Poll for FLUX 1.1 Pro result
export const pollFluxProResult = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { polling_url } = req.query;

    if (!polling_url || typeof polling_url !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Polling URL is required',
      });
      return;
    }

    // Get BFL API key from environment
    const bflApiKey = process.env.BFL_API_KEY;
    if (!bflApiKey) {
      res.status(500).json({
        success: false,
        error: 'BFL API key not configured',
      });
      return;
    }

    // Poll the result
    const response = await fetch(polling_url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-key': bflApiKey,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as FluxProError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to poll FLUX 1.1 Pro result',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxProResult;

    if (result.status === 'Ready') {
      res.status(200).json({
        success: true,
        data: {
          status: result.status,
          image_url: result.result?.sample,
          ready: true,
        },
      });
    } else if (result.status === 'Error' || result.status === 'Failed') {
      res.status(400).json({
        success: false,
        error: 'Image generation failed',
        message: result.error || 'Unknown error occurred',
      });
    } else {
      // Still pending
      res.status(200).json({
        success: true,
        data: {
          status: result.status,
          ready: false,
        },
      });
    }
  } catch (error: any) {
    console.error('Error polling FLUX 1.1 Pro result:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Combined endpoint that creates request and polls until completion
export const generateFluxProImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      prompt,
      image_prompt,
      width,
      height,
      prompt_upsampling,
      seed,
      safety_tolerance,
      output_format,
      webhook_url,
      webhook_secret,
      max_polls = 60,
      poll_interval = 2000,
    } = req.body as FluxProRequest & {
      max_polls?: number;
      poll_interval?: number;
    };

    // Validate required fields
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
      return;
    }

    // Get current user
    const user = getUser(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    // Get BFL API key from environment
    const bflApiKey = process.env.BFL_API_KEY;
    if (!bflApiKey) {
      res.status(500).json({
        success: false,
        error: 'BFL API key not configured',
      });
      return;
    }

    // Process image_prompt if it's a URL
    let processedImagePrompt = image_prompt || null;
    if (image_prompt && !image_prompt.startsWith('data:')) {
      // It's a URL, convert to base64
      processedImagePrompt = await convertImageUrlToBase64(image_prompt);
      if (!processedImagePrompt) {
        res.status(400).json({
          success: false,
          error: 'Failed to convert image URL to base64',
          message: 'The provided image URL could not be processed',
        });
        return;
      }

      // Extract just the base64 string (BFL API expects base64 without data URL prefix)
      const base64Data = processedImagePrompt.split(',')[1];
      if (!base64Data) {
        res.status(400).json({
          success: false,
          error: 'Invalid base64 data URL',
          message: 'Could not extract base64 data from the converted URL',
        });
        return;
      }

      if (base64Data.length > 10000000) {
        // 10MB limit
        res.status(400).json({
          success: false,
          error: 'Image too large',
          message:
            'The image is too large for processing. Please use a smaller image.',
        });
        return;
      }

      processedImagePrompt = base64Data;
    }

    // Validate width and height constraints
    const validWidth = width || 1024;
    const validHeight = height || 768;

    if (validWidth < 256 || validWidth > 1440 || validWidth % 32 !== 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid width',
        message:
          'Width must be between 256 and 1440 pixels and a multiple of 32',
      });
      return;
    }

    if (validHeight < 256 || validHeight > 1440 || validHeight % 32 !== 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid height',
        message:
          'Height must be between 256 and 1440 pixels and a multiple of 32',
      });
      return;
    }

    // Validate safety_tolerance range
    const validSafetyTolerance = safety_tolerance || 2;
    if (validSafetyTolerance < 0 || validSafetyTolerance > 6) {
      res.status(400).json({
        success: false,
        error: 'Invalid safety tolerance',
        message: 'Safety tolerance must be between 0 and 6',
      });
      return;
    }

    // Create the initial request
    const requestPayload: FluxProRequest = {
      prompt,
      image_prompt: processedImagePrompt,
      width: validWidth,
      height: validHeight,
      prompt_upsampling: prompt_upsampling || false,
      seed: seed || null,
      safety_tolerance: validSafetyTolerance,
      output_format: output_format || 'jpeg',
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
    };

    const createResponse = await fetch('https://api.bfl.ai/v1/flux-pro-1.1', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-key': bflApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!createResponse.ok) {
      const errorData = (await createResponse.json()) as FluxProError;
      res.status(createResponse.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX 1.1 Pro request',
        message: errorData.message,
      });
      return;
    }

    const createResult = (await createResponse.json()) as FluxProResponse;

    // Poll for completion
    let attempts = 0;
    while (attempts < max_polls) {
      await new Promise(resolve => setTimeout(resolve, poll_interval));

      const pollResponse = await fetch(createResult.polling_url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-key': bflApiKey,
        },
      });

      if (!pollResponse.ok) {
        const errorData = (await pollResponse.json()) as FluxProError;
        res.status(pollResponse.status).json({
          success: false,
          error: errorData.error || 'Failed to poll FLUX 1.1 Pro result',
          message: errorData.message,
        });
        return;
      }

      const pollResult = (await pollResponse.json()) as FluxProResult;
      if (pollResult.status === 'Ready') {
        res.status(200).json({
          success: true,
          image_url: pollResult.result?.sample,
        });
        return;
      } else if (
        pollResult.status === 'Error' ||
        pollResult.status === 'Failed'
      ) {
        res.status(400).json({
          success: false,
          error: 'Image generation failed',
          message: pollResult.error || 'Unknown error occurred',
          request_id: createResult.id,
        });
        return;
      }

      attempts++;
    }
    // Timeout
    res.status(408).json({
      success: false,
      error: 'Request timeout',
      message: `Image generation did not complete within ${(max_polls * poll_interval) / 1000} seconds`,
      request_id: createResult.id,
      polling_url: createResult.polling_url,
    });
  } catch (error: any) {
    console.error('Error generating FLUX 1.1 Pro image:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
