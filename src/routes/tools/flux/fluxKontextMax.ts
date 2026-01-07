import { Request, Response } from 'express';
import { getUser } from '../../../utils/userUtils';
import { convertImageUrlToBase64 } from '../../../utils/fileUtils';

// FLUX Kontext Max API Types
export interface FluxKontextMaxRequest {
  prompt: string;
  input_image?: string | null;
  input_image_2?: string | null;
  input_image_3?: string | null;
  input_image_4?: string | null;
  seed?: number | null;
  aspect_ratio?: string | null;
  output_format?: 'jpeg' | 'png' | null;
  webhook_url?: string | null;
  webhook_secret?: string | null;
  prompt_upsampling?: boolean;
  safety_tolerance?: number;
}

export interface FluxKontextMaxResponse {
  id: string;
  polling_url: string;
}

export interface FluxKontextMaxResult {
  status: 'Pending' | 'Ready' | 'Error' | 'Failed';
  result?: {
    sample: string;
  };
  error?: string;
}

export interface FluxKontextMaxError {
  error: string;
  message?: string;
}

// Helper function to process multiple input images
const processInputImages = async (
  images: (string | null | undefined)[]
): Promise<(string | null)[]> => {
  const processedImages: (string | null)[] = [];

  for (const image of images) {
    if (!image) {
      processedImages.push(null);
      continue;
    }

    if (image.startsWith('data:')) {
      // Already base64, extract just the base64 part
      const base64Data = image.split(',')[1];
      if (!base64Data) {
        processedImages.push(null);
        continue;
      }
      processedImages.push(base64Data);
    } else {
      // It's a URL, convert to base64
      const convertedImage = await convertImageUrlToBase64(image);
      if (!convertedImage) {
        processedImages.push(null);
        continue;
      }

      // Extract just the base64 string (BFL API expects base64 without data URL prefix)
      const base64Data = convertedImage.split(',')[1];
      if (!base64Data) {
        processedImages.push(null);
        continue;
      }

      if (base64Data.length > 10000000) {
        // 10MB limit per image
        processedImages.push(null);
        continue;
      }

      processedImages.push(base64Data);
    }
  }

  return processedImages;
};

