import { Request, Response } from 'express';
import { getUser } from '../../../utils/userUtils';
import { convertImageUrlToBase64 } from '../../../utils/fileUtils';

// FLUX.1 Dev API Types
export interface FluxDevRequest {
  prompt: string;
  image_prompt?: string | null;
  width?: number;
  height?: number;
  steps?: number | null;
  prompt_upsampling?: boolean;
  seed?: number | null;
  guidance?: number | null;
  safety_tolerance?: number;
  output_format?: 'jpeg' | 'png' | null;
  webhook_url?: string | null;
  webhook_secret?: string | null;
}

export interface FluxDevResponse {
  id: string;
  polling_url: string;
}

export interface FluxDevResult {
  status: 'Pending' | 'Ready' | 'Error' | 'Failed';
  result?: {
    sample: string;
  };
  error?: string;
}

export interface FluxDevError {
  error: string;
  message?: string;
}

// Create FLUX.1 Dev image generation request
export const createFluxDevRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      prompt,
      image_prompt,
      width,
      height,
      steps,
      prompt_upsampling,
      seed,
      guidance,
      safety_tolerance,
      output_format,
      webhook_url,
      webhook_secret,
    } = req.body as FluxDevRequest;

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

    // Validate steps range
    const validSteps = steps || 28;
    if (validSteps < 1 || validSteps > 50) {
      res.status(400).json({
        success: false,
        error: 'Invalid steps',
        message: 'Steps must be between 1 and 50',
      });
      return;
    }

    // Validate guidance range
    const validGuidance = guidance || 3;
    if (validGuidance < 1.5 || validGuidance > 5) {
      res.status(400).json({
        success: false,
        error: 'Invalid guidance',
        message: 'Guidance must be between 1.5 and 5',
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
    const requestPayload: FluxDevRequest = {
      prompt,
      image_prompt: processedImagePrompt,
      width: validWidth,
      height: validHeight,
      steps: validSteps,
      prompt_upsampling: prompt_upsampling || false,
      seed: seed || null,
      guidance: validGuidance,
      safety_tolerance: validSafetyTolerance,
      output_format: output_format || 'jpeg',
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
    };

    // Make request to BFL API
    const response = await fetch('https://api.bfl.ai/v1/flux-dev', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-key': bflApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as FluxDevError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX.1 Dev request',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxDevResponse;

    res.status(200).json({
      success: true,
      data: {
        request_id: result.id,
        polling_url: result.polling_url,
      },
    });
  } catch (error: any) {
    console.error('Error creating FLUX.1 Dev request:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Poll for FLUX.1 Dev result
export const pollFluxDevResult = async (
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
      const errorData = (await response.json()) as FluxDevError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to poll FLUX.1 Dev result',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxDevResult;

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
    console.error('Error polling FLUX.1 Dev result:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Combined endpoint that creates request and polls until completion
export const generateFluxDevImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('🚀 Starting FLUX Dev image generation...');

    const {
      prompt,
      image_prompt,
      width,
      height,
      steps,
      prompt_upsampling,
      seed,
      guidance,
      safety_tolerance,
      output_format,
      webhook_url,
      webhook_secret,
      max_polls = 60,
      poll_interval = 500,
    } = req.body as FluxDevRequest & {
      max_polls?: number;
      poll_interval?: number;
    };

    console.log('📝 Request parameters:', {
      prompt: prompt?.substring(0, 50) + '...',
      hasImagePrompt: !!image_prompt,
      width,
      height,
      steps,
      guidance,
      max_polls,
      poll_interval,
    });

    // Validate required fields
    if (!prompt) {
      console.log('❌ Validation failed: Prompt is required');
      res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
      return;
    }

    // Get current user
    const user = getUser(req);
    if (!user) {
      console.log('❌ Authentication failed: User not authenticated');
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    console.log('👤 User authenticated:', user.id);

    // Get BFL API key from environment
    const bflApiKey = process.env.BFL_API_KEY;
    if (!bflApiKey) {
      console.log('❌ Configuration error: BFL API key not configured');
      res.status(500).json({
        success: false,
        error: 'BFL API key not configured',
      });
      return;
    }

    console.log('🔑 BFL API key found');

    // Process image_prompt if it's a URL
    let processedImagePrompt = image_prompt || null;
    if (image_prompt && !image_prompt.startsWith('data:')) {
      console.log(
        '🖼️ Processing image URL:',
        image_prompt.substring(0, 100) + '...'
      );
      // It's a URL, convert to base64
      processedImagePrompt = await convertImageUrlToBase64(image_prompt);
      if (!processedImagePrompt) {
        console.log('❌ Image conversion failed');
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
        console.log('❌ Base64 extraction failed');
        res.status(400).json({
          success: false,
          error: 'Invalid base64 data URL',
          message: 'Could not extract base64 data from the converted URL',
        });
        return;
      }

      if (base64Data.length > 10000000) {
        // 10MB limit
        console.log('❌ Image too large:', base64Data.length, 'characters');
        res.status(400).json({
          success: false,
          error: 'Image too large',
          message:
            'The image is too large for processing. Please use a smaller image.',
        });
        return;
      }

      processedImagePrompt = base64Data;
      console.log(
        '✅ Image processed successfully, size:',
        base64Data.length,
        'characters'
      );
    } else if (image_prompt) {
      console.log(
        '🖼️ Using provided base64 image, size:',
        image_prompt.length,
        'characters'
      );
    } else {
      console.log('🖼️ No image prompt provided');
    }

    // Validate width and height constraints
    const validWidth = width || 1024;
    const validHeight = height || 768;

    console.log('📏 Validating dimensions:', { validWidth, validHeight });

    if (validWidth < 256 || validWidth > 1440 || validWidth % 32 !== 0) {
      console.log('❌ Invalid width:', validWidth);
      res.status(400).json({
        success: false,
        error: 'Invalid width',
        message:
          'Width must be between 256 and 1440 pixels and a multiple of 32',
      });
      return;
    }

    if (validHeight < 256 || validHeight > 1440 || validHeight % 32 !== 0) {
      console.log('❌ Invalid height:', validHeight);
      res.status(400).json({
        success: false,
        error: 'Invalid height',
        message:
          'Height must be between 256 and 1440 pixels and a multiple of 32',
      });
      return;
    }

    // Validate steps range
    const validSteps = steps || 28;
    if (validSteps < 1 || validSteps > 50) {
      console.log('❌ Invalid steps:', validSteps);
      res.status(400).json({
        success: false,
        error: 'Invalid steps',
        message: 'Steps must be between 1 and 50',
      });
      return;
    }

    // Validate guidance range
    const validGuidance = guidance || 3;
    if (validGuidance < 1.5 || validGuidance > 5) {
      console.log('❌ Invalid guidance:', validGuidance);
      res.status(400).json({
        success: false,
        error: 'Invalid guidance',
        message: 'Guidance must be between 1.5 and 5',
      });
      return;
    }

    // Validate safety_tolerance range
    const validSafetyTolerance = safety_tolerance || 2;
    if (validSafetyTolerance < 0 || validSafetyTolerance > 6) {
      console.log('❌ Invalid safety tolerance:', validSafetyTolerance);
      res.status(400).json({
        success: false,
        error: 'Invalid safety tolerance',
        message: 'Safety tolerance must be between 0 and 6',
      });
      return;
    }

    console.log('✅ All validations passed');

    // Create the initial request
    const requestPayload: FluxDevRequest = {
      prompt,
      image_prompt: processedImagePrompt,
      width: validWidth,
      height: validHeight,
      steps: validSteps,
      prompt_upsampling: prompt_upsampling || false,
      seed: seed || null,
      guidance: validGuidance,
      safety_tolerance: validSafetyTolerance,
      output_format: output_format || 'jpeg',
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
    };

    console.log('📤 Sending request to BFL API...');
    console.log('📋 Request payload:', {
      prompt: requestPayload.prompt?.substring(0, 50) + '...',
      hasImagePrompt: !!requestPayload.image_prompt,
      width: requestPayload.width,
      height: requestPayload.height,
      steps: requestPayload.steps,
      guidance: requestPayload.guidance,
      safety_tolerance: requestPayload.safety_tolerance,
      output_format: requestPayload.output_format,
    });

    const createResponse = await fetch('https://api.bfl.ai/v1/flux-dev', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-key': bflApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    console.log('📡 BFL API response status:', createResponse.status);

    if (!createResponse.ok) {
      const errorData = (await createResponse.json()) as FluxDevError;
      console.log('❌ BFL API error:', errorData);
      res.status(createResponse.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX.1 Dev request',
        message: errorData.message,
      });
      return;
    }

    const createResult = (await createResponse.json()) as FluxDevResponse;
    console.log('✅ Request created successfully:', {
      request_id: createResult.id,
      polling_url: createResult.polling_url,
    });

    // Poll for completion
    console.log('🔄 Starting polling process...');
    console.log('⏱️ Polling config:', {
      max_polls,
      poll_interval: poll_interval + 'ms',
    });

    let attempts = 0;
    while (attempts < max_polls) {
      console.log(`🔄 Polling attempt ${attempts + 1}/${max_polls}...`);

      await new Promise(resolve => setTimeout(resolve, poll_interval));

      const pollResponse = await fetch(createResult.polling_url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-key': bflApiKey,
        },
      });

      console.log(`📡 Poll response status: ${pollResponse.status}`);

      if (!pollResponse.ok) {
        const errorData = (await pollResponse.json()) as FluxDevError;
        console.log('❌ Poll error:', errorData);
        res.status(pollResponse.status).json({
          success: false,
          error: errorData.error || 'Failed to poll FLUX.1 Dev result',
          message: errorData.message,
        });
        return;
      }

      const pollResult = (await pollResponse.json()) as FluxDevResult;
      console.log('📊 Poll result status:', pollResult.status);

      if (pollResult.status === 'Ready') {
        console.log('✅ Image generation completed successfully!');
        console.log('🖼️ Image URL:', pollResult.result?.sample);
        res.status(200).json({
          success: true,
          image_url: pollResult.result?.sample,
        });
        return;
      } else if (
        pollResult.status === 'Error' ||
        pollResult.status === 'Failed'
      ) {
        console.log('❌ Image generation failed:', pollResult.error);
        res.status(400).json({
          success: false,
          error: 'Image generation failed',
          message: pollResult.error || 'Unknown error occurred',
          request_id: createResult.id,
        });
        return;
      } else {
        console.log('⏳ Still processing... (status:', pollResult.status + ')');
      }

      attempts++;
    }

    // Timeout
    console.log('⏰ Polling timeout reached!');
    console.log('📊 Final stats:', {
      attempts_made: attempts,
      max_attempts: max_polls,
      total_time: (max_polls * poll_interval) / 1000 + ' seconds',
      request_id: createResult.id,
    });

    res.status(408).json({
      success: false,
      error: 'Request timeout',
      message: `Image generation did not complete within ${(max_polls * poll_interval) / 1000} seconds`,
      request_id: createResult.id,
      polling_url: createResult.polling_url,
    });
  } catch (error: any) {
    console.error(
      '💥 Unexpected error in FLUX.1 Dev generation:',
      error.message
    );
    console.error('🔍 Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
