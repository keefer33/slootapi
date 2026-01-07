import { Request, Response } from 'express';
import { getUser } from '../../../utils/userUtils';
import { convertImageUrlToBase64 } from '../../../utils/fileUtils';

// FLUX Pro Ultra API Types
export interface FluxProUltraRequest {
  prompt: string;
  prompt_upsampling?: boolean;
  seed?: number | null;
  aspect_ratio?: string;
  safety_tolerance?: number;
  output_format?: 'jpeg' | 'png';
  raw?: boolean;
  image_prompt?: string | null;
  image_prompt_strength?: number;
  webhook_url?: string | null;
  webhook_secret?: string | null;
}

export interface FluxProUltraResponse {
  id: string;
  polling_url: string;
}

export interface FluxProUltraResult {
  status: 'Pending' | 'Ready' | 'Error' | 'Failed';
  result?: {
    sample: string;
  };
  error?: string;
}

export interface FluxProUltraError {
  error: string;
  message?: string;
}

// Create FLUX Pro Ultra image generation request
export const createFluxProUltraRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      prompt,
      prompt_upsampling,
      seed,
      aspect_ratio,
      safety_tolerance,
      output_format,
      raw,
      image_prompt,
      image_prompt_strength,
      webhook_url,
      webhook_secret,
    } = req.body as FluxProUltraRequest;

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

      // Validate base64 format
      if (!processedImagePrompt.startsWith('data:image/')) {
        res.status(400).json({
          success: false,
          error: 'Invalid base64 data URL format',
          message: 'The converted image data is not in the correct format',
        });
        return;
      }

      // Check if base64 is too large (BFL might have size limits)
      const base64Data = processedImagePrompt.split(',')[1]; // Get just the base64 part
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

      // BFL API might expect just the base64 string without the data URL prefix
      // Let's try sending just the base64 part
      processedImagePrompt = base64Data;
    }
    // Prepare request payload
    const requestPayload: FluxProUltraRequest = {
      prompt,
      prompt_upsampling: prompt_upsampling || false,
      seed: seed || null,
      aspect_ratio: aspect_ratio || '16:9',
      safety_tolerance: safety_tolerance || 2,
      output_format: output_format || 'jpeg',
      raw: raw || false,
      image_prompt: processedImagePrompt,
      image_prompt_strength: image_prompt_strength || 0.1,
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
    };

    // Make request to BFL API
    const response = await fetch('https://api.bfl.ai/v1/flux-pro-1.1-ultra', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-key': bflApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as FluxProUltraError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX Pro Ultra request',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxProUltraResponse;

    res.status(200).json({
      success: true,
      data: {
        request_id: result.id,
        polling_url: result.polling_url,
      },
    });
  } catch (error: any) {
    console.error('Error creating FLUX Pro Ultra request:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Poll for FLUX Pro Ultra result
export const pollFluxProUltraResult = async (
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
      const errorData = (await response.json()) as FluxProUltraError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to poll FLUX Pro Ultra result',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxProUltraResult;

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
    console.error('Error polling FLUX Pro Ultra result:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Combined endpoint that creates request and polls until completion
export const generateFluxProUltraImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      prompt,
      prompt_upsampling,
      seed,
      aspect_ratio,
      safety_tolerance,
      output_format,
      raw,
      image_prompt,
      image_prompt_strength,
      webhook_url,
      webhook_secret,
      max_polls = 60,
      poll_interval = 2000,
    } = req.body as FluxProUltraRequest & {
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

      // Validate base64 format
      if (!processedImagePrompt.startsWith('data:image/')) {
        res.status(400).json({
          success: false,
          error: 'Invalid base64 data URL format',
          message: 'The converted image data is not in the correct format',
        });
        return;
      }

      // Check if base64 is too large (BFL might have size limits)
      const base64Data = processedImagePrompt.split(',')[1]; // Get just the base64 part
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

      // BFL API might expect just the base64 string without the data URL prefix
      // Let's try sending just the base64 part
      processedImagePrompt = base64Data;
    }

    // Create the initial request
    const requestPayload: FluxProUltraRequest = {
      prompt,
      prompt_upsampling: prompt_upsampling || false,
      seed: seed || null,
      aspect_ratio: aspect_ratio || '16:9',
      safety_tolerance: safety_tolerance || 2,
      output_format: output_format || 'jpeg',
      raw: raw || false,
      image_prompt: processedImagePrompt,
      image_prompt_strength: image_prompt_strength || 0.1,
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
    };

    const createResponse = await fetch(
      'https://api.bfl.ai/v1/flux-pro-1.1-ultra',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'x-key': bflApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      }
    );

    if (!createResponse.ok) {
      const errorData = (await createResponse.json()) as FluxProUltraError &
        any;
      res.status(createResponse.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX Pro Ultra request',
        message: errorData.message,
      });
      return;
    }

    const createResult = (await createResponse.json()) as FluxProUltraResponse;
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
        const errorData = (await pollResponse.json()) as FluxProUltraError;
        res.status(pollResponse.status).json({
          success: false,
          error: errorData.error || 'Failed to poll FLUX Pro Ultra result',
          message: errorData.message,
        });
        return;
      }

      const pollResult = (await pollResponse.json()) as FluxProUltraResult;
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
    console.error('Error generating FLUX Pro Ultra image:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