// Create FLUX Kontext Max image generation request
export const createFluxKontextMaxRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      prompt,
      input_image,
      input_image_2,
      input_image_3,
      input_image_4,
      seed,
      aspect_ratio,
      output_format,
      webhook_url,
      webhook_secret,
      prompt_upsampling,
      safety_tolerance,
    } = req.body as FluxKontextMaxRequest;

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

    // Process all input images
    const processedImages = await processInputImages([
      input_image,
      input_image_2,
      input_image_3,
      input_image_4,
    ]);

    // Check if at least one image was successfully processed
    const hasValidImage = processedImages.some(img => img !== null);
    if (
      !hasValidImage &&
      (input_image || input_image_2 || input_image_3 || input_image_4)
    ) {
      res.status(400).json({
        success: false,
        error: 'Failed to process input images',
        message: 'None of the provided images could be processed',
      });
      return;
    }

    // Validate aspect_ratio if provided
    if (aspect_ratio) {
      const validAspectRatios = [
        '21:9',
        '20:9',
        '19:9',
        '18:9',
        '17:9',
        '16:9',
        '15:9',
        '14:9',
        '13:9',
        '12:9',
        '11:9',
        '10:9',
        '9:9',
        '9:10',
        '9:11',
        '9:12',
        '9:13',
        '9:14',
        '9:15',
        '9:16',
        '9:17',
        '9:18',
        '9:19',
        '9:20',
        '9:21',
      ];
      if (!validAspectRatios.includes(aspect_ratio)) {
        res.status(400).json({
          success: false,
          error: 'Invalid aspect ratio',
          message: 'Aspect ratio must be between 21:9 and 9:21',
        });
        return;
      }
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
    const requestPayload: FluxKontextMaxRequest = {
      prompt,
      input_image: processedImages[0] || null,
      input_image_2: processedImages[1] || null,
      input_image_3: processedImages[2] || null,
      input_image_4: processedImages[3] || null,
      seed: seed || null,
      aspect_ratio: aspect_ratio || null,
      output_format: output_format || 'png',
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
      prompt_upsampling: prompt_upsampling || false,
      safety_tolerance: validSafetyTolerance,
    };

    // Make request to BFL API
    const response = await fetch('https://api.bfl.ai/v1/flux-kontext-max', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-key': bflApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as FluxKontextMaxError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX Kontext Max request',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxKontextMaxResponse;

    res.status(200).json({
      success: true,
      data: {
        request_id: result.id,
        polling_url: result.polling_url,
      },
    });
  } catch (error: any) {
    console.error('Error creating FLUX Kontext Max request:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Poll for FLUX Kontext Max result
export const pollFluxKontextMaxResult = async (
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
      const errorData = (await response.json()) as FluxKontextMaxError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to poll FLUX Kontext Max result',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxKontextMaxResult;

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
    console.error('Error polling FLUX Kontext Max result:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Combined endpoint that creates request and polls until completion
export const generateFluxKontextMaxImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      prompt,
      input_image,
      input_image_2,
      input_image_3,
      input_image_4,
      seed,
      aspect_ratio,
      output_format,
      webhook_url,
      webhook_secret,
      prompt_upsampling,
      safety_tolerance,
      max_polls = 60,
      poll_interval = 2000,
    } = req.body as FluxKontextMaxRequest & {
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

    // Process all input images
    const processedImages = await processInputImages([
      input_image,
      input_image_2,
      input_image_3,
      input_image_4,
    ]);

    // Check if at least one image was successfully processed
    const hasValidImage = processedImages.some(img => img !== null);
    if (
      !hasValidImage &&
      (input_image || input_image_2 || input_image_3 || input_image_4)
    ) {
      res.status(400).json({
        success: false,
        error: 'Failed to process input images',
        message: 'None of the provided images could be processed',
      });
      return;
    }

    // Validate aspect_ratio if provided
    if (aspect_ratio) {
      const validAspectRatios = [
        '21:9',
        '20:9',
        '19:9',
        '18:9',
        '17:9',
        '16:9',
        '15:9',
        '14:9',
        '13:9',
        '12:9',
        '11:9',
        '10:9',
        '9:9',
        '9:10',
        '9:11',
        '9:12',
        '9:13',
        '9:14',
        '9:15',
        '9:16',
        '9:17',
        '9:18',
        '9:19',
        '9:20',
        '9:21',
      ];
      if (!validAspectRatios.includes(aspect_ratio)) {
        res.status(400).json({
          success: false,
          error: 'Invalid aspect ratio',
          message: 'Aspect ratio must be between 21:9 and 9:21',
        });
        return;
      }
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
    const requestPayload: FluxKontextMaxRequest = {
      prompt,
      input_image: processedImages[0] || null,
      input_image_2: processedImages[1] || null,
      input_image_3: processedImages[2] || null,
      input_image_4: processedImages[3] || null,
      seed: seed || null,
      aspect_ratio: aspect_ratio || null,
      output_format: output_format || 'png',
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
      prompt_upsampling: prompt_upsampling || false,
      safety_tolerance: validSafetyTolerance,
    };

    const createResponse = await fetch(
      'https://api.bfl.ai/v1/flux-kontext-max',
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
      const errorData = (await createResponse.json()) as FluxKontextMaxError;
      res.status(createResponse.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX Kontext Max request',
        message: errorData.message,
      });
      return;
    }

    const createResult =
      (await createResponse.json()) as FluxKontextMaxResponse;

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
        const errorData = (await pollResponse.json()) as FluxKontextMaxError;
        res.status(pollResponse.status).json({
          success: false,
          error: errorData.error || 'Failed to poll FLUX Kontext Max result',
          message: errorData.message,
        });
        return;
      }

      const pollResult = (await pollResponse.json()) as FluxKontextMaxResult;
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
    console.error('Error generating FLUX Kontext Max image:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
