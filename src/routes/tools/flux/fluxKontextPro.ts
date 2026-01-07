import { Request, Response } from 'express';

// FLUX.1 Kontext API Types
export interface FluxKontextRequest {
  prompt: string;
  input_image?: string | null;
  aspect_ratio?: string;
  seed?: number | null;
  prompt_upsampling?: boolean;
  safety_tolerance?: number;
  output_format?: 'jpeg' | 'png';
  webhook_url?: string | null;
  webhook_secret?: string | null;
}

export interface FluxKontextResponse {
  id: string;
  polling_url: string;
}

export interface FluxKontextResult {
  status: 'Pending' | 'Ready' | 'Error' | 'Failed';
  result?: {
    sample: string;
  };
  error?: string;
}

export interface FluxKontextError {
  error: string;
  message?: string;
}

// Create FLUX.1 Kontext image generation request
export const createFluxKontextRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      prompt,
      input_image,
      aspect_ratio,
      seed,
      prompt_upsampling,
      safety_tolerance,
      output_format,
      webhook_url,
      webhook_secret,
    } = req.body as FluxKontextRequest;

    // Validate required fields
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: 'Prompt is required',
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

    // Prepare request payload
    const requestPayload: FluxKontextRequest = {
      prompt,
      input_image: input_image || null,
      aspect_ratio: aspect_ratio || '1:1',
      seed: seed || null,
      prompt_upsampling: prompt_upsampling || false,
      safety_tolerance: safety_tolerance || 2,
      output_format: output_format || 'jpeg',
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
    };

    // Make request to BFL API
    const response = await fetch('https://api.bfl.ai/v1/flux-kontext-pro', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-key': bflApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as FluxKontextError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX Kontext request',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxKontextResponse;
    res.status(200).json({
      success: true,
      data: {
        request_id: result.id,
        polling_url: result.polling_url,
      },
    });
  } catch (error: any) {
    console.error('Error creating FLUX Kontext request:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Poll for FLUX.1 Kontext result
export const pollFluxKontextResult = async (
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
      const errorData = (await response.json()) as FluxKontextError;
      res.status(response.status).json({
        success: false,
        error: errorData.error || 'Failed to poll FLUX Kontext result',
        message: errorData.message,
      });
      return;
    }

    const result = (await response.json()) as FluxKontextResult;

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
    console.error('Error polling FLUX Kontext result:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Combined endpoint that creates request and polls until completion
export const generateFluxKontextImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      prompt,
      input_image,
      aspect_ratio,
      seed,
      prompt_upsampling,
      safety_tolerance,
      output_format,
      webhook_url,
      webhook_secret,
      max_polls = 60,
      poll_interval = 2000,
    } = req.body as FluxKontextRequest & {
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

    // Get BFL API key from environment
    const bflApiKey = process.env.BFL_API_KEY;
    if (!bflApiKey) {
      res.status(500).json({
        success: false,
        error: 'BFL API key not configured',
      });
      return;
    }

    // Create the initial request
    const requestPayload: FluxKontextRequest = {
      prompt,
      input_image: input_image || null,
      aspect_ratio: aspect_ratio || '1:1',
      seed: seed || null,
      prompt_upsampling: prompt_upsampling || false,
      safety_tolerance: safety_tolerance || 2,
      output_format: output_format || 'jpeg',
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
    };

    const createResponse = await fetch(
      'https://api.bfl.ai/v1/flux-kontext-pro',
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
      const errorData = (await createResponse.json()) as FluxKontextError;
      res.status(createResponse.status).json({
        success: false,
        error: errorData.error || 'Failed to create FLUX Kontext request',
        message: errorData.message,
      });
      return;
    }

    const createResult = (await createResponse.json()) as FluxKontextResponse;
    console.log('result', createResult);

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
        const errorData = (await pollResponse.json()) as FluxKontextError;
        res.status(pollResponse.status).json({
          success: false,
          error: errorData.error || 'Failed to poll FLUX Kontext result',
          message: errorData.message,
        });
        return;
      }

      const pollResult = (await pollResponse.json()) as FluxKontextResult;

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
    console.error('Error generating FLUX Kontext image:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
